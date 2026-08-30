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

import contextlib
import io
import json
import shutil
import unittest
import warnings
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd

import convert_enquesta
import verify_publicacio
from pipeline import index as index_mod
from pipeline import infer, privacy, schema
from pipeline import load as load_mod

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
GOLDEN_INDEX = FIXTURES_DIR / "enquestes_index.json"
GOLDEN_META = FIXTURES_DIR / "enquestes" / "demo-2024_meta.json"
RAW_TRACER_CSV = FIXTURES_DIR / "raw" / "mostra-tracer.csv"
RAW_PRIVACITAT_CSV = FIXTURES_DIR / "raw" / "mostra-privacitat.csv"


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
            result = index_mod.compute_upserted_index(index_path, new_entry)

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
            result = index_mod.compute_upserted_index(index_path, new_entry)

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
            result = index_mod.compute_upserted_index(index_path, new_entry)
            self.assertEqual(result, [new_entry])
            # compute_upserted_index is pure -- it never writes to disk itself;
            # callers validate the result and write it explicitly.
            self.assertFalse(index_path.exists())


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

    def test_truly_duplicated_raw_header_is_detected(self):
        """WR-04 regression: pandas auto-mangles a raw duplicate header
        ('Q1','Q1' -> 'Q1','Q1.1') before df.columns is ever built, so a
        duplicate check against df.columns alone can never catch this. The
        raw pre-mangle header tokens must be scanned instead."""
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "dup_header.csv"
            path.write_text("Q1,Q1,Q2\n1,2,3\n", encoding="utf-8")
            df, warnings = load_mod.load_table(path)
            self.assertEqual(list(df.columns), ["Q1", "Q1.1", "Q2"])
            self.assertTrue(any("Q1" in w and "duplicat" in w for w in warnings))

    def test_semicolon_delimited_csv_is_detected_and_warned(self):
        """G-02-3 regression: Spanish/Catalan-locale exports using ';'."""
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "semicolon.csv"
            content = (
                "segment;comentari\n"
                'Particular;"Preu, servei i qualitat"\n'
                "Empresa;Cap incidencia\n"
            )
            path.write_text(content, encoding="utf-8")
            df, warnings = load_mod.load_table(path)
            self.assertEqual(len(df), 2)
            self.assertEqual(list(df.columns), ["segment", "comentari"])
            self.assertEqual(df["comentari"].iloc[0], "Preu, servei i qualitat")
            self.assertTrue(any("';'" in w for w in warnings))

    def test_comma_delimited_csv_with_quoted_semicolon_stays_comma(self):
        """A comma-delimited file whose text contains ';' must not flip sep."""
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "comma_with_semicolon_text.csv"
            content = (
                "segment,comentari\n"
                'Particular,"Bo; pero car"\n'
                "Empresa,Cap incidencia\n"
            )
            path.write_text(content, encoding="utf-8")
            df, warnings = load_mod.load_table(path)
            self.assertEqual(len(df), 2)
            self.assertEqual(df["comentari"].iloc[0], "Bo; pero car")
            self.assertFalse(any("delimitat" in w for w in warnings))

    def test_tied_delimiter_counts_default_to_comma(self):
        """Boundary: equal ',' and ';' counts in the header default to ','."""
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "tied.csv"
            content = "a;b,c\n1;2,3\n"
            path.write_text(content, encoding="utf-8")
            df, warnings = load_mod.load_table(path)
            self.assertEqual(list(df.columns), ["a;b", "c"])
            self.assertFalse(any("delimitat" in w for w in warnings))

    def test_ragged_csv_raises_actionable_value_error(self):
        """A row with more fields than the header must fail loudly, not
        silently attempt to realign columns."""
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "ragged.csv"
            content = "segment,valor\nParticular,1\nEmpresa,2,extra\n"
            path.write_text(content, encoding="utf-8")
            with self.assertRaises(ValueError) as ctx:
                load_mod.load_table(path)
            self.assertIn("línia", str(ctx.exception))

    def test_wide_export_does_not_double_count_distinct_values_across_read_buffer(self):
        """REO1151 regression: pandas' default low_memory=True chunks a wide
        file's dtype inference internally; once the file is large enough to
        span more than one internal read buffer (empirically ~16MB+ in this
        pandas version), a numeric-looking column with a few blank/no-answer
        cells near the end gets read back as a MIX of int and str cells --
        int 1963 and str '1963' then compare as two distinct values, nearly
        doubling nunique() for that column and corrupting both the D-01
        cardinality filter and the privacy checklist's uniqueness ratio,
        entirely silently (pandas' own DtypeWarning is not part of this
        module's warnings list at all).

        Reproducing the actual buffer-boundary condition needs a file large
        enough to cross pandas' internal chunk size -- verified empirically
        via bisection to sit at ~15.7MB for this row/column shape, well
        above what a few inline text lines can produce. A 3000-row,
        291-column file is therefore the realistic minimum reproduction,
        not a toy fixture; it still runs in well under a second.
        """
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "wide_export.csv"
            n_rows = 3000
            n_filler_cols = 290
            filler_val = "x" * 20
            distinct_years = list(range(1950, 1980))  # 30 true distinct values
            header = "any_naixement," + ",".join(f"filler_{i}" for i in range(n_filler_cols))
            lines = [header]
            for i in range(n_rows):
                value = " " if i >= n_rows - 3 else str(distinct_years[i % len(distinct_years)])
                lines.append(value + "," + ",".join([filler_val] * n_filler_cols))
            path.write_text("\n".join(lines), encoding="utf-8")

            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                df, load_warnings = load_mod.load_table(path)
                dtype_warnings = [
                    w for w in caught if issubclass(w.category, pd.errors.DtypeWarning)
                ]

            self.assertEqual(dtype_warnings, [])
            # 30 distinct years + 1 blank marker = 31, never inflated by a
            # mixed int/str read of the same underlying values.
            self.assertEqual(df["any_naixement"].nunique(dropna=True), 31)


class EndToEndConversionTests(unittest.TestCase):
    def test_invalid_date_value_is_rejected_before_any_work(self):
        """WR-05 regression: --date must be a real YYYY-MM-DD date, not just
        digit-shaped (e.g. '2026-13-40' has an invalid month AND day)."""
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            with self.assertRaises(SystemExit) as ctx:
                convert_enquesta.main(
                    [
                        str(RAW_TRACER_CSV),
                        "--id",
                        "prova-data-invalida",
                        "--title",
                        "T",
                        "--description",
                        "D",
                        "--date",
                        "2026-13-40",
                    ]
                )
            self.assertEqual(ctx.exception.code, 2)

    def test_full_conversion_drops_high_cardinality_columns_by_default(self):
        """Proves the whole path: load -> D-02 free-text -> D-01 cardinality
        -> field inference -> privacy checklist -> all three artifact
        writes, with no --columns hand-enumeration required.
        """
        with TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            exit_code = convert_enquesta.main(
                [
                    str(RAW_TRACER_CSV),
                    "--id",
                    "prova-tracer",
                    "--title",
                    "Prova tracer",
                    "--description",
                    "Prova end-to-end de la selecció automàtica per cardinalitat",
                    "--date",
                    "2026-01-01",
                    "--out-dir",
                    str(out_dir),
                    "--confirm-privacy-review",
                ]
            )
            self.assertEqual(exit_code, 0)

            parquet_path, meta_path, index_path = convert_enquesta._resolve_output_paths(
                out_dir, "prova-tracer"
            )
            self.assertTrue(parquet_path.exists())
            self.assertTrue(meta_path.exists())
            self.assertTrue(index_path.exists())

            written = pd.read_parquet(parquet_path)
            columns = set(written.columns)
            # id_resposta: 24 distinct values over 24 rows -- above the cutoff.
            self.assertNotIn("id_resposta", columns)
            # comentari_lliure: free text -- dropped by D-02, not D-01.
            self.assertNotIn("comentari_lliure", columns)
            # satisfaccio and segment: both well under the cutoff.
            self.assertIn("satisfaccio", columns)
            self.assertIn("segment", columns)


class IsHighCardinalityColumnTests(unittest.TestCase):
    def test_twenty_values_is_not_high_cardinality(self):
        series = pd.Series(list(range(20)))
        self.assertFalse(infer.is_high_cardinality_column(series))

    def test_twenty_one_values_is_high_cardinality(self):
        series = pd.Series(list(range(21)))
        self.assertTrue(infer.is_high_cardinality_column(series))

    def test_rating_scale_with_dont_know_option_survives(self):
        """Worked example from 04-CONTEXT.md: 0-10 rating (11 values) plus
        'no ho sé' (12th value) stays well under the cutoff."""
        series = pd.Series(list(range(11)) + ["no ho sé"])
        self.assertFalse(infer.is_high_cardinality_column(series))

    def test_custom_max_distinct_is_honoured(self):
        series = pd.Series(list(range(6)))
        self.assertTrue(infer.is_high_cardinality_column(series, max_distinct=5))
        self.assertFalse(infer.is_high_cardinality_column(series, max_distinct=6))

    def test_nulls_are_not_counted_as_a_distinct_value(self):
        series = pd.Series(list(range(20)) + [None] * 5)
        self.assertFalse(infer.is_high_cardinality_column(series))


class HighCardinalityColumnsTests(unittest.TestCase):
    def test_returns_only_qualifying_columns(self):
        df = pd.DataFrame(
            {
                "alta": list(range(25)),
                "baixa": ["A", "B"] * 12 + ["A"],
            }
        )
        self.assertEqual(infer.high_cardinality_columns(df), {"alta": 25})

    def test_exempt_name_is_absent_despite_exceeding_threshold(self):
        df = pd.DataFrame({"alta": list(range(25))})
        self.assertEqual(infer.high_cardinality_columns(df, exempt=["alta"]), {})

    def test_exempt_none_behaves_as_empty_exemption_set(self):
        df = pd.DataFrame({"alta": list(range(25))})
        self.assertEqual(
            infer.high_cardinality_columns(df, exempt=None),
            infer.high_cardinality_columns(df),
        )

    def test_frame_with_nothing_above_threshold_returns_empty_mapping(self):
        df = pd.DataFrame({"baixa": ["A", "B", "C"] * 5})
        self.assertEqual(infer.high_cardinality_columns(df), {})


class FormatHighCardinalityReportTests(unittest.TestCase):
    def test_nothing_dropped_states_threshold_and_no_drop(self):
        report = infer.format_high_cardinality_report({}, max_distinct=20)
        self.assertIn("20", report)
        self.assertIn("Cap columna descartada", report)

    def test_dropped_column_name_and_count_appear(self):
        report = infer.format_high_cardinality_report({"alta": 25}, max_distinct=20)
        self.assertIn("alta", report)
        self.assertIn("25", report)
        self.assertIn("20", report)

    def test_report_never_leaks_cell_values(self):
        sentinel_a = "SENTINELA-UNICA-1234"
        sentinel_b = "SENTINELA-UNICA-5678"
        df = pd.DataFrame({"alta": [sentinel_a, sentinel_b] + [f"valor-{i}" for i in range(25)]})
        dropped = infer.high_cardinality_columns(df, max_distinct=20)
        report = infer.format_high_cardinality_report(dropped, max_distinct=20)
        self.assertNotIn(sentinel_a, report)
        self.assertNotIn(sentinel_b, report)


class ColumnSelectionIntegrationTests(unittest.TestCase):
    def _run(self, argv):
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            exit_code = convert_enquesta.main(argv)
        return exit_code, stdout.getvalue()

    def test_include_columns_keeps_high_cardinality_column(self):
        with TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            exit_code, _ = self._run(
                [
                    str(RAW_TRACER_CSV),
                    "--id",
                    "inc-alta",
                    "--title",
                    "T",
                    "--description",
                    "D",
                    "--date",
                    "2026-01-01",
                    "--out-dir",
                    str(out_dir),
                    "--include-columns",
                    "id_resposta",
                    "--confirm-privacy-review",
                ]
            )
            self.assertEqual(exit_code, 0)
            parquet_path, _, _ = convert_enquesta._resolve_output_paths(out_dir, "inc-alta")
            written = pd.read_parquet(parquet_path)
            self.assertIn("id_resposta", written.columns)

    def test_include_columns_cannot_resurrect_free_text_column(self):
        with TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            exit_code, _ = self._run(
                [
                    str(RAW_TRACER_CSV),
                    "--id",
                    "inc-text",
                    "--title",
                    "T",
                    "--description",
                    "D",
                    "--date",
                    "2026-01-01",
                    "--out-dir",
                    str(out_dir),
                    "--include-columns",
                    "comentari_lliure",
                    "--confirm-privacy-review",
                ]
            )
            self.assertEqual(exit_code, 0)
            parquet_path, _, _ = convert_enquesta._resolve_output_paths(out_dir, "inc-text")
            written = pd.read_parquet(parquet_path)
            self.assertNotIn("comentari_lliure", written.columns)

    def test_unknown_include_column_returns_exit_code_one(self):
        with TemporaryDirectory() as tmp:
            exit_code, _ = self._run(
                [
                    str(RAW_TRACER_CSV),
                    "--id",
                    "inc-unknown",
                    "--title",
                    "T",
                    "--description",
                    "D",
                    "--date",
                    "2026-01-01",
                    "--out-dir",
                    tmp,
                    "--include-columns",
                    "no-existeix",
                ]
            )
            self.assertEqual(exit_code, 1)

    def test_all_columns_above_cutoff_returns_cardinality_specific_error(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "totes-altes.csv"
            rows = "\n".join(f"unica{i}" for i in range(25))
            path.write_text(f"id\n{rows}\n", encoding="utf-8")
            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr):
                exit_code, _ = self._run(
                    [
                        str(path),
                        "--id",
                        "totes-altes",
                        "--title",
                        "T",
                        "--description",
                        "D",
                        "--date",
                        "2026-01-01",
                        "--out-dir",
                        tmp,
                    ]
                )
            self.assertEqual(exit_code, 1)
            self.assertIn("cardinalitat", stderr.getvalue())
            self.assertNotIn("text lliure", stderr.getvalue())

    def test_privacy_gate_untouched_by_new_filter(self):
        with TemporaryDirectory() as tmp:
            exit_code, _ = self._run(
                [
                    str(RAW_PRIVACITAT_CSV),
                    "--id",
                    "priv-gate",
                    "--title",
                    "T",
                    "--description",
                    "D",
                    "--date",
                    "2026-01-01",
                    "--out-dir",
                    tmp,
                ]
            )
            self.assertEqual(exit_code, 2)


class SkipPrivacyReviewTests(unittest.TestCase):
    """Regression coverage for --skip-privacy-review (Rule 4 scope extension,
    04-02 checkpoint: operator decision to bypass the checklist entirely for
    already-anonymized, government-published sources -- see 04-02-SUMMARY.md).
    """

    def _run(self, argv):
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            exit_code = convert_enquesta.main(argv)
        return exit_code, stdout.getvalue()

    def test_skip_flag_converts_despite_findings_and_never_computes_checklist(self):
        """mostra-privacitat.csv has a codi_postal column that ALWAYS fires a
        quasi-identifier-name finding (name_hint_flags fires regardless of
        cardinality) -- without --skip-privacy-review this exact fixture
        blocks with exit code 2 (see test_privacy_gate_untouched_by_new_filter
        above). With --skip-privacy-review, conversion must succeed (exit 0)
        and the checklist computation itself -- not just the blocking exit
        code -- must never run: the printed output must contain the skip
        message and must NOT contain the checklist report header or any
        finding line that report would have printed.
        """
        with TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            exit_code, stdout = self._run(
                [
                    str(RAW_PRIVACITAT_CSV),
                    "--id",
                    "priv-skip",
                    "--title",
                    "T",
                    "--description",
                    "D",
                    "--date",
                    "2026-01-01",
                    "--out-dir",
                    str(out_dir),
                    "--skip-privacy-review",
                ]
            )
            self.assertEqual(exit_code, 0)
            self.assertIn("Revisió de privacitat OMESA (--skip-privacy-review)", stdout)
            self.assertNotIn("=== Revisió de privacitat ===", stdout)
            self.assertNotIn("quasi-identifier-name", stdout)

            parquet_path, _, _ = convert_enquesta._resolve_output_paths(out_dir, "priv-skip")
            self.assertTrue(parquet_path.exists())

    def test_without_flag_block_by_default_behaviour_is_unchanged(self):
        """Same fixture, no --skip-privacy-review: the pre-existing
        block-by-default gate (exit code 2, checklist report printed) must be
        completely unaffected by the new flag's existence.
        """
        with TemporaryDirectory() as tmp:
            exit_code, stdout = self._run(
                [
                    str(RAW_PRIVACITAT_CSV),
                    "--id",
                    "priv-no-skip",
                    "--title",
                    "T",
                    "--description",
                    "D",
                    "--date",
                    "2026-01-01",
                    "--out-dir",
                    tmp,
                ]
            )
            self.assertEqual(exit_code, 2)
            self.assertIn("=== Revisió de privacitat ===", stdout)
            self.assertNotIn("Revisió de privacitat OMESA", stdout)


class VerifyPublicacioTests(unittest.TestCase):
    """Fail-first coverage for scripts/verify_publicacio.py (plan 04-03,
    ROADMAP success criterion 3): each test builds a small synthetic
    published set inside a TemporaryDirectory() and asserts the verifier's
    exit code, proving the checker has teeth before it is trusted against
    the real public/data/ set.
    """

    def _write_survey(self, enquestes_dir, survey_id, df, *, n=None, fields=None):
        enquestes_dir.mkdir(parents=True, exist_ok=True)
        parquet_path = enquestes_dir / f"{survey_id}_respostes.parquet"
        df.to_parquet(parquet_path, engine="pyarrow", index=False)
        if fields is None:
            fields = infer.build_fields(df)
        meta = {
            "id": survey_id,
            "title": f"Títol {survey_id}",
            "date": "2026-01-01",
            "description": f"Descripció {survey_id}",
            "n": len(df) if n is None else n,
            "kpis": [],
            "fields": fields,
        }
        schema.write_json(enquestes_dir / f"{survey_id}_meta.json", meta)
        return {
            "id": survey_id,
            "title": meta["title"],
            "date": meta["date"],
            "description": meta["description"],
            "n": meta["n"],
        }

    def _write_index(self, data_dir, entries):
        schema.write_json(data_dir / "enquestes_index.json", entries)

    def test_consistent_set_returns_zero(self):
        with TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            df = pd.DataFrame({"segment": ["A", "B", "A"], "valor": [1, 2, 3]})
            entry = self._write_survey(data_dir / "enquestes", "prova-ok", df)
            self._write_index(data_dir, [entry])
            exit_code = verify_publicacio.main(["--data-dir", str(data_dir)])
            self.assertEqual(exit_code, 0)

    def test_duplicate_id_in_index_is_fail_first(self):
        """Constructs an index containing the SAME id twice, pointing at real,
        internally-consistent artifacts -- a verifier that skipped the
        duplicate-id check specifically would otherwise see every other check
        pass and wrongly return 0.
        """
        with TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            df = pd.DataFrame({"segment": ["A", "B"], "valor": [1, 2]})
            entry = self._write_survey(data_dir / "enquestes", "dup", df)
            self._write_index(data_dir, [entry, dict(entry)])
            exit_code = verify_publicacio.main(["--data-dir", str(data_dir)])
            self.assertEqual(exit_code, 1)

    def test_meta_n_mismatch_with_parquet_row_count_returns_one(self):
        with TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            df = pd.DataFrame({"segment": ["A", "B", "A"], "valor": [1, 2, 3]})
            entry = self._write_survey(data_dir / "enquestes", "n-mismatch", df, n=999)
            self._write_index(data_dir, [entry])
            exit_code = verify_publicacio.main(["--data-dir", str(data_dir)])
            self.assertEqual(exit_code, 1)

    def test_meta_fields_mismatch_with_parquet_schema_returns_one(self):
        with TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            df = pd.DataFrame({"segment": ["A", "B", "A"], "valor": [1, 2, 3]})
            entry = self._write_survey(
                data_dir / "enquestes",
                "field-mismatch",
                df,
                fields=[{"name": "altra_columna", "type": "dimension"}],
            )
            self._write_index(data_dir, [entry])
            exit_code = verify_publicacio.main(["--data-dir", str(data_dir)])
            self.assertEqual(exit_code, 1)

    def test_index_entry_with_missing_parquet_returns_one(self):
        with TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            enquestes_dir = data_dir / "enquestes"
            enquestes_dir.mkdir(parents=True)
            meta = {
                "id": "sense-parquet",
                "title": "T",
                "date": "2026-01-01",
                "description": "D",
                "n": 3,
                "kpis": [],
                "fields": [{"name": "x", "type": "measure"}],
            }
            schema.write_json(enquestes_dir / "sense-parquet_meta.json", meta)
            entry = {"id": "sense-parquet", "title": "T", "date": "2026-01-01", "description": "D", "n": 3}
            self._write_index(data_dir, [entry])
            exit_code = verify_publicacio.main(["--data-dir", str(data_dir)])
            self.assertEqual(exit_code, 1)

    def test_orphan_parquet_with_no_index_entry_returns_one(self):
        with TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            enquestes_dir = data_dir / "enquestes"
            df = pd.DataFrame({"segment": ["A", "B"], "valor": [1, 2]})
            entry = self._write_survey(enquestes_dir, "amb-entrada", df)
            self._write_index(data_dir, [entry])
            # Orphan: a second complete artifact pair with no index entry at all.
            self._write_survey(enquestes_dir, "orfe", pd.DataFrame({"segment": ["C", "D"]}))
            exit_code = verify_publicacio.main(["--data-dir", str(data_dir)])
            self.assertEqual(exit_code, 1)

    def test_expect_ids_naming_a_missing_id_returns_one(self):
        with TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            df = pd.DataFrame({"segment": ["A", "B"], "valor": [1, 2]})
            entry = self._write_survey(data_dir / "enquestes", "prova-expect", df)
            self._write_index(data_dir, [entry])
            exit_code = verify_publicacio.main(
                ["--data-dir", str(data_dir), "--expect-ids", "un-altre-id"]
            )
            self.assertEqual(exit_code, 1)

    def test_empty_data_dir_returns_one_not_a_clean_pass_over_zero_surveys(self):
        with TemporaryDirectory() as tmp:
            exit_code = verify_publicacio.main(["--data-dir", tmp])
            self.assertEqual(exit_code, 1)

    def test_report_never_leaks_a_cell_value(self):
        with TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            sentinel = "SENTINELA-CEL-UNICA-9999"
            df = pd.DataFrame({"segment": [sentinel, "B", "A"], "valor": [1, 2, 3]})
            entry = self._write_survey(data_dir / "enquestes", "prova-sentinel", df)
            self._write_index(data_dir, [entry])
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                verify_publicacio.main(["--data-dir", str(data_dir)])
            self.assertNotIn(sentinel, stdout.getvalue())


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
