from __future__ import annotations

import json
import unittest
from pathlib import Path

from reliabilitykit.audit import audit_path

FIXTURES = Path(__file__).parent / "fixtures"


class AuditTests(unittest.TestCase):
    def test_reliable_workload_has_no_findings(self) -> None:
        report = audit_path(FIXTURES / "reliable.yaml")

        self.assertEqual(report.resources_scanned, 3)
        self.assertEqual(report.sensitive_resources_skipped, 0)
        self.assertEqual(report.score, 100)
        self.assertEqual(report.grade, "A")
        self.assertEqual(report.findings, [])

    def test_risky_workload_finds_reliability_gaps_and_skips_secret(self) -> None:
        report = audit_path(FIXTURES / "risky.yaml")
        check_ids = {finding.check_id for finding in report.findings}

        self.assertEqual(report.resources_scanned, 1)
        self.assertEqual(report.sensitive_resources_skipped, 1)
        self.assertTrue(
            {
                "RK-K8S-002",
                "RK-K8S-005",
                "RK-K8S-009",
                "RK-K8S-010",
                "RK-K8S-011",
                "RK-K8S-012",
                "RK-K8S-013",
                "RK-K8S-014",
            }.issubset(check_ids)
        )
        rendered = json.dumps(report.to_dict())
        self.assertNotIn("should-never-appear-in-a-report", rendered)

    def test_name_redaction_is_stable_and_removes_raw_names(self) -> None:
        report = audit_path(FIXTURES / "risky.yaml", redact_names=True)
        rendered = json.dumps(report.to_dict())

        self.assertNotIn("payment-api", rendered)
        self.assertNotIn("storefront", rendered)
        self.assertIn("sha256:", rendered)

    def test_missing_input_fails(self) -> None:
        with self.assertRaises(FileNotFoundError):
            audit_path(FIXTURES / "missing.yaml")


if __name__ == "__main__":
    unittest.main()

