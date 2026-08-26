"""Dimension/measure inference (D-03) and free-text detection (D-02)."""
from __future__ import annotations

import pandas as pd

# D-02 free-text detector thresholds. A column is free text when its mean
# non-null string length exceeds this, OR when it is near-unique AND still
# averages a meaningfully long string (catches short-but-unique free text).
FREE_TEXT_MEAN_LENGTH = 60


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
