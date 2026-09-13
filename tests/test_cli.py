from __future__ import annotations

import io
import json
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from reliabilitykit.cli import main

FIXTURES = Path(__file__).parent / "fixtures"


class CLITests(unittest.TestCase):
    def test_audit_exit_threshold_detects_high_findings(self) -> None:
        output = io.StringIO()
        with redirect_stdout(output):
            exit_code = main(
                [
                    "audit",
                    str(FIXTURES / "risky.yaml"),
                    "--format",
                    "json",
                    "--fail-on",
                    "high",
                ]
            )

        report = json.loads(output.getvalue())
        self.assertEqual(exit_code, 1)
        self.assertEqual(report["sensitive_resources_skipped"], 1)

    def test_slo_command_emits_valid_json(self) -> None:
        output = io.StringIO()
        with redirect_stdout(output):
            exit_code = main(
                [
                    "slo",
                    "--objective",
                    "99.95",
                    "--window-days",
                    "28",
                    "--format",
                    "json",
                ]
            )

        result = json.loads(output.getvalue())
        self.assertEqual(exit_code, 0)
        self.assertEqual(result["objective_percent"], 99.95)
        self.assertGreater(result["allowed_downtime_seconds"], 0)


if __name__ == "__main__":
    unittest.main()

