"""Privacy checklist findings and the block-by-default decision (DATA-03).

Three heuristics feed the same run_privacy_checklist(df, dimension_columns)
aggregator:

- uniqueness_flags: per-column near-unique ratio (plan 02-01).
- name_hint_flags: column-name pattern match against known quasi-identifier
  terms, independent of a column's uniqueness ratio or inferred type -- this
  is what catches a low-cardinality postal-code column a ratio test alone
  would miss.
- small_group_flags: a lightweight k-anonymity scan over every 2- and
  3-column combination of dimension-typed columns.

A column (or combination) the heuristics could not actually assess is never
silently counted as clear -- it is reported through the same "unevaluated"
list the report renders under its own section.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from itertools import combinations

import pandas as pd

UNIQUENESS_RATIO_THRESHOLD = 0.9
MIN_GROUP_SIZE = 5
MAX_COMBINATION_SIZE = 3

# Both Catalan and English spellings of the classic re-identification
# quasi-identifiers (Sweeney-style zip+birthdate+gender vector).
QUASI_IDENTIFIER_NAME_HINTS = (
    "edat",
    "age",
    "naixement",
    "birth",
    "data de naixement",
    "codi postal",
    "codi_postal",
    "postal",
    "zip",
    "cp",
    "departament",
    "department",
    "carrec",
    "càrrec",
    "job title",
    "municipi",
    "poblacio",
    "població",
    "municipality",
    "genere",
    "gènere",
    "gender",
    "sexe",
)

# Short hints are guarded against false positives (e.g. "capacitat" matching
# "cp") by requiring a whole-token match rather than any substring.
_SHORT_HINTS = frozenset({"cp", "zip", "age"})


@dataclass
class Finding:
    kind: str
    subject: str
    detail: str


def _normalize_column_name(name: str) -> str:
    """Lowercases and strips accents so 'Codi Postal' and 'codi_postal' both match."""
    decomposed = unicodedata.normalize("NFKD", str(name))
    without_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return without_accents.lower()


def _tokenize(normalised: str) -> set:
    return {token for token in re.split(r"[^a-z0-9]+", normalised) if token}


def uniqueness_flags(df: "pd.DataFrame") -> list:
    """Flags every column whose distinct-value ratio exceeds the threshold.

    Reports column names and column-level statistics only -- never
    respondent-level cell values.
    """
    n = len(df)
    if n == 0:
        return []
    findings = []
    for col in df.columns:
        distinct = df[col].nunique(dropna=True)
        ratio = distinct / n
        if ratio > UNIQUENESS_RATIO_THRESHOLD:
            findings.append(
                Finding(
                    kind="near-unique",
                    subject=col,
                    detail=f"{distinct} valors diferents de {n} files (ràtio {ratio:.2f})",
                )
            )
    return findings


def name_hint_flags(df: "pd.DataFrame") -> list:
    """Flags every column whose name matches a known quasi-identifier hint.

    Fires regardless of the column's uniqueness ratio or inferred type --
    this is the heuristic that catches a low-cardinality postal-code column,
    which no ratio test will surface.
    """
    findings = []
    for col in df.columns:
        normalised = _normalize_column_name(col)
        tokens = _tokenize(normalised)
        for hint in QUASI_IDENTIFIER_NAME_HINTS:
            normalised_hint = _normalize_column_name(hint)
            matched = (
                normalised_hint in tokens
                if normalised_hint in _SHORT_HINTS
                else normalised_hint in normalised
            )
            if matched:
                findings.append(
                    Finding(
                        kind="quasi-identifier-name",
                        subject=col,
                        detail=f"el nom coincideix amb l'indici de quasi-identificador '{hint}'",
                    )
                )
                break
    return findings


def small_group_flags(df: "pd.DataFrame", dimension_columns: list) -> tuple:
    """Scans every 2- and 3-column combination of dimension_columns.

    Emits at most one Finding per combination (never one per group) naming
    the number of groups below MIN_GROUP_SIZE and the smallest group size
    found. Skips entirely -- recording the skip as unevaluated, never as a
    pass -- when fewer than two dimension columns exist or the frame has
    zero rows. Also records as unevaluated any combination whose distinct-
    group count reaches the row count: a combination that is itself
    degenerately near-unique (almost every row forms its own group), a
    pattern the per-column uniqueness check already covers independently.
    """
    findings = []
    unevaluated = []
    n = len(df)

    if len(dimension_columns) < 2 or n == 0:
        unevaluated.append(
            f"(combinacions de dimensió: només {len(dimension_columns)} columna(es) "
            f"disponible(s) per a {n} files, calen almenys 2)"
        )
        return findings, unevaluated

    for size in range(2, MAX_COMBINATION_SIZE + 1):
        for combo in combinations(dimension_columns, size):
            grouped = df.groupby(list(combo), dropna=False).size()
            if len(grouped) >= n:
                unevaluated.append(
                    ", ".join(combo) + " (combinació gairebé única, ja coberta per la ràtio d'unicitat)"
                )
                continue
            small = grouped[grouped < MIN_GROUP_SIZE]
            if len(small) > 0:
                findings.append(
                    Finding(
                        kind="small-group",
                        subject=", ".join(combo),
                        detail=(
                            f"{len(small)} grup(s) per sota de MIN_GROUP_SIZE="
                            f"{MIN_GROUP_SIZE} (mida mínima trobada: {int(small.min())})"
                        ),
                    )
                )
    return findings, unevaluated


def unevaluated_columns(df: "pd.DataFrame") -> list:
    """Columns the heuristics could not actually assess.

    An all-null column, or one of an unhashable dtype (nunique() would
    raise), is reported here rather than counted as clear.
    """
    unevaluated = []
    for col in df.columns:
        series = df[col]
        if series.isna().all():
            unevaluated.append(col)
            continue
        try:
            series.nunique(dropna=True)
        except TypeError:
            unevaluated.append(col)
    return unevaluated


def run_privacy_checklist(df: "pd.DataFrame", dimension_columns: list | None = None) -> tuple:
    """Aggregates every heuristic.

    Returns (findings, unevaluated) -- a column or combination the
    heuristics could not evaluate is always reported in `unevaluated`,
    never silently folded into a clean result.
    """
    if dimension_columns is None:
        dimension_columns = []
    findings = []
    findings.extend(uniqueness_flags(df))
    findings.extend(name_hint_flags(df))
    small_findings, small_unevaluated = small_group_flags(df, list(dimension_columns))
    findings.extend(small_findings)
    unevaluated = unevaluated_columns(df) + small_unevaluated
    return findings, unevaluated


def format_checklist_report(findings: list, unevaluated: list, assessed_count: int) -> str:
    """Always renders a header, the effective thresholds, per-finding detail,
    an explicit "no avaluades" section, and -- when there are no findings --
    an explicit statement naming how many columns were actually assessed.

    Never prints a bare "clear" without the assessed count; a report that
    says nothing was found while silently skipping half the columns is the
    exact failure this section exists to prevent. Reports column names and
    column-level statistics only, never respondent-level cell values.
    """
    lines = ["=== Revisió de privacitat ==="]
    lines.append(
        f"Llindars aplicats: UNIQUENESS_RATIO_THRESHOLD={UNIQUENESS_RATIO_THRESHOLD}, "
        f"MIN_GROUP_SIZE={MIN_GROUP_SIZE}"
    )
    if not findings:
        lines.append(f"Cap indici detectat ({assessed_count} columnes avaluades).")
    else:
        for finding in findings:
            lines.append(f"[{finding.kind}] {finding.subject}: {finding.detail}")
    if unevaluated:
        lines.append(f"No avaluades ({len(unevaluated)}): " + "; ".join(str(u) for u in unevaluated))
    else:
        lines.append("No avaluades: cap.")
    return "\n".join(lines)
