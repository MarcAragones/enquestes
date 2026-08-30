#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["pandas", "pyarrow", "openpyxl"]
# ///
"""Converteix un export cru (CSV) en els tres artefactes publicats.

Sempre s'ha d'invocar via `uv run scripts/convert_enquesta.py ...` -- mai amb
l'intèrpret `python3` del sistema (vegeu RESEARCH.md Pitfall 1: la versió per
defecte d'aquesta màquina és massa antiga per a pandas/pyarrow).

Nota de seguretat: un .xlsx cru s'ha de tractar amb la mateixa cautela que
qualsevol full de càlcul descarregat abans d'obrir-lo a mà en una aplicació
d'ofimàtica -- pandas només llegeix valors de cel·la com a dades i mai
n'avalua fórmules, per la qual cosa aquest risc viu a l'aplicació d'ofimàtica
del desenvolupador, no en aquest script.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pyarrow.parquet as pq

from pipeline import index as index_mod
from pipeline import infer, privacy, schema
from pipeline import load as load_mod


def _parse_args(argv: list) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Converteix un export CSV cru en <id>_respostes.parquet, "
            "<id>_meta.json i una entrada upsertada a enquestes_index.json."
        )
    )
    parser.add_argument("input_csv", type=Path, help="Camí a l'export CSV, TSV o Excel (.xlsx)")
    parser.add_argument("--id", help="Identificador de l'enquesta")
    parser.add_argument(
        "--columns",
        help=(
            "Llista de columnes permeses, separades per comes (opcional: si "
            "no s'indica, es conserven totes les columnes carregades abans "
            "dels filtres de text lliure i cardinalitat)"
        ),
    )
    parser.add_argument("--title", help="Títol de l'enquesta")
    parser.add_argument("--description", help="Descripció de l'enquesta")
    parser.add_argument(
        "--max-cardinality",
        type=int,
        default=infer.MAX_DISTINCT_VALUES,
        help=(
            "Llindar de valors distints per sobre del qual una columna es "
            f"descarta automàticament (D-01); per defecte {infer.MAX_DISTINCT_VALUES}"
        ),
    )
    parser.add_argument(
        "--include-columns",
        help=(
            "Llista de columnes a mantenir malgrat superar el llindar de "
            "cardinalitat, separades per comes (D-04); no evita mai "
            "l'exclusió incondicional de columnes de text lliure (D-02)"
        ),
    )
    parser.add_argument(
        "--date",
        default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        help="Data en format YYYY-MM-DD (per defecte: avui en UTC)",
    )
    parser.add_argument("--out-dir", default=Path("public/data"), type=Path, help="Directori de sortida")
    parser.add_argument("--sheet", help="Nom del full d'Excel (per defecte: el primer full)")
    parser.add_argument(
        "--list-columns",
        action="store_true",
        help="Mode d'inspecció: imprimeix les columnes detectades i surt sense escriure res",
    )
    parser.add_argument(
        "--confirm-privacy-review",
        action="store_true",
        help="Requerit per escriure després de revisar el checklist de privacitat imprès",
    )
    parser.add_argument(
        "--skip-privacy-review",
        action="store_true",
        help=(
            "Omet completament el càlcul del checklist de privacitat (no només "
            "el bloqueig per codi de sortida): només per a fonts la font de les "
            "quals ja és anonimitzada i verificada per l'operador. S'ha de "
            "passar explícitament a cada execució; mai s'infereix d'altres "
            "flags ni esdevé un valor per defecte."
        ),
    )
    args = parser.parse_args(argv)
    try:
        datetime.strptime(args.date, "%Y-%m-%d")
    except ValueError:
        parser.error(f"--date '{args.date}' ha de tenir el format YYYY-MM-DD i ser una data vàlida")
    if not args.list_columns:
        missing = [
            flag
            for flag, value in (
                ("--id", args.id),
                ("--title", args.title),
                ("--description", args.description),
            )
            if not value
        ]
        if missing:
            parser.error(f"{', '.join(missing)} són obligatoris tret que s'usi --list-columns")
    return args


def _resolve_output_paths(out_dir: Path, survey_id: str) -> tuple:
    """Resolves the three output paths and asserts they stay inside out_dir.

    Mirrors the resolveSafe discipline in scripts/gh-pages-preview.mjs.
    """
    resolved_root = out_dir.resolve()
    enquestes_dir = (resolved_root / "enquestes").resolve()
    parquet_path = (enquestes_dir / f"{survey_id}_respostes.parquet").resolve()
    meta_path = (enquestes_dir / f"{survey_id}_meta.json").resolve()
    index_path = (resolved_root / "enquestes_index.json").resolve()
    for candidate in (enquestes_dir, parquet_path, meta_path, index_path):
        if resolved_root != candidate and resolved_root not in candidate.parents:
            raise SystemExit(f"Camí de sortida fora del directori resolt: {candidate}")
    return parquet_path, meta_path, index_path


def main(argv: list | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)

    # 1. Reject an invalid --id before composing any output path. --id is
    #    optional in --list-columns mode (a read-only inspection step that
    #    writes nothing and doesn't need one yet); _parse_args already
    #    enforces --id is present outside that mode.
    if args.id is not None and not schema.is_valid_enquesta_id(args.id):
        print(
            f"ERROR: --id '{args.id}' no compleix el patró ^{schema.ENQUESTA_ID_PATTERN}$",
            file=sys.stderr,
        )
        return 1

    if not args.list_columns:
        parquet_path, meta_path, index_path = _resolve_output_paths(args.out_dir, args.id)

    # 2. Load the raw export (CSV/TSV/Excel), with encoding fallback and
    #    shape-sanity warnings that never auto-correct anything.
    try:
        df, load_warnings = load_mod.load_table(args.input_csv, args.sheet)
    except (ValueError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    # 3. Print the shape report and every warning before any other work, so
    #    a shifted header or a stray title/total row is caught on sight
    #    (RESEARCH Pitfall 5) before anything is written.
    print(load_mod.format_shape_report(df, load_warnings))
    for warning in load_warnings:
        print(f"AVÍS: {warning}", file=sys.stderr)
    print(f"Columnes detectades ({len(df.columns)}): {', '.join(str(c) for c in df.columns)}")
    print(f"Files detectades: {len(df)}")

    # 4. --list-columns inspection mode: print and exit without writing. Each
    #    line gets a D-01 threshold marker appended after the existing
    #    fields, derived from the same `distinct` value already computed
    #    here and the effective --max-cardinality, so an operator can see
    #    which columns the cardinality cutoff would drop by default without
    #    reading the source.
    if args.list_columns:
        print(f"Llindar de cardinalitat efectiu (--max-cardinality): {args.max_cardinality}")
        for col in df.columns:
            series = df[col]
            non_null = series.dropna()
            distinct = series.nunique(dropna=True)
            ratio = (distinct / len(series)) if len(series) else 0.0
            marker = (
                f"per sobre del llindar, es descartaria per defecte (>{args.max_cardinality})"
                if distinct > args.max_cardinality
                else f"dins del llindar (<={args.max_cardinality})"
            )
            # No sample/cell values are printed here (see CR-02): this mode
            # runs before any privacy screening (D-02 free-text drop, D-01
            # cardinality filter, privacy checklist), matching the
            # no-sample-values discipline already used by
            # format_high_cardinality_report in pipeline/infer.py.
            print(
                f"- {col}: dtype={series.dtype}, no-nuls={len(non_null)}, "
                f"distints={distinct}, ratio-unicitat={ratio:.2f}, "
                f"cardinalitat={marker}"
            )
        return 0

    # 5. Reduce to the allow-list when --columns is given (optional since this
    #    phase: absent means every loaded column carries forward into the
    #    free-text and cardinality filters below). Then validate
    #    --include-columns against whatever frame survives that reduction,
    #    before any drop takes effect. Then unconditionally drop free-text
    #    columns (D-02).
    if args.columns:
        requested_columns = [c.strip() for c in args.columns.split(",") if c.strip()]
        missing_columns = [c for c in requested_columns if c not in df.columns]
        if missing_columns:
            print(f"ERROR: columnes no trobades a l'export: {', '.join(missing_columns)}", file=sys.stderr)
            return 1
        duplicate_columns = sorted({c for c in requested_columns if requested_columns.count(c) > 1})
        if duplicate_columns:
            print(f"ERROR: columnes duplicades a --columns: {', '.join(duplicate_columns)}", file=sys.stderr)
            return 1
        df = df[requested_columns].copy()

    include_columns = (
        [c.strip() for c in args.include_columns.split(",") if c.strip()] if args.include_columns else []
    )
    unknown_include_columns = [c for c in include_columns if c not in df.columns]
    if unknown_include_columns:
        print(
            f"ERROR: columnes desconegudes a --include-columns: {', '.join(unknown_include_columns)}",
            file=sys.stderr,
        )
        return 1
    duplicate_include_columns = sorted({c for c in include_columns if include_columns.count(c) > 1})
    if duplicate_include_columns:
        print(
            f"ERROR: columnes duplicades a --include-columns: {', '.join(duplicate_include_columns)}",
            file=sys.stderr,
        )
        return 1

    # D-02 free-text drop runs BEFORE the D-01 cardinality filter below.
    # Free-text columns are typically also high cardinality; running
    # free-text first guarantees every free-text column is attributed to
    # D-02 in the printed output, never appears in the D-04 cardinality
    # report, and can never be resurrected by --include-columns -- which is
    # what keeps D-02's no-opt-out contract intact under the new override.
    dropped_free_text = [c for c in df.columns if infer.is_free_text_column(df[c])]
    if dropped_free_text:
        print(
            "Columnes de text lliure descartades (D-02, sense opció per mantenir-les): "
            + ", ".join(dropped_free_text)
        )
        df = df.drop(columns=dropped_free_text)

    if df.shape[1] == 0:
        print(
            "ERROR: cap columna sobreviu després de descartar les de text lliure "
            "(D-02); tria un --columns amb almenys una columna no-text-lliure.",
            file=sys.stderr,
        )
        return 1

    # 5b. D-01 cardinality filter: drop every column above --max-cardinality
    # distinct values, except any name listed in --include-columns (D-04).
    # The exclusion report is ALWAYS printed, even when nothing is dropped.
    dropped_high_cardinality = infer.high_cardinality_columns(df, args.max_cardinality, exempt=include_columns)
    print(infer.format_high_cardinality_report(dropped_high_cardinality, args.max_cardinality, exempt=include_columns))
    if dropped_high_cardinality:
        df = df.drop(columns=list(dropped_high_cardinality.keys()))

    if df.shape[1] == 0:
        print(
            "ERROR: cap columna sobreviu després del filtre de cardinalitat alta "
            "(D-01); usa --include-columns per mantenir-ne alguna concreta o "
            "--max-cardinality per pujar el llindar.",
            file=sys.stderr,
        )
        return 1

    # 6. Build fields first -- the small-group scan needs the dimension-typed
    #    column list, so field inference now runs before the checklist.
    fields = infer.build_fields(df)
    dimension_columns = [f["name"] for f in fields if f["type"] == "dimension"]

    # 7. Privacy checklist -- always prints, blocks by default. The
    #    acknowledgement is read only from the parsed CLI namespace on this
    #    invocation: no os.environ lookup, no config file, no persisted
    #    state can pre-satisfy the gate.
    #
    #    --skip-privacy-review bypasses the CHECKLIST COMPUTATION ITSELF, not
    #    just the block-by-default exit code: small_group_flags scans every
    #    2- and 3-column combination of dimension columns, which is
    #    combinatorial in column count and measured at ~55-75 minutes per
    #    real ~280-column export -- an unreasonable unattended runtime for a
    #    source the operator has already judged pre-anonymized. This is an
    #    explicit, one-run-at-a-time opt-in: it must never be inferred from
    #    another flag and must never become a default (see 04-02-SUMMARY.md
    #    for the recorded operator decision that motivated this flag).
    if args.skip_privacy_review:
        print(
            "Revisió de privacitat OMESA (--skip-privacy-review): decisió de "
            "l'operador registrada al resum del pla."
        )
    else:
        findings, unevaluated = privacy.run_privacy_checklist(df, dimension_columns)
        assessed_count = len(df.columns) - len(privacy.unevaluated_columns(df))
        print(privacy.format_checklist_report(findings, unevaluated, assessed_count))
        if findings and not args.confirm_privacy_review:
            print(
                "ERROR: el checklist de privacitat ha trobat indicis. Revisa'ls i torna a "
                "executar amb --confirm-privacy-review si vols continuar.",
                file=sys.stderr,
            )
            return 2

    # 8. Build kpis, warn on small-sample KPIs, assemble the dicts.
    kpis = infer.build_kpis(df, fields)
    for kpi in kpis:
        kpi_n = kpi.get("n")
        if kpi_n is not None and kpi_n < schema.MIN_KPI_SAMPLE:
            print(
                f"AVÍS: KPI '{kpi['label']}' té n={kpi_n}, per sota de "
                f"MIN_KPI_SAMPLE={schema.MIN_KPI_SAMPLE}",
                file=sys.stderr,
            )

    n = len(df)
    meta = {
        "id": args.id,
        "title": args.title,
        "date": args.date,
        "description": args.description,
        "n": n,
        "kpis": kpis,
        "fields": fields,
    }
    index_entry = {
        "id": args.id,
        "title": args.title,
        "date": args.date,
        "description": args.description,
        "n": n,
    }

    # 9. Structural validation before any write touches disk.
    schema.validate_meta(meta)

    # 10. Compute and validate the upserted index BEFORE any write touches
    #     disk -- a malformed existing sibling entry must never be persisted
    #     as a "successful" partial write. A corrupted or malformed existing
    #     enquestes_index.json (invalid JSON, or valid JSON that isn't a list
    #     of dicts) is reported as a clean ERROR here instead of an unhandled
    #     traceback (WR-01).
    try:
        new_index = index_mod.compute_upserted_index(index_path, index_entry)
        schema.validate_index(new_index)
    except (json.JSONDecodeError, schema.SchemaError) as exc:
        print(f"ERROR: {index_path} és invàlid: {exc}", file=sys.stderr)
        return 1

    # 11. Write the three artifacts. Each write is atomic (temp file in the
    #     same directory, then os.replace() onto the final path) so an
    #     interruption mid-write (Ctrl-C, disk full, power loss) can never
    #     leave a truncated/corrupt artifact on disk (WR-06); schema.write_json()
    #     already does this for meta/index, mirrored here for the Parquet write.
    parquet_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_parquet_path = parquet_path.with_name(parquet_path.name + ".tmp")
    df.to_parquet(tmp_parquet_path, engine="pyarrow", index=False)
    os.replace(tmp_parquet_path, parquet_path)
    schema.write_json(meta_path, meta)
    schema.write_json(index_path, new_index)

    # 12. Read the Parquet back and assert it matches the published contract.
    written_schema = pq.read_schema(parquet_path)
    field_names = {f["name"] for f in fields}
    if set(written_schema.names) != field_names:
        raise SystemExit(
            f"ERROR intern: columnes del parquet {sorted(written_schema.names)} no coincideixen "
            f"amb els fields publicats {sorted(field_names)}"
        )
    written_row_count = pq.ParquetFile(parquet_path).metadata.num_rows
    if written_row_count != n:
        raise SystemExit(
            f"ERROR intern: files del parquet ({written_row_count}) no coincideixen amb n ({n})"
        )

    print(f"OK: {args.id} -> {parquet_path}, {meta_path}, {index_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
