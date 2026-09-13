from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from reliabilitykit.postmortem import (
    PostmortemInput,
    format_elapsed,
    generate_postmortem,
    parse_timestamp,
    write_postmortem,
)


class PostmortemTests(unittest.TestCase):
    def setUp(self) -> None:
        self.data = PostmortemInput(
            title="Checkout latency incident",
            incident_id="INC-2026-001",
            severity="SEV-2",
            service="checkout-api",
            started_at=parse_timestamp("2026-09-13T10:00:00+05:30"),
            ended_at=parse_timestamp("2026-09-13T11:30:00+05:30"),
            summary="Checkout requests experienced elevated latency.",
            impact="Ten percent of checkout requests exceeded the latency SLO.",
        )

    def test_elapsed_time_and_timezone_normalization(self) -> None:
        self.assertEqual(format_elapsed(self.data.started_at, self.data.ended_at), "1h 30m")
        report = generate_postmortem(self.data)

        self.assertIn("2026-09-13T04:30:00Z", report)
        self.assertIn("2026-09-13T06:00:00Z", report)
        self.assertIn("This document is blameless", report)
        self.assertIn("## Corrective actions", report)

    def test_rejects_negative_duration(self) -> None:
        with self.assertRaisesRegex(ValueError, "earlier"):
            format_elapsed(self.data.ended_at, self.data.started_at)

    def test_writer_does_not_overwrite_existing_document(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "incident.md"
            write_postmortem(self.data, output)
            with self.assertRaises(FileExistsError):
                write_postmortem(self.data, output)


if __name__ == "__main__":
    unittest.main()

