"""enquestes_index.json match-by-id upsert.

Fix for RESEARCH Pitfall 4 (duplicated or silently dropped sibling entries):
the whole array is loaded, the matching id is replaced in place (or the new
entry is appended if no id matches), and the whole array is written back --
never a rebuild from anything but the loaded array.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import schema


def upsert_index_entry(index_path: Path, new_entry: dict) -> list:
    if index_path.exists():
        existing = json.loads(index_path.read_text(encoding="utf-8"))
    else:
        existing = []

    replaced = False
    for i, entry in enumerate(existing):
        if entry.get("id") == new_entry.get("id"):
            existing[i] = new_entry
            replaced = True
            break
    if not replaced:
        existing.append(new_entry)

    schema.write_json(index_path, existing)
    return existing
