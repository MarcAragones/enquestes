#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["pandas", "pyarrow"]
# ///
"""Verifica la integritat del conjunt publicat sota public/data/.

Reutilitza pipeline.schema.validate_index i validate_meta -- el mateix
contracte que convert_enquesta.py ja fa complir en escriure -- en comptes de
reimplementar-lo. Comprova la consistència índex <-> meta <-> Parquet i
detecta ids duplicats, fitxers orfes i discrepàncies de recompte de files o
de noms de columnes.

Mai llegeix cap valor de cel·la de cap Parquet: només compta files
(`ParquetFile(...).metadata.num_rows`) i llegeix noms de columnes
(`pq.read_schema(...).names`), totes dues operacions purament de metadades.

Sempre s'ha d'invocar via `uv run scripts/verify_publicacio.py ...` -- mai
amb l'intèrpret `python3` del sistema.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import pyarrow.parquet as pq

from pipeline import schema

# Matches "<id>_respostes.parquet" or "<id>_meta.json" -- the two artifact
# filenames every index entry must resolve to (mirrors
# convert_enquesta.py's _resolve_output_paths naming convention).
_ARTIFACT_RE = re.compile(r"^(?P<id>.+)_(?:respostes\.parquet|meta\.json)$")


def _parse_args(argv: list) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Verifica que enquestes_index.json, cada <id>_meta.json i cada "
            "<id>_respostes.parquet sota --data-dir són mútuament "
            "consistents: sense ids duplicats, sense fitxers orfes, i amb "
            "recomptes de files i conjunts de noms de columnes coincidents."
        )
    )
    parser.add_argument(
        "--data-dir",
        default=Path("public/data"),
        type=Path,
        help=(
            "Directori que conté enquestes_index.json i el subdirectori "
            "enquestes/ (per defecte: public/data)"
        ),
    )
    parser.add_argument(
        "--expect-ids",
        help=(
            "Llista d'ids separats per comes que l'índex ha de contenir "
            "exactament, ni de més ni de menys (opcional)"
        ),
    )
    return parser.parse_args(argv)


def _duplicate_ids(ids: list) -> list:
    counts = Counter(ids)
    return sorted(i for i, c in counts.items() if c > 1)


def _invalid_ids(ids: list) -> list:
    return sorted({i for i in ids if not schema.is_valid_enquesta_id(i)})


def main(argv: list | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    data_dir = Path(args.data_dir)
    index_path = data_dir / "enquestes_index.json"
    enquestes_dir = data_dir / "enquestes"

    lines = ["=== Verificació de publicació ===", f"Directori de dades: {data_dir}"]
    failures: list[tuple[str, str]] = []

    if not index_path.exists():
        lines.append(f"ERROR: no existeix {index_path}")
        print("\n".join(lines))
        return 1

    try:
        index_obj = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        lines.append(f"ERROR: {index_path} no es pot llegir o parsejar: {exc}")
        print("\n".join(lines))
        return 1

    try:
        schema.validate_index(index_obj)
    except schema.SchemaError as exc:
        lines.append(f"ERROR: {index_path} no compleix l'esquema d'índex: {exc}")
        print("\n".join(lines))
        return 1

    if not index_obj:
        lines.append("ERROR: l'índex no conté cap enquesta (0 enquestes verificades).")
        print("\n".join(lines))
        return 1

    ids = [entry.get("id") for entry in index_obj]

    duplicate_ids = _duplicate_ids(ids)
    if duplicate_ids:
        failures.append(("(índex)", f"ids duplicats a l'índex: {', '.join(duplicate_ids)}"))

    invalid_ids = _invalid_ids(ids)
    if invalid_ids:
        failures.append(
            (
                "(índex)",
                f"ids invàlids (no compleixen ^{schema.ENQUESTA_ID_PATTERN}$): "
                + ", ".join(invalid_ids),
            )
        )

    if args.expect_ids is not None:
        expected = {i.strip() for i in args.expect_ids.split(",") if i.strip()}
        actual = set(ids)
        missing = sorted(expected - actual)
        unexpected = sorted(actual - expected)
        if missing:
            failures.append(("(índex)", "--expect-ids: falten a l'índex: " + ", ".join(missing)))
        if unexpected:
            failures.append(
                ("(índex)", "--expect-ids: presents a l'índex però no esperats: " + ", ".join(unexpected))
            )

    known_ids = set(ids)

    for entry in index_obj:
        survey_id = entry.get("id", "(sense id)")
        parquet_path = enquestes_dir / f"{survey_id}_respostes.parquet"
        meta_path = enquestes_dir / f"{survey_id}_meta.json"

        n_display = "N/A"
        cols_display = "N/A"
        meta_obj = None
        written_row_count = None
        written_names = None

        parquet_ok = parquet_path.exists() and parquet_path.stat().st_size > 0
        if not parquet_ok:
            failures.append((survey_id, f"manca o és buit {parquet_path}"))

        meta_ok = meta_path.exists() and meta_path.stat().st_size > 0
        if not meta_ok:
            failures.append((survey_id, f"manca o és buit {meta_path}"))
        else:
            try:
                meta_obj = json.loads(meta_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                failures.append((survey_id, f"{meta_path} no es pot llegir o parsejar: {exc}"))
                meta_obj = None

            if meta_obj is not None:
                try:
                    schema.validate_meta(meta_obj)
                except schema.SchemaError as exc:
                    failures.append((survey_id, f"{meta_path} no compleix l'esquema de meta: {exc}"))

                for key in ("id", "title", "date", "description", "n"):
                    if meta_obj.get(key) != entry.get(key):
                        failures.append(
                            (
                                survey_id,
                                f"meta.{key} ({meta_obj.get(key)!r}) difereix de "
                                f"l'entrada de l'índex ({entry.get(key)!r})",
                            )
                        )

        if parquet_ok:
            try:
                written_row_count = pq.ParquetFile(parquet_path).metadata.num_rows
                written_names = pq.read_schema(parquet_path).names
                n_display = str(written_row_count)
                cols_display = str(len(written_names))
            except Exception as exc:  # pyarrow raises assorted error types on a corrupt file
                failures.append((survey_id, f"{parquet_path} no es pot llegir com a Parquet: {exc}"))

        if meta_obj is not None and written_row_count is not None:
            meta_n = meta_obj.get("n")
            if meta_n != written_row_count:
                failures.append(
                    (
                        survey_id,
                        f"meta.n ({meta_n}) no coincideix amb les files del parquet ({written_row_count})",
                    )
                )

        if meta_obj is not None and written_names is not None:
            meta_fields = meta_obj.get("fields")
            if not isinstance(meta_fields, list):
                failures.append((survey_id, "meta.fields és absent o no és una llista"))
            else:
                meta_field_names = {f.get("name") for f in meta_fields if isinstance(f, dict)}
                if meta_field_names != set(written_names):
                    failures.append(
                        (survey_id, "els noms de 'fields' del meta no coincideixen amb les columnes del parquet")
                    )

        lines.append(f"- {survey_id}: n={n_display}, columnes={cols_display}")

    # Orphan detection: any artifact file under enquestes/ whose id has no
    # corresponding index entry -- invisible to the site but permanently public.
    if enquestes_dir.is_dir():
        for path in sorted(enquestes_dir.iterdir()):
            if not path.is_file():
                continue
            match = _ARTIFACT_RE.match(path.name)
            if not match:
                continue
            file_id = match.group("id")
            if file_id not in known_ids:
                failures.append((file_id, f"fitxer orfe sense entrada a l'índex: {path.name}"))

    if failures:
        for subject, description in failures:
            lines.append(f"FALLADA [{subject}]: {description}")
        print("\n".join(lines))
        return 1

    lines.append(f"Totes les comprovacions han passat ({len(index_obj)} enquestes verificades).")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
