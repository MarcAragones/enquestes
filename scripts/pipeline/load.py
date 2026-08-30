"""CSV/Excel loading with encoding fallback and shape sanity reporting (DATA-01).

D-04 stays honoured here: the .xlsx branch is a file-extension branch on one
export shape, not a multi-vendor abstraction layer -- no per-vendor header
mapping, no multi-sheet merging, no pre-aggregated-sheet handling.

.csv delimiter detection: some export tools (notably Spanish/Catalan-locale
spreadsheet software) write ';' as the field delimiter instead of ','. The
header line is sniffed to pick whichever of ',' / ';' occurs more often, so
these exports load without the caller having to know or pass a flag. This is
never silent -- picking ';' over the default ',' always produces a warning.
"""
from __future__ import annotations

import csv
from pathlib import Path

import pandas as pd

_ACCEPTED_SUFFIXES = (".csv", ".tsv", ".xlsx")


def load_table(path: "Path", sheet: str | None = None) -> tuple:
    """Loads path into a DataFrame. Returns (df, warnings).

    Branches on the lowercase file suffix: .csv/.tsv go to pd.read_csv
    (tab separator for .tsv; sniffed ',' vs ';' for .csv), .xlsx goes to
    pd.read_excel(engine="openpyxl"). Any other suffix raises ValueError
    naming the accepted suffixes.
    """
    path = Path(path)
    suffix = path.suffix.lower()
    warnings: list = []
    raw_header_tokens: list | None = None

    if suffix == ".csv":
        sep, sniff_warning = _detect_csv_delimiter(path)
        if sniff_warning:
            warnings.append(sniff_warning)
        raw_header_tokens = _read_raw_header_tokens(path, sep)
        df, encoding_warning = _read_csv_with_fallback(path, sep=sep)
    elif suffix == ".tsv":
        raw_header_tokens = _read_raw_header_tokens(path, "\t")
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

    warnings.extend(_shape_warnings(df, raw_header_tokens))
    return df, warnings


def _read_raw_header_tokens(path: "Path", sep: str) -> list:
    """Reads and quote-aware-splits the raw header line of a .csv/.tsv file,
    before pandas has a chance to auto-mangle duplicate column names (e.g.
    two raw 'Q1' headers becoming 'Q1' and 'Q1.1'). Used by `_shape_warnings`
    to detect genuinely duplicated raw headers (WR-04) -- a check that is
    unreachable once df.columns has already been disambiguated by pandas.
    Reads with the same utf-8-then-cp1252 fallback used elsewhere.
    """
    try:
        with open(path, "r", encoding="utf-8", newline="") as handle:
            header_line = handle.readline()
    except UnicodeDecodeError:
        with open(path, "r", encoding="cp1252", newline="") as handle:
            header_line = handle.readline()
    try:
        return next(csv.reader([header_line], delimiter=sep))
    except StopIteration:
        return []


def _detect_csv_delimiter(path: "Path") -> tuple:
    """Sniffs ',' vs ';' from the header line of a .csv file.

    Returns (delimiter, warning_or_None). Reads the header with the same
    utf-8-then-cp1252 fallback as the real load, since a non-UTF-8 file's
    header would otherwise fail to decode here first.

    Uses `csv.Sniffer` (quote-aware) restricted to the two candidate
    delimiters, so a quoted free-text header cell containing the *other*
    candidate character (e.g. a ';'-delimited export whose first header is
    `"Q1: valora, en general, el servei"`) does not get miscounted the way
    a raw `header_line.count(",")` would (WR-03). Falls back to the
    previous raw-count heuristic (ties, including 0-vs-0, default to ',')
    only if the sniffer can't determine a dialect at all (e.g. a
    single-column header with neither delimiter present).

    Only sniffs ',' vs ';' -- not a general-purpose dialect detector -- per
    D-04 (this pipeline targets one known export convention, not arbitrary
    third-party CSV dialects).
    """
    try:
        with open(path, "r", encoding="utf-8", newline="") as handle:
            header_line = handle.readline()
    except UnicodeDecodeError:
        with open(path, "r", encoding="cp1252", newline="") as handle:
            header_line = handle.readline()

    try:
        delimiter = csv.Sniffer().sniff(header_line, delimiters=",;").delimiter
    except csv.Error:
        comma_count = header_line.count(",")
        semicolon_count = header_line.count(";")
        delimiter = ";" if semicolon_count > comma_count else ","

    if delimiter == ";":
        warning = (
            "El fitxer sembla delimitat per ';' en lloc de ',' (convenció "
            "habitual d'exportació de fulls de càlcul en català/castellà); "
            "s'ha detectat i usat ';' automàticament com a separador de camps."
        )
        return ";", warning
    return ",", None


def _read_csv_with_fallback(path: "Path", sep: str) -> tuple:
    """Attempts utf-8 first; on UnicodeDecodeError retries with cp1252.

    Returns (df, warning_or_None). The fallback is never silent -- the
    caller always sees a warning string naming the non-UTF-8 fallback so
    accented Catalan characters can be spot-checked before being trusted.

    A pd.errors.ParserError (row(s) with a field count that doesn't match
    the header -- a genuinely ragged file, not an encoding issue) is
    re-raised as a ValueError naming the exact pandas-reported line so the
    caller gets an actionable message instead of a raw pandas traceback.
    Nothing here attempts to guess/repair a ragged row's column alignment.
    """
    try:
        return _read_csv_or_raise(path, sep, encoding="utf-8"), None
    except UnicodeDecodeError:
        df = _read_csv_or_raise(path, sep, encoding="cp1252")
        warning = (
            "El fitxer no és UTF-8 vàlid; s'ha llegit amb la codificació de "
            "pàgina de codis de Windows (cp1252) com a alternativa. "
            "Comprova els caràcters accentuats catalans abans de confiar-hi."
        )
        return df, warning


def _read_csv_or_raise(path: "Path", sep: str, encoding: str) -> "pd.DataFrame":
    """Reads path with pandas, always with low_memory=False.

    A real ~300-column export (REO1151) surfaced pandas' default chunked
    dtype inference (low_memory=True) silently reading a single numeric-
    looking column (e.g. birth year) as a MIX of int and str cells across
    internal read-buffer boundaries once the file is wide/large enough --
    doubling that column's nunique() count (159 vs the true 81) because
    int 1963 and str '1963' compare as distinct values. This corrupts the
    D-01 cardinality filter and the privacy checklist's uniqueness ratio
    without ever raising or printing anything. low_memory=False forces a
    single full-file dtype-inference pass, eliminating the inconsistency;
    it is always applied, not conditionally detected, so no warning is
    appended -- there is no ambiguous interpretation to disclose here,
    only an internal pandas footgun to avoid.
    """
    try:
        return pd.read_csv(path, sep=sep, encoding=encoding, low_memory=False)
    except pd.errors.ParserError as exc:
        raise ValueError(
            f"El fitxer CSV té almenys una fila amb un nombre de camps "
            f"diferent del de la capçalera (separador '{sep}'): {exc}. "
            "Sol ser un camp de text lliure amb el separador dins del valor "
            "sense cometes. Revisa la línia indicada abans de tornar-ho a "
            "provar."
        ) from exc


def _count_names(names) -> dict:
    """Counts occurrences of each non-blank stringified name."""
    counts: dict = {}
    for name in names:
        name = str(name)
        if name.strip() == "":
            continue
        counts[name] = counts.get(name, 0) + 1
    return counts


def _shape_warnings(df: "pd.DataFrame", raw_header_tokens: list | None = None) -> list:
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

    blank = [c for c in df.columns if str(c).strip() == ""]

    # pandas auto-mangles duplicate header names (e.g. two raw 'Q1' headers
    # become 'Q1' and 'Q1.1') before df.columns is ever built, so a
    # duplicate check against df.columns can essentially never fire for a
    # genuinely duplicated raw header (WR-04). When the raw, pre-mangle
    # header tokens are available (CSV/TSV -- already read once for
    # delimiter handling), scan those instead; only .xlsx falls back to the
    # (largely unreachable, but harmless) df.columns-based check.
    counts = _count_names(raw_header_tokens if raw_header_tokens is not None else df.columns)
    duplicated = [name for name, count in counts.items() if count > 1]

    if blank or duplicated:
        offenders = [str(c) for c in blank] + duplicated
        warnings.append("Noms de columna buits o duplicats: " + ", ".join(offenders))

    if len(df) == 0:
        warnings.append("El fitxer no conté cap fila de dades.")

    return warnings


def format_shape_report(df: "pd.DataFrame", warnings: list) -> str:
    """Printable text: column names with dtypes and row count only.

    This is the one place the pipeline surfaces whether D-01's one-row-per-
    respondent shape actually holds for the file in hand -- a human sanity
    check printed on every run. It deliberately never prints raw cell
    values (no head/tail row dump): this report runs before any privacy
    screening (free-text drop, cardinality filter, privacy checklist) has
    had a chance to run, on every conversion of real respondent data, and
    this codebase's own established discipline (see
    `pipeline/infer.py`'s `format_high_cardinality_report`) is to never
    print sample/cell values precisely because this kind of console output
    gets read, pasted, and committed into SUMMARY files.
    """
    lines = ["=== Forma de les dades carregades ==="]
    lines.append(f"Files: {len(df)}")
    lines.append("Columnes:")
    for col in df.columns:
        lines.append(f"  - {col}: {df[col].dtype}")
    if warnings:
        lines.append("Avisos:")
        for warning in warnings:
            lines.append(f"  ! {warning}")
    return "\n".join(lines)
