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
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

from pipeline import index as index_mod
from pipeline import infer, privacy, schema


def _parse_args(argv: list) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Converteix un export CSV cru en <id>_respostes.parquet, "
            "<id>_meta.json i una entrada upsertada a enquestes_index.json."
        )
    )
    parser.add_argument("input_csv", type=Path, help="Camí a l'export CSV")
    parser.add_argument("--id", required=True, help="Identificador de l'enquesta")
    parser.add_argument("--columns", help="Llista de columnes permeses, separades per comes")
    parser.add_argument("--title", help="Títol de l'enquesta")
    parser.add_argument("--description", help="Descripció de l'enquesta")
    parser.add_argument(
        "--date",
        default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        help="Data en format YYYY-MM-DD (per defecte: avui en UTC)",
    )
    parser.add_argument("--out-dir", default=Path("public/data"), type=Path, help="Directori de sortida")
    parser.add_argument("--sheet", help="Nom del full d'Excel (reservat per al pla 02-02)")
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
    args = parser.parse_args(argv)
    if not args.list_columns:
        missing = [
            flag
            for flag, value in (
                ("--columns", args.columns),
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

    # 1. Reject an invalid --id before composing any output path.
    if not schema.is_valid_enquesta_id(args.id):
        print(
            f"ERROR: --id '{args.id}' no compleix el patró ^{schema.ENQUESTA_ID_PATTERN}$",
            file=sys.stderr,
        )
        return 1

    parquet_path, meta_path, index_path = _resolve_output_paths(args.out_dir, args.id)

    # 2. Load the raw CSV.
    df = pd.read_csv(args.input_csv, encoding="utf-8")
    print(f"Columnes detectades ({len(df.columns)}): {', '.join(df.columns)}")
    print(f"Files detectades: {len(df)}")

    # 3. --list-columns inspection mode: print and exit without writing.
    if args.list_columns:
        for col in df.columns:
            series = df[col]
            non_null = series.dropna()
            distinct = series.nunique(dropna=True)
            ratio = (distinct / len(series)) if len(series) else 0.0
            samples = list(non_null.astype(str).unique()[:3])
            print(
                f"- {col}: dtype={series.dtype}, no-nuls={len(non_null)}, "
                f"distints={distinct}, ratio-unicitat={ratio:.2f}, mostres={samples}"
            )
        return 0

    # 4. Reduce to the allow-list, then unconditionally drop free-text columns (D-02).
    requested_columns = [c.strip() for c in args.columns.split(",") if c.strip()]
    missing_columns = [c for c in requested_columns if c not in df.columns]
    if missing_columns:
        print(f"ERROR: columnes no trobades a l'export: {', '.join(missing_columns)}", file=sys.stderr)
        return 1
    df = df[requested_columns].copy()

    dropped_free_text = [c for c in df.columns if infer.is_free_text_column(df[c])]
    if dropped_free_text:
        print(
            "Columnes de text lliure descartades (D-02, sense opció per mantenir-les): "
            + ", ".join(dropped_free_text)
        )
        df = df.drop(columns=dropped_free_text)

    # 5. Build fields first -- the small-group scan needs the dimension-typed
    #    column list, so field inference now runs before the checklist.
    fields = infer.build_fields(df)
    dimension_columns = [f["name"] for f in fields if f["type"] == "dimension"]

    # 6. Privacy checklist -- always prints, blocks by default. The
    #    acknowledgement is read only from the parsed CLI namespace on this
    #    invocation: no os.environ lookup, no config file, no persisted
    #    state can pre-satisfy the gate.
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

    # 7. Build kpis, warn on small-sample KPIs, assemble the dicts.
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

    # 8. Structural validation before any write touches disk.
    schema.validate_meta(meta)

    # 9. Write the three artifacts.
    parquet_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(parquet_path, engine="pyarrow", index=False)
    schema.write_json(meta_path, meta)
    new_index = index_mod.upsert_index_entry(index_path, index_entry)
    schema.validate_index(new_index)

    # 10. Read the Parquet back and assert it matches the published contract.
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
