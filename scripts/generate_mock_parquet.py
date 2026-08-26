#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["pandas", "pyarrow"]
# ///
"""Genera una enquesta sintètica sense dades reals ni cap fitxer d'entrada.

Sempre s'ha d'invocar via `uv run scripts/generate_mock_parquet.py ...` -- mai
amb l'intèrpret `python3` del sistema (vegeu RESEARCH.md Pitfall 1: la versió
per defecte d'aquesta màquina és massa antiga per a pandas/pyarrow).

A diferència de convert_enquesta.py, aquest script no importa pipeline.privacy
ni accepta cap bandera de confirmació: totes les dades surten d'un
random.Random(seed) determinista, no hi ha cap respondent real a protegir.
"""
from __future__ import annotations

import argparse
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

from pipeline import index as index_mod
from pipeline import infer, schema

SEGMENTS = ["Particular", "Empresa", "Administració pública"]
CANALS = ["Web", "Telèfon", "Presencial", "Correu electrònic"]
TERRITORIS = ["Barcelona", "Girona", "Lleida", "Tarragona", "Terres de l'Ebre"]


def _parse_args(argv: list) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Genera una enquesta sintètica (sense dades reals) i escriu "
            "<id>_respostes.parquet, <id>_meta.json i una entrada upsertada a "
            "enquestes_index.json."
        )
    )
    parser.add_argument("--id", default="mostra-sintetica", help="Identificador de l'enquesta")
    parser.add_argument("--n", type=int, default=250, help="Nombre de respostes sintètiques a generar")
    parser.add_argument("--seed", type=int, default=42, help="Llavor per al generador determinista")
    parser.add_argument("--out-dir", default=Path("public/data"), type=Path, help="Directori de sortida")
    return parser.parse_args(argv)


def _resolve_output_paths(out_dir: Path, survey_id: str) -> tuple:
    """Resolves the three output paths and asserts they stay inside out_dir.

    Mirrors the same discipline as convert_enquesta.py's _resolve_output_paths.
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


def build_mock_frame(n: int, rng: random.Random) -> pd.DataFrame:
    """Builds a deterministic synthetic DataFrame with an explicit dtype schema.

    Explicit dtypes (not inferred from an empty list-of-dicts) so that n=0
    still produces a DataFrame with a real, non-object column schema pyarrow
    can write faithfully.
    """
    edat = pd.array([rng.randint(18, 75) for _ in range(n)], dtype="int64")
    satisfaccio = pd.array([rng.randint(1, 10) for _ in range(n)], dtype="int64")
    recomanaria = pd.array([rng.randint(0, 100) for _ in range(n)], dtype="int64")
    segment = pd.array([rng.choice(SEGMENTS) for _ in range(n)], dtype="string")
    canal = pd.array([rng.choice(CANALS) for _ in range(n)], dtype="string")
    territori = pd.array([rng.choice(TERRITORIS) for _ in range(n)], dtype="string")

    return pd.DataFrame(
        {
            "edat": edat,
            "satisfaccio": satisfaccio,
            "recomanaria": recomanaria,
            "segment": segment,
            "canal": canal,
            "territori": territori,
        }
    )


def main(argv: list | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)

    if not schema.is_valid_enquesta_id(args.id):
        print(
            f"ERROR: --id '{args.id}' no compleix el patró ^{schema.ENQUESTA_ID_PATTERN}$",
            file=sys.stderr,
        )
        return 1

    if args.n < 0:
        print(f"ERROR: --n ha de ser un enter no negatiu (rebut: {args.n})", file=sys.stderr)
        return 1

    parquet_path, meta_path, index_path = _resolve_output_paths(args.out_dir, args.id)

    rng = random.Random(args.seed)
    df = build_mock_frame(args.n, rng)

    fields = infer.build_fields(df)
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
        "title": "Enquesta de mostra (dades sintètiques)",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "description": (
            "Enquesta generada automàticament amb dades sintètiques: les respostes "
            "són aleatòries, no corresponen a cap persona real i existeixen només "
            "perquè es pugui desenvolupar i demostrar l'explorador interactiu."
        ),
        "n": n,
        "kpis": kpis,
        "fields": fields,
    }
    index_entry = {
        "id": args.id,
        "title": meta["title"],
        "date": meta["date"],
        "description": meta["description"],
        "n": n,
    }

    schema.validate_meta(meta)

    new_index = index_mod.compute_upserted_index(index_path, index_entry)
    schema.validate_index(new_index)

    parquet_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(parquet_path, engine="pyarrow", index=False)
    schema.write_json(meta_path, meta)
    schema.write_json(index_path, new_index)

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

    print(f"OK: {args.id} -> n={n} -> {parquet_path}, {meta_path}, {index_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
