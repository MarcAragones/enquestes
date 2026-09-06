#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Retira una enquesta publicada: elimina la seva entrada de l'índex i els
seus dos fitxers d'artefactes sota --data-dir/enquestes/.

No llegeix cap dada tabular (sense pandas ni pyarrow) -- només manipula JSON
i el sistema de fitxers.

Ordre estricte al main(): rebutjar un --id invàlid abans de compondre cap
camí -> resoldre els tres camins objectiu amb la mateixa disciplina de
contenció que _resolve_output_paths de convert_enquesta.py ->
compute_index_without_id -> schema.validate_index -> schema.write_json
(atòmic) -> només llavors, unlink dels dos fitxers d'artefactes. Escriure
l'índex abans d'esborrar els fitxers és intencionat, no estilístic: si
l'script s'interromp entremig, l'únic estat possible és un fitxer orfe
(detectat i reportat per verify_publicacio.py), mai un índex que apunta a
fitxers que ja no existeixen (que trencaria el lloc en producció).

Sempre s'ha d'invocar via `uv run scripts/retirar_enquesta.py ...` -- mai
amb l'intèrpret `python3` del sistema.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pipeline import index as index_mod
from pipeline import schema


def _parse_args(argv: list) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Retira una enquesta publicada: elimina la seva entrada de "
            "enquestes_index.json i els seus fitxers <id>_respostes.parquet "
            "i <id>_meta.json sota --data-dir/enquestes/."
        )
    )
    parser.add_argument("--id", required=True, help="Identificador de l'enquesta a retirar")
    parser.add_argument(
        "--data-dir",
        default=Path("public/data"),
        type=Path,
        help="Directori que conté enquestes_index.json i enquestes/ (per defecte: public/data)",
    )
    return parser.parse_args(argv)


def _resolve_target_paths(data_dir: Path, survey_id: str) -> tuple:
    """Resolves the three target paths and asserts they stay inside data_dir.

    Mirrors convert_enquesta.py's _resolve_output_paths containment check
    verbatim: resolve the root, resolve each candidate, refuse any candidate
    that is neither the root itself nor has the root among its parents.
    """
    resolved_root = data_dir.resolve()
    enquestes_dir = (resolved_root / "enquestes").resolve()
    parquet_path = (enquestes_dir / f"{survey_id}_respostes.parquet").resolve()
    meta_path = (enquestes_dir / f"{survey_id}_meta.json").resolve()
    index_path = (resolved_root / "enquestes_index.json").resolve()
    for candidate in (enquestes_dir, parquet_path, meta_path, index_path):
        if resolved_root != candidate and resolved_root not in candidate.parents:
            raise SystemExit(f"Camí fora del directori resolt: {candidate}")
    return parquet_path, meta_path, index_path


def main(argv: list | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)

    # 1. Reject an invalid --id before composing any path.
    if not schema.is_valid_enquesta_id(args.id):
        print(
            f"ERROR: --id '{args.id}' no compleix el patró ^{schema.ENQUESTA_ID_PATTERN}$",
            file=sys.stderr,
        )
        return 1

    parquet_path, meta_path, index_path = _resolve_target_paths(args.data_dir, args.id)

    print(f"Retirant l'enquesta '{args.id}'")
    print(f"  índex:   {index_path}")
    print(f"  parquet: {parquet_path}")
    print(f"  meta:    {meta_path}")

    # 2. Compute the new index (never touches disk itself).
    try:
        new_index = index_mod.compute_index_without_id(index_path, args.id)
    except schema.SchemaError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    # 3. Validate before writing -- a malformed result must never be persisted.
    try:
        schema.validate_index(new_index)
    except schema.SchemaError as exc:
        print(f"ERROR: l'índex resultant no compleix l'esquema: {exc}", file=sys.stderr)
        return 1

    # 4. Write the index atomically. Only after this succeeds do we unlink
    #    the artifact files -- see module docstring for why this ordering
    #    is load-bearing, not stylistic.
    schema.write_json(index_path, new_index)

    # 5. Unlink the artifact files. This happens strictly after the index
    #    write above, so an interruption here can only ever leave an orphan
    #    file (which verify_publicacio.py detects and reports), never an
    #    index entry pointing at files that are already gone.
    removed = []
    for path in (parquet_path, meta_path):
        if path.exists():
            path.unlink()
            removed.append(str(path))
        else:
            print(f"AVÍS: '{path}' ja no existia", file=sys.stderr)

    print(f"OK: enquesta '{args.id}' retirada de l'índex; fitxers eliminats: {', '.join(removed) or '(cap)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
