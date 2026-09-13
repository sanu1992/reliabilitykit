from __future__ import annotations

import unittest

from reliabilitykit.slo import calculate_slo


class SLOTests(unittest.TestCase):
    def test_time_budget_for_three_nines_over_thirty_days(self) -> None:
        result = calculate_slo(99.9, 30)

        self.assertAlmostEqual(result.allowed_downtime_seconds, 2592)
        self.assertEqual(result.allowed_downtime_human, "43m 12s")

    def test_event_budget_and_compliance(self) -> None:
        result = calculate_slo(99.9, 30, total_events=1_000_000, bad_events=500)

        self.assertAlmostEqual(result.allowed_bad_events or 0, 1000)
        self.assertAlmostEqual(result.remaining_bad_events or 0, 500)
        self.assertAlmostEqual(result.budget_consumed_percent or 0, 50)
        self.assertTrue(result.compliant)

    def test_zero_error_budget_handles_bad_events_without_invalid_json_number(self) -> None:
        result = calculate_slo(100, total_events=1000, bad_events=1)

        self.assertIsNone(result.budget_consumed_percent)
        self.assertFalse(result.compliant)

    def test_rejects_partial_event_inputs(self) -> None:
        with self.assertRaisesRegex(ValueError, "provided together"):
            calculate_slo(99.9, total_events=1000)

    def test_rejects_impossible_bad_event_count(self) -> None:
        with self.assertRaisesRegex(ValueError, "cannot exceed"):
            calculate_slo(99.9, total_events=10, bad_events=11)


if __name__ == "__main__":
    unittest.main()

