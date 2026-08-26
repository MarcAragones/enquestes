"""enquestes_index.json match-by-id upsert.

Fix for RESEARCH Pitfall 4 (duplicated or silently dropped sibling entries):
the whole array is loaded, the matching id is replaced in place (or the new
entry is appended if no id matches), and the whole array is returned for the
caller to validate -- never a rebuild from anything but the loaded array.

This module never writes to disk itself: callers MUST validate the returned
array with schema.validate_index() before calling schema.write_json(), so a
malformed result (including one already present on disk) can never be
persisted as a "successful" partial write.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import schema


def compute_upserted_index(index_path: Path, new_entry: dict) -> list:
    if index_path.exists():
        existing = json.loads(index_path.read_text(encoding="utf-8"))
        if not isinstance(existing, list) or not all(isinstance(e, dict) for e in existing):
            raise schema.SchemaError(f"'{index_path}' existent no és un array d'objectes vàlid")
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

    return existing
