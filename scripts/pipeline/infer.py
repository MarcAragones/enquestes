"""Dimension/measure inference (D-03) and free-text detection (D-02)."""
from __future__ import annotations

import pandas as pd

# D-02 free-text detector thresholds. A column is free text when its mean
# non-null string length exceeds this, OR when it is near-unique AND still
# averages a meaningfully long string (catches short-but-unique free text).
FREE_TEXT_MEAN_LENGTH = 60

# D-01/D-02 cardinality cutoff. This is an ABSOLUTE distinct-value count, not
# a ratio of row count (D-02 deliberately chose not to scale the cutoff with
# row count -- a 24-row export and a 2000-row export both drop a column at
# the same distinct-value count). Independent of is_free_text_column above
# (D-03: neither filter widens or narrows the other) and of
# pipeline.privacy.UNIQUENESS_RATIO_THRESHOLD, which is a ratio, not a count.
MAX_DISTINCT_VALUES = 20


def infer_field_type(series: "pd.Series") -> str:
    """D-03's literal rule: numeric column -> measure, everything else -> dimension.

    No cardinality-based reclassification -- a 5-point Likert numeric column
    stays a measure. Catching a numeric identifier is the privacy checklist's
    job (see pipeline.privacy), not this function's.
    """
    coerced = pd.to_numeric(series, errors="coerce")
    if coerced.notna().sum() == series.notna().sum() and series.notna().any():
        return "measure"
    return "dimension"


def is_free_text_column(series: "pd.Series") -> bool:
    """D-02 detector: True for a string-typed column that reads as free text.

    Uses pd.api.types.is_string_dtype rather than `series.dtype == object`
    because pandas 3.x defaults string columns to its dedicated StringDtype
    backend, not the legacy object dtype -- an `== object` check would
    silently never match a real CSV text column on this pandas version.
    """
    if not pd.api.types.is_string_dtype(series):
        return False
    non_null = series.dropna().astype(str)
    if non_null.empty:
        return False
    mean_length = non_null.str.len().mean()
    if mean_length > FREE_TEXT_MEAN_LENGTH:
        return True
    distinct_ratio = non_null.nunique() / len(non_null)
    return distinct_ratio > 0.9 and mean_length > 25


def is_high_cardinality_column(series: "pd.Series", max_distinct: int = MAX_DISTINCT_VALUES) -> bool:
    """D-01/D-02: True when the column has strictly more than max_distinct
    distinct values. Uses the same series.nunique(dropna=True) convention
    already used by convert_enquesta.py's --list-columns output, so a column
    reported there and a column dropped here always agree. Strictly greater
    is load-bearing: exactly max_distinct is kept, one more is dropped.
    """
    distinct = series.nunique(dropna=True)
    return distinct > max_distinct


def high_cardinality_columns(df: "pd.DataFrame", max_distinct: int = MAX_DISTINCT_VALUES, exempt=None) -> dict:
    """Pure D-01 selector: ordered {column name: distinct count} for every
    column of df the cardinality predicate fires on, minus any name present
    in exempt (D-04's --include-columns override). exempt accepts any
    iterable of column names or None. Returns an empty dict when nothing
    qualifies.
    """
    exempt_set = set(exempt) if exempt else set()
    dropped = {}
    for col in df.columns:
        if col in exempt_set:
            continue
        if is_high_cardinality_column(df[col], max_distinct):
            dropped[col] = int(df[col].nunique(dropna=True))
    return dropped


def format_high_cardinality_report(dropped: dict, max_distinct: int = MAX_DISTINCT_VALUES, exempt=None) -> str:
    """D-04: ALWAYS renders a report, including the nothing-dropped case,
    following privacy.format_checklist_report's discipline of never printing
    a bare silent pass. Renders column names and integer distinct counts
    only -- never sample values, example values, or any cell content from
    the frame, since these are precisely the columns most likely to hold
    identifying values and this output is read, pasted, and committed into
    SUMMARY files.
    """
    lines = ["=== Columnes descartades per cardinalitat alta (D-01) ==="]
    lines.append(f"Llindar aplicat: MAX_DISTINCT_VALUES={max_distinct}")
    if not dropped:
        lines.append("Cap columna descartada per cardinalitat alta.")
    else:
        for col, count in dropped.items():
            lines.append(f"- {col}: {count} valors distints (> {max_distinct})")
    exempt_list = list(exempt) if exempt else []
    if exempt_list:
        lines.append(
            "Columnes exemptes del llindar via --include-columns: " + ", ".join(exempt_list)
        )
    else:
        lines.append("Columnes exemptes via --include-columns: cap.")
    return "\n".join(lines)


def build_fields(df: "pd.DataFrame") -> list:
    """One EnquestaMetaField dict per remaining column. label/description left unset."""
    return [{"name": name, "type": infer_field_type(df[name])} for name in df.columns]


def build_kpis(df: "pd.DataFrame", fields: list) -> list:
    """One KPI per measure column: mean of non-null values, with its own n.

    unit is intentionally omitted -- it cannot be inferred from data alone.
    A measure column with zero non-null values is skipped entirely.
    """
    kpis = []
    for field in fields:
        if field["type"] != "measure":
            continue
        col = df[field["name"]]
        non_null = col.dropna()
        if non_null.empty:
            continue
        kpis.append(
            {
                "label": field["name"],
                "value": round(float(non_null.mean()), 2),
                "n": int(non_null.shape[0]),
            }
        )
    return kpis
