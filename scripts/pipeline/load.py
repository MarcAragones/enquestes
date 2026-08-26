"""CSV/Excel loading with encoding fallback and shape sanity reporting (DATA-01).

D-04 stays honoured here: the .xlsx branch is a file-extension branch on one
export shape, not a multi-vendor abstraction layer -- no per-vendor header
mapping, no multi-sheet merging, no pre-aggregated-sheet handling.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

_ACCEPTED_SUFFIXES = (".csv", ".tsv", ".xlsx")


def load_table(path: "Path", sheet: str | None = None) -> tuple:
    """Loads path into a DataFrame. Returns (df, warnings).

    Branches on the lowercase file suffix: .csv/.tsv go to pd.read_csv
    (tab separator for .tsv), .xlsx goes to pd.read_excel(engine="openpyxl").
    Any other suffix raises ValueError naming the accepted suffixes.
    """
    path = Path(path)
    suffix = path.suffix.lower()
    warnings: list = []

    if suffix == ".csv":
        df, encoding_warning = _read_csv_with_fallback(path, sep=",")
    elif suffix == ".tsv":
        df, encoding_warning = _read_csv_with_fallback(path, sep="\t")
    elif suffix == ".xlsx":
        df = pd.read_excel(path, sheet_name=sheet or 0, engine="openpyxl")
        encoding_warning = None
    else:
        raise ValueError(
            f"Format no acceptat '{suffix}': només s'accepten "
            + ", ".join(_ACCEPTED_SUFFIXES)
        )

    if encoding_warning:
        warnings.append(encoding_warning)

    warnings.extend(_shape_warnings(df))
    return df, warnings


def _read_csv_with_fallback(path: "Path", sep: str) -> tuple:
    """Attempts utf-8 first; on UnicodeDecodeError retries with cp1252.

    Returns (df, warning_or_None). The fallback is never silent -- the
    caller always sees a warning string naming the non-UTF-8 fallback so
    accented Catalan characters can be spot-checked before being trusted.
    """
    try:
        return pd.read_csv(path, sep=sep, encoding="utf-8"), None
    except UnicodeDecodeError:
        df = pd.read_csv(path, sep=sep, encoding="cp1252")
        warning = (
            "El fitxer no és UTF-8 vàlid; s'ha llegit amb la codificació de "
            "pàgina de codis de Windows (cp1252) com a alternativa. "
            "Comprova els caràcters accentuats catalans abans de confiar-hi."
        )
        return df, warning


def _shape_warnings(df: "pd.DataFrame") -> list:
    """Shape sanity warnings -- never errors. Never auto-strips anything;
    printed so a shifted header or a stray title/total row is caught on
    sight (RESEARCH Pitfall 5), the multi-format complexity D-04 rules out.
    """
    warnings = []

    unnamed = [c for c in df.columns if str(c).startswith("Unnamed:")]
    if unnamed:
        warnings.append(
            "Columnes sense nom detectades (capçalera desplaçada o absent): "
            + ", ".join(unnamed)
        )

    seen: dict = {}
    blank = []
    for col in df.columns:
        name = str(col)
        if name.strip() == "":
            blank.append(col)
            continue
        seen[name] = seen.get(name, 0) + 1
    duplicated = [name for name, count in seen.items() if count > 1]
    if blank or duplicated:
        offenders = [str(c) for c in blank] + duplicated
        warnings.append("Noms de columna buits o duplicats: " + ", ".join(offenders))

    if len(df) == 0:
        warnings.append("El fitxer no conté cap fila de dades.")

    return warnings


def format_shape_report(df: "pd.DataFrame", warnings: list) -> str:
    """Printable text: column names with dtypes, row count, first/last 3 rows.

    This is the one place the pipeline surfaces whether D-01's one-row-per-
    respondent shape actually holds for the file in hand -- a human sanity
    check printed on every run, not an automatic title/total-row stripper.
    """
    lines = ["=== Forma de les dades carregades ==="]
    lines.append(f"Files: {len(df)}")
    lines.append("Columnes:")
    for col in df.columns:
        lines.append(f"  - {col}: {df[col].dtype}")
    lines.append("Primeres files:")
    lines.append(df.head(3).to_string())
    lines.append("Últimes files:")
    lines.append(df.tail(3).to_string())
    if warnings:
        lines.append("Avisos:")
        for warning in warnings:
            lines.append(f"  ! {warning}")
    return "\n".join(lines)
