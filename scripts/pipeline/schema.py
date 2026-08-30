"""Python mirror of src/types/enquesta.ts plus write-time structural validators.

No PEP 723 block here -- this module is imported by scripts/convert_enquesta.py
and scripts/pipeline_selftest.py, never run directly.
"""
from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path
from typing import Any, TypedDict, Union

ENQUESTA_ID_PATTERN = r"[A-Za-z0-9._-]{1,64}"
_ID_RE = re.compile(rf"^{ENQUESTA_ID_PATTERN}$")

# Sample size below which a KPI value should be treated with caution. Mirrors
# the client-side MIN_KPI_SAMPLE in src/lib/enquestes.ts. Used here only to
# print a console warning -- the app is the one that actually withholds.
MIN_KPI_SAMPLE = 10


def is_valid_enquesta_id(value: str) -> bool:
    """Reimplements isValidEnquestaId (src/lib/enquestes.ts:11-13) in Python."""
    return isinstance(value, str) and _ID_RE.fullmatch(value) is not None


class SchemaError(Exception):
    """Raised when a built dict does not match the EnquestaMeta / EnquestaIndexEntry shape."""


class EnquestaIndexEntry(TypedDict):
    id: str
    title: str
    date: str
    description: str
    n: Union[int, float]


class _EnquestaMetaKpiOptional(TypedDict, total=False):
    unit: str
    n: Union[int, float]


class EnquestaMetaKpi(_EnquestaMetaKpiOptional):
    label: str
    value: Union[str, int, float]


class _EnquestaMetaFieldOptional(TypedDict, total=False):
    label: str
    description: str


class EnquestaMetaField(_EnquestaMetaFieldOptional):
    name: str
    type: str  # "dimension" | "measure"


class _EnquestaMetaOptional(TypedDict, total=False):
    fields: list


class EnquestaMeta(_EnquestaMetaOptional):
    id: str
    title: str
    date: str
    description: str
    n: Union[int, float]
    kpis: list


def _is_finite_number(value: Any) -> bool:
    """True only for an int/float that is not a bool and is finite.

    Mirrors JS `typeof n === 'number' && Number.isFinite(n)` -- a JS boolean
    has typeof 'boolean', so a Python bool (which is an int subclass) must be
    explicitly excluded here to reproduce the same rejection.
    """
    if isinstance(value, bool):
        return False
    if not isinstance(value, (int, float)):
        return False
    return math.isfinite(value)


def _require_str(obj: dict, key: str) -> None:
    if not isinstance(obj.get(key), str):
        raise SchemaError(f"'{key}' must be a string")


def _require_finite_number(obj: dict, key: str) -> None:
    if not _is_finite_number(obj.get(key)):
        raise SchemaError(f"'{key}' must be a finite number")


def validate_index(obj: Any) -> None:
    """Reproduces parseEnquestesIndex's rejection conditions (src/lib/enquestes.ts:38-61)."""
    if not isinstance(obj, list):
        raise SchemaError("index must be an array")
    for entry in obj:
        if not isinstance(entry, dict):
            raise SchemaError("index entry must be an object")
        for key in ("id", "title", "date", "description"):
            _require_str(entry, key)
        _require_finite_number(entry, "n")


def validate_meta(obj: Any) -> None:
    """Reproduces parseEnquestaMeta's rejection conditions (src/lib/enquestes.ts:93-147)."""
    if not isinstance(obj, dict):
        raise SchemaError("meta must be an object")
    for key in ("id", "title", "date", "description"):
        _require_str(obj, key)
    _require_finite_number(obj, "n")

    kpis = obj.get("kpis")
    if not isinstance(kpis, list):
        raise SchemaError("'kpis' must be an array")
    for kpi in kpis:
        if not isinstance(kpi, dict):
            raise SchemaError("kpi must be an object")
        if not isinstance(kpi.get("label"), str):
            raise SchemaError("kpi 'label' must be a string")
        value = kpi.get("value")
        if not (isinstance(value, str) or _is_finite_number(value)):
            raise SchemaError("kpi 'value' must be a string or finite number")
        if "unit" in kpi and not isinstance(kpi["unit"], str):
            raise SchemaError("kpi 'unit' must be a string when present")
        if "n" in kpi and not _is_finite_number(kpi["n"]):
            raise SchemaError("kpi 'n' must be a finite number when present")

    fields = obj.get("fields")
    if fields is not None:
        if not isinstance(fields, list):
            raise SchemaError("'fields' must be an array when present")
        for field in fields:
            if not isinstance(field, dict):
                raise SchemaError("field must be an object")
            if not isinstance(field.get("name"), str):
                raise SchemaError("field 'name' must be a string")
            if "label" in field and not isinstance(field["label"], str):
                raise SchemaError("field 'label' must be a string when present")
            if "description" in field and not isinstance(field["description"], str):
                raise SchemaError("field 'description' must be a string when present")
            if field.get("type") not in ("dimension", "measure"):
                raise SchemaError("field 'type' must be 'dimension' or 'measure'")


def write_json(path: Path, obj: Any) -> None:
    """Writes UTF-8 JSON with literal accented characters (never \\uXXXX escapes).

    Writes atomically (temp file in the same directory, then os.replace()
    onto the final path) so an interruption mid-write (Ctrl-C, disk full,
    power loss) can never leave a truncated/corrupt meta.json or
    enquestes_index.json on disk (WR-06) -- the final path either has the
    old complete content or the new complete content, never a partial one.
    """
    path = Path(path)
    tmp_path = path.with_name(path.name + ".tmp")
    tmp_path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp_path, path)
