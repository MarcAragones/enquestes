"""Privacy checklist findings and the block-by-default decision (DATA-03).

This tracer wires the block decision through with the first real heuristic
(near-unique column detection). Plan 02-02 adds the name-pattern and
small-group scans behind the same run_privacy_checklist signature -- it stays
a plain list-returning aggregator so that addition is a pure extension.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

UNIQUENESS_RATIO_THRESHOLD = 0.9
MIN_GROUP_SIZE = 5


@dataclass
class Finding:
    kind: str
    subject: str
    detail: str


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


def run_privacy_checklist(df: "pd.DataFrame") -> list:
    """Aggregates every privacy heuristic. Today: uniqueness_flags only."""
    return uniqueness_flags(df)


def format_checklist_report(findings: list) -> str:
    """Always renders a header, even when findings is empty."""
    lines = ["=== Revisió de privacitat ==="]
    if not findings:
        lines.append("Cap indici detectat.")
    else:
        for finding in findings:
            lines.append(f"[{finding.kind}] {finding.subject}: {finding.detail}")
    return "\n".join(lines)
