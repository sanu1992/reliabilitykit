from __future__ import annotations

import json
import unittest
from pathlib import Path
from typing import Any

from reliabilitykit.audit import audit_path
from reliabilitykit.postmortem import PostmortemInput, generate_postmortem, parse_timestamp
from reliabilitykit.slo import calculate_slo

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = json.loads((ROOT / "tests" / "golden" / "cases.json").read_text(encoding="utf-8"))


class GoldenContractTests(unittest.TestCase):
    def test_contract_version(self) -> None:
        self.assertEqual(CONTRACT["contract_version"], 1)

    def test_audit_cases(self) -> None:
        for case in CONTRACT["audit_cases"]:
            with self.subTest(case=case["name"]):
                report = audit_path(
                    ROOT / case["input_path"],
                    redact_names=case["redact_names"],
                )
                actual = {
                    "resources_scanned": report.resources_scanned,
                    "sensitive_resources_skipped": report.sensitive_resources_skipped,
                    "score": report.score,
                    "grade": report.grade,
                    "finding_counts": report.finding_counts,
                    "check_ids": [finding.check_id for finding in report.findings],
                }
                self.assertEqual(actual, case["expected"])

    def test_slo_cases(self) -> None:
        for case in CONTRACT["slo_cases"]:
            with self.subTest(case=case["name"]):
                result = calculate_slo(**case["input"])
                actual = result.to_dict()
                for key, expected in case["expected"].items():
                    self._assert_value(actual[key], expected)

    def test_postmortem_cases(self) -> None:
        for case in CONTRACT["postmortem_cases"]:
            with self.subTest(case=case["name"]):
                source = case["input"]
                report = generate_postmortem(
                    PostmortemInput(
                        title=source["title"],
                        incident_id=source["incident_id"],
                        severity=source["severity"],
                        service=source["service"],
                        started_at=parse_timestamp(source["started_at"]),
                        ended_at=parse_timestamp(source["ended_at"]),
                        summary=source["summary"],
                        impact=source["impact"],
                    )
                )
                expected = case["expected"]
                self.assertIn(f'| Duration | {expected["duration"]} |', report)
                self.assertIn(expected["started_utc"], report)
                self.assertIn(expected["ended_utc"], report)
                for section in expected["required_sections"]:
                    self.assertIn(section, report)

    def _assert_value(self, actual: Any, expected: Any) -> None:
        if isinstance(expected, float):
            self.assertAlmostEqual(actual, expected)
        else:
            self.assertEqual(actual, expected)


if __name__ == "__main__":
    unittest.main()
