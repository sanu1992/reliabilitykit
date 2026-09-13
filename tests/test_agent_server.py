from __future__ import annotations

import os
import unittest
from pathlib import Path
from unittest.mock import patch

from mcp import Client

from reliabilitykit.agent_server import mcp

ROOT = Path(__file__).parents[1]
FIXTURES = ROOT / "tests" / "fixtures"


class AgentServerTests(unittest.IsolatedAsyncioTestCase):
    async def call_tool(
        self,
        name: str,
        arguments: dict[str, object],
        *,
        raise_exceptions: bool = True,
    ):
        with patch.dict(
            os.environ,
            {"RELIABILITYKIT_ALLOWED_ROOTS": str(FIXTURES)},
            clear=False,
        ):
            async with Client(mcp, raise_exceptions=raise_exceptions) as client:
                return await client.call_tool(name, arguments)

    async def test_lists_three_bounded_tools(self) -> None:
        async with Client(mcp, raise_exceptions=True) as client:
            tools = await client.list_tools()
        self.assertEqual(
            {tool.name for tool in tools.tools},
            {
                "audit_kubernetes_manifests",
                "calculate_slo_error_budget",
                "generate_incident_postmortem",
            },
        )

    async def test_audit_defaults_to_name_redaction(self) -> None:
        result = await self.call_tool(
            "audit_kubernetes_manifests",
            {"path": str(FIXTURES / "risky.yaml")},
        )

        self.assertFalse(result.is_error)
        self.assertEqual(result.structured_content["score"], 45)
        rendered = str(result.structured_content)
        self.assertNotIn("payment-api", rendered)
        self.assertNotIn("should-never-appear-in-a-report", rendered)
        self.assertIn("sha256:", rendered)

    async def test_audit_rejects_outside_path_without_leaking_it(self) -> None:
        result = await self.call_tool(
            "audit_kubernetes_manifests",
            {"path": str(ROOT / "pyproject.toml")},
            raise_exceptions=False,
        )

        self.assertTrue(result.is_error)
        self.assertIn("outside the configured allowed roots", result.content[0].text)
        self.assertNotIn(str(ROOT), result.content[0].text)

    async def test_slo_returns_structured_output(self) -> None:
        result = await self.call_tool(
            "calculate_slo_error_budget",
            {"objective_percent": 99.9, "window_days": 30, "total_events": 1_000_000, "bad_events": 500},
        )

        self.assertFalse(result.is_error)
        self.assertEqual(result.structured_content["allowed_downtime_human"], "43m 12s")
        self.assertEqual(result.structured_content["budget_consumed_percent"], 50.0)

    async def test_postmortem_escapes_raw_html(self) -> None:
        result = await self.call_tool(
            "generate_incident_postmortem",
            {
                "title": "API <script>alert(1)</script>",
                "incident_id": "INC-7",
                "severity": "SEV-2",
                "service": "api",
                "started_at": "2026-09-13T10:00:00Z",
                "ended_at": "2026-09-13T10:05:00Z",
                "summary": "Recovered <b>safely</b>.",
                "impact": "Brief latency.",
            },
        )

        self.assertFalse(result.is_error)
        markdown = result.structured_content["markdown"]
        self.assertNotIn("<script>", markdown)
        self.assertNotIn("<b>", markdown)
        self.assertIn("&lt;script&gt;", markdown)


if __name__ == "__main__":
    unittest.main()
