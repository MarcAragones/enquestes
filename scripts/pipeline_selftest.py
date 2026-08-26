#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["pandas", "pyarrow", "openpyxl"]
# ///
"""Self-test suite over scripts/pipeline/* against the Phase 1 golden fixtures.

Lives directly in scripts/ so `import pipeline.schema` resolves the same way
it does for scripts/convert_enquesta.py (the script's own directory is
sys.path[0]). Stdlib unittest only -- no pytest, matching the repo's
dependency-free script posture.

Run with `uv run scripts/pipeline_selftest.py -v`.
"""
from __future__ import annotations

import json
import shutil
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd

from pipeline import index as index_mod
from pipeline import infer, privacy, schema
from pipeline import load as load_mod

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
GOLDEN_INDEX = FIXTURES_DIR / "enquestes_index.json"
GOLDEN_META = FIXTURES_DIR / "enquestes" / "demo-2024_meta.json"
RAW_TRACER_CSV = FIXTURES_DIR / "raw" / "mostra-tracer.csv"


class UpsertIndexEntryTests(unittest.TestCase):
    def test_replacing_existing_id_leaves_siblings_untouched(self):
        with TemporaryDirectory() as tmp:
            index_path = Path(tmp) / "enquestes_index.json"
            shutil.copy(GOLDEN_INDEX, index_path)
            original = json.loads(GOLDEN_INDEX.read_text(encoding="utf-8"))

            new_entry = {
                "id": "demo-2024",
                "title": "Enquesta de demostració 2024 (actualitzada)",
                "date": "2024-11-05",
                "description": "Descripció actualitzada.",
                "n": 300,
            }
            result = index_mod.upsert_index_entry(index_path, new_entry)

            self.assertEqual(len(result), len(original))
            replaced = next(e for e in result if e["id"] == "demo-2024")
            self.assertEqual(replaced["title"], new_entry["title"])
            self.assertEqual(replaced["n"], 300)

            for original_entry in original:
                if original_entry["id"] == "demo-2024":
                    continue
                matching = next(e for e in result if e["id"] == original_entry["id"])
                self.assertEqual(matching, original_entry)

    def test_appending_new_id_grows_by_one(self):
        with TemporaryDirectory() as tmp:
            index_path = Path(tmp) / "enquestes_index.json"
            shutil.copy(GOLDEN_INDEX, index_path)
            original = json.loads(GOLDEN_INDEX.read_text(encoding="utf-8"))

            new_entry = {
                "id": "nova-enquesta",
                "title": "Nova enquesta",
                "date": "2026-01-01",
                "description": "Nova.",
                "n": 10,
            }
            result = index_mod.upsert_index_entry(index_path, new_entry)

            self.assertEqual(len(result), len(original) + 1)
            for original_entry in original:
                matching = next(e for e in result if e["id"] == original_entry["id"])
                self.assertEqual(matching, original_entry)

    def test_missing_index_file_creates_one_element_array(self):
        with TemporaryDirectory() as tmp:
            index_path = Path(tmp) / "does-not-exist-yet.json"
            new_entry = {
                "id": "sol",
                "title": "Sol",
                "date": "2026-01-01",
                "description": "Sol.",
                "n": 1,
            }
            result = index_mod.upsert_index_entry(index_path, new_entry)
            self.assertEqual(result, [new_entry])
            self.assertTrue(index_path.exists())


class WriteJsonTests(unittest.TestCase):
    def test_round_trip_preserves_literal_accented_characters(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "out.json"
            schema.write_json(path, {"title": "Satisfacció de clients"})
            raw = path.read_bytes()
            text = raw.decode("utf-8")
            self.assertIn("Satisfacció", text)
            self.assertNotIn("\\u00", text)


class ValidateMetaTests(unittest.TestCase):
    def test_accepts_golden_fixture_unchanged(self):
        obj = json.loads(GOLDEN_META.read_text(encoding="utf-8"))
        schema.validate_meta(obj)  # must not raise

    def test_rejects_kpi_value_bool(self):
        obj = _base_meta(kpis=[{"label": "x", "value": True}])
        with self.assertRaises(schema.SchemaError):
            schema.validate_meta(obj)

    def test_rejects_kpi_value_nan(self):
        obj = _base_meta(kpis=[{"label": "x", "value": float("nan")}])
        with self.assertRaises(schema.SchemaError):
            schema.validate_meta(obj)

    def test_rejects_field_type_metric(self):
        obj = _base_meta(fields=[{"name": "x", "type": "metric"}])
        with self.assertRaises(schema.SchemaError):
            schema.validate_meta(obj)

    def test_rejects_unit_as_number(self):
        obj = _base_meta(kpis=[{"label": "x", "value": 1, "unit": 5}])
        with self.assertRaises(schema.SchemaError):
            schema.validate_meta(obj)

    def test_rejects_missing_kpis_key(self):
        obj = _base_meta()
        del obj["kpis"]
        with self.assertRaises(schema.SchemaError):
            schema.validate_meta(obj)


class ValidateIndexTests(unittest.TestCase):
    def test_accepts_golden_fixture_unchanged(self):
        obj = json.loads(GOLDEN_INDEX.read_text(encoding="utf-8"))
        schema.validate_index(obj)  # must not raise

    def test_rejects_entry_with_string_n(self):
        obj = [
            {"id": "x", "title": "T", "date": "2026-01-01", "description": "D", "n": "42"}
        ]
        with self.assertRaises(schema.SchemaError):
            schema.validate_index(obj)


class InferFieldTypeTests(unittest.TestCase):
    def test_integer_series_is_measure(self):
        self.assertEqual(infer.infer_field_type(pd.Series([1, 2, 3])), "measure")

    def test_object_series_of_quoted_digits_is_measure(self):
        series = pd.Series(["1", "2", "3"], dtype=object)
        self.assertEqual(infer.infer_field_type(series), "measure")

    def test_two_value_text_series_is_dimension(self):
        series = pd.Series(["Particular", "Empresa", "Particular"])
        self.assertEqual(infer.infer_field_type(series), "dimension")

    def test_all_null_series_is_dimension(self):
        series = pd.Series([None, None, None])
        self.assertEqual(infer.infer_field_type(series), "dimension")

    def test_likert_integer_series_is_measure_no_cardinality_override(self):
        series = pd.Series([1, 2, 3, 4, 5, 1, 2, 3, 4, 5])
        self.assertEqual(infer.infer_field_type(series), "measure")


class IsFreeTextColumnTests(unittest.TestCase):
    def test_long_catalan_sentences_are_free_text(self):
        sentences = pd.Series(
            [
                "Aquesta és una frase catalana prou llarga per superar el llindar establert de seixanta.",
                "Una altra frase igualment llarga que parla de satisfacció i qualitat del servei rebut.",
            ]
        )
        self.assertTrue(infer.is_free_text_column(sentences))

    def test_two_value_category_series_is_not_free_text(self):
        series = pd.Series(["Particular", "Empresa", "Particular", "Empresa"])
        self.assertFalse(infer.is_free_text_column(series))


class BuildKpisTests(unittest.TestCase):
    def test_one_kpi_per_measure_column_with_correct_n(self):
        df = pd.DataFrame({"satisfaccio": [1, 2, 3, None], "segment": ["A", "B", "A", "B"]})
        fields = infer.build_fields(df)
        kpis = infer.build_kpis(df, fields)
        self.assertEqual(len(kpis), 1)
        self.assertEqual(kpis[0]["label"], "satisfaccio")
        self.assertEqual(kpis[0]["n"], 3)

    def test_skips_all_null_measure_column(self):
        df = pd.DataFrame({"buit": pd.Series([None, None, None], dtype="float64")})
        fields = [{"name": "buit", "type": "measure"}]
        kpis = infer.build_kpis(df, fields)
        self.assertEqual(kpis, [])


class UniquenessFlagsTests(unittest.TestCase):
    def test_flags_fully_distinct_column(self):
        df = pd.DataFrame({"id": list(range(24))})
        findings = privacy.uniqueness_flags(df)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].subject, "id")

    def test_does_not_flag_two_value_column(self):
        df = pd.DataFrame({"segment": ["A", "B"] * 12})
        findings = privacy.uniqueness_flags(df)
        self.assertEqual(findings, [])

    def test_returns_empty_list_for_zero_row_frame(self):
        df = pd.DataFrame({"col": pd.Series([], dtype="float64")})
        findings = privacy.uniqueness_flags(df)
        self.assertEqual(findings, [])


class NameHintFlagsTests(unittest.TestCase):
    def test_catches_known_quasi_identifier_names(self):
        df = pd.DataFrame(
            {
                "Codi Postal": ["08001"] * 5,
                "data_naixement": ["1990-01-01"] * 5,
                "carrec": ["Director"] * 5,
                "satisfaccio": [1, 2, 3, 4, 5],
                "resposta": ["A", "B", "A", "B", "A"],
            }
        )
        findings = privacy.name_hint_flags(df)
        flagged = {f.subject for f in findings}
        self.assertIn("Codi Postal", flagged)
        self.assertIn("data_naixement", flagged)
        self.assertIn("carrec", flagged)
        self.assertNotIn("satisfaccio", flagged)
        self.assertNotIn("resposta", flagged)

    def test_short_hint_guard_does_not_flag_capacitat_on_cp(self):
        df = pd.DataFrame({"capacitat": [1, 2, 3]})
        findings = privacy.name_hint_flags(df)
        self.assertEqual(findings, [])


class SmallGroupFlagsTests(unittest.TestCase):
    def test_flags_combination_containing_a_two_row_group(self):
        df = pd.DataFrame(
            {
                "departament": ["A"] * 6 + ["A"] * 6 + ["B"] * 6 + ["B"] * 2,
                "franja_edat": ["jove"] * 6 + ["gran"] * 6 + ["jove"] * 6 + ["gran"] * 2,
            }
        )
        findings, unevaluated = privacy.small_group_flags(df, ["departament", "franja_edat"])
        self.assertEqual(len(findings), 1)
        self.assertIn("departament", findings[0].subject)
        self.assertIn("franja_edat", findings[0].subject)

    def test_no_finding_when_smallest_group_at_or_above_threshold(self):
        df = pd.DataFrame(
            {
                "departament": ["A"] * 10 + ["B"] * 10,
                "franja_edat": ["jove"] * 10 + ["gran"] * 10,
            }
        )
        findings, unevaluated = privacy.small_group_flags(df, ["departament", "franja_edat"])
        self.assertEqual(findings, [])

    def test_single_dimension_frame_returns_empty_findings_and_unevaluated_record(self):
        df = pd.DataFrame({"segment": ["A", "B"] * 5})
        findings, unevaluated = privacy.small_group_flags(df, ["segment"])
        self.assertEqual(findings, [])
        self.assertEqual(len(unevaluated), 1)


class FormatChecklistReportTests(unittest.TestCase):
    def test_empty_findings_states_assessed_column_count(self):
        report = privacy.format_checklist_report([], [], 5)
        self.assertIn("5", report)
        self.assertIn("Cap indici detectat", report)


class LoadTableTests(unittest.TestCase):
    def test_reads_tracer_csv_with_no_warnings(self):
        df, warnings = load_mod.load_table(RAW_TRACER_CSV)
        self.assertEqual(len(df), 24)
        self.assertEqual(warnings, [])

    def test_cp1252_fallback_preserves_accents_and_warns_once(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "cp1252.csv"
            content = "segment,satisfaccio\nParticular,Satisfacció alta\n"
            path.write_bytes(content.encode("cp1252"))
            df, warnings = load_mod.load_table(path)
            self.assertEqual(len(warnings), 1)
            self.assertIn("Satisfacció", df["satisfaccio"].iloc[0])

    def test_xlsx_matches_equivalent_csv_columns(self):
        csv_df, _ = load_mod.load_table(RAW_TRACER_CSV)
        with TemporaryDirectory() as tmp:
            xlsx_path = Path(tmp) / "mostra.xlsx"
            csv_df.to_excel(xlsx_path, index=False, engine="openpyxl")
            xlsx_df, warnings = load_mod.load_table(xlsx_path)
            self.assertEqual(list(xlsx_df.columns), list(csv_df.columns))

    def test_blank_first_header_produces_unnamed_warning(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "blank_header.csv"
            path.write_text(",segment\n1,Particular\n2,Empresa\n", encoding="utf-8")
            df, warnings = load_mod.load_table(path)
            self.assertTrue(any("Unnamed" in w for w in warnings))

    def test_unsupported_suffix_raises_value_error(self):
        with self.assertRaises(ValueError):
            load_mod.load_table(Path("data.json"))


def _base_meta(**overrides) -> dict:
    meta = {
        "id": "x",
        "title": "T",
        "date": "2026-01-01",
        "description": "D",
        "n": 1,
        "kpis": [],
    }
    meta.update(overrides)
    return meta


if __name__ == "__main__":
    unittest.main()
