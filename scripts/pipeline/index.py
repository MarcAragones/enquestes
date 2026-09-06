"""enquestes_index.json match-by-id upsert and removal.

Fix for RESEARCH Pitfall 4 (duplicated or silently dropped sibling entries):
the whole array is loaded, the matching id is replaced in place (or the new
entry is appended if no id matches), and the whole array is returned for the
caller to validate -- never a rebuild from anything but the loaded array.

This module now owns both directions of the index mutation: upserting an
entry (`compute_upserted_index`) and removing one (`compute_index_without_id`).
It never writes to disk itself: callers MUST validate the returned array with
schema.validate_index() before calling schema.write_json(), so a malformed
result (including one already present on disk) can never be persisted as a
"successful" partial write.
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


def compute_index_without_id(index_path: Path, survey_id: str) -> list:
    """Returns the loaded array with the single entry matching survey_id
    removed, every sibling untouched and in original order.

    Raises schema.SchemaError when the index file does not exist or is not
    an array of objects (same rejection compute_upserted_index performs),
    and when no entry matches survey_id -- a no-op removal is a caller
    error, never a silent success.
    """
    if not index_path.exists():
        raise schema.SchemaError(f"'{index_path}' no existeix")

    existing = json.loads(index_path.read_text(encoding="utf-8"))
    if not isinstance(existing, list) or not all(isinstance(e, dict) for e in existing):
        raise schema.SchemaError(f"'{index_path}' existent no és un array d'objectes vàlid")

    if not any(entry.get("id") == survey_id for entry in existing):
        raise schema.SchemaError(f"cap entrada amb id '{survey_id}' a '{index_path}'")

    return [entry for entry in existing if entry.get("id") != survey_id]
