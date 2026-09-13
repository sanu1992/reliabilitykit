"""Command-line interface for the ReliabilityKit MVP."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from reliabilitykit import __version__
from reliabilitykit.audit import AuditReport, SEVERITY_ORDER, audit_path
from reliabilitykit.postmortem import (
    PostmortemInput,
    parse_timestamp,
    write_postmortem,
)
from reliabilitykit.slo import SLOResult, calculate_slo


def _write_new_file(path: Path, content: str) -> None:
    if path.exists():
        raise FileExistsError(f"refusing to overwrite existing file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _render_audit_text(report: AuditReport) -> str:
    counts = report.finding_counts
    lines = [
        f"Reliability score: {report.score}/100 (grade {report.grade})",
        (
            f"Scanned {report.resources_scanned} resources in {report.files_scanned} file(s); "
            f"skipped {report.sensitive_resources_skipped} Secret resource(s)."
        ),
        (
            "Findings: "
            + ", ".join(f"{severity}={counts[severity]}" for severity in SEVERITY_ORDER)
        ),
    ]
    for finding in report.findings:
        lines.extend(
            [
                "",
                (
                    f"[{finding.severity.upper()}] {finding.check_id} "
                    f"{finding.resource.display_name}"
                ),
                f"  {finding.message}",
                f"  Fix: {finding.remediation}",
            ]
        )
    if not report.findings:
        lines.extend(["", "No findings were produced by the current rule set."])
    return "\n".join(lines) + "\n"


def _render_slo_text(result: SLOResult) -> str:
    lines = [
        f"SLO objective: {result.objective_percent:g}%",
        f"Window: {result.window_days:g} days",
        f"Allowed downtime: {result.allowed_downtime_human}",
    ]
    if result.total_events is not None:
        consumed = (
            "undefined (zero budget)"
            if result.budget_consumed_percent is None
            else f"{result.budget_consumed_percent:.2f}%"
        )
        lines.extend(
            [
                f"Total events: {result.total_events}",
                f"Bad events: {result.bad_events}",
                f"Allowed bad events: {result.allowed_bad_events:.2f}",
                f"Remaining bad events: {result.remaining_bad_events:.2f}",
                f"Budget consumed: {consumed}",
                f"Observed availability: {result.observed_availability_percent:.6f}%",
                f"Compliant: {'yes' if result.compliant else 'no'}",
            ]
        )
    return "\n".join(lines) + "\n"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="reliabilitykit",
        description="Offline reliability tools for Kubernetes and incident operations.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    subparsers = parser.add_subparsers(dest="command", required=True)

    audit = subparsers.add_parser(
        "audit",
        help="Assess Kubernetes YAML or JSON manifests without cluster access.",
    )
    audit.add_argument("path", type=Path, help="Manifest file or directory")
    audit.add_argument("--format", choices=("text", "json"), default="text")
    audit.add_argument("--output", type=Path, help="Write the report to a new file")
    audit.add_argument(
        "--redact-names",
        action="store_true",
        help="Hash resource names and namespaces in the report",
    )
    audit.add_argument(
        "--fail-on",
        choices=("critical", "high", "medium", "low", "none"),
        default="high",
        help="Return exit code 1 at or above this severity (default: high)",
    )

    slo = subparsers.add_parser("slo", help="Calculate time and event error budgets.")
    slo.add_argument("--objective", type=float, required=True, help="SLO percentage, such as 99.9")
    slo.add_argument("--window-days", type=float, default=30)
    slo.add_argument("--total-events", type=int)
    slo.add_argument("--bad-events", type=int)
    slo.add_argument("--format", choices=("text", "json"), default="text")

    postmortem = subparsers.add_parser(
        "postmortem",
        help="Generate a blameless incident postmortem in Markdown.",
    )
    postmortem.add_argument("--title", required=True)
    postmortem.add_argument("--incident-id", required=True)
    postmortem.add_argument("--severity", required=True)
    postmortem.add_argument("--service", required=True)
    postmortem.add_argument("--started", required=True, help="ISO-8601 timestamp")
    postmortem.add_argument("--ended", required=True, help="ISO-8601 timestamp")
    postmortem.add_argument("--summary", required=True)
    postmortem.add_argument("--impact", required=True)
    postmortem.add_argument("--output", type=Path, required=True)
    return parser


def _audit_exit_code(report: AuditReport, fail_on: str) -> int:
    if fail_on == "none":
        return 0
    threshold = SEVERITY_ORDER[fail_on]
    return int(any(SEVERITY_ORDER[finding.severity] <= threshold for finding in report.findings))


def _run_audit(args: argparse.Namespace) -> int:
    report = audit_path(args.path, redact_names=args.redact_names)
    if args.format == "json":
        rendered = json.dumps(report.to_dict(), indent=2, sort_keys=True) + "\n"
    else:
        rendered = _render_audit_text(report)

    if args.output:
        _write_new_file(args.output, rendered)
        print(f"Report written to: {args.output.resolve()}")
    else:
        print(rendered, end="")
    return _audit_exit_code(report, args.fail_on)


def _run_slo(args: argparse.Namespace) -> int:
    result = calculate_slo(
        objective_percent=args.objective,
        window_days=args.window_days,
        total_events=args.total_events,
        bad_events=args.bad_events,
    )
    if args.format == "json":
        print(json.dumps(result.to_dict(), indent=2, sort_keys=True))
    else:
        print(_render_slo_text(result), end="")
    return 0


def _run_postmortem(args: argparse.Namespace) -> int:
    data = PostmortemInput(
        title=args.title,
        incident_id=args.incident_id,
        severity=args.severity,
        service=args.service,
        started_at=parse_timestamp(args.started),
        ended_at=parse_timestamp(args.ended),
        summary=args.summary,
        impact=args.impact,
    )
    written = write_postmortem(data, args.output)
    print(f"Postmortem written to: {written.resolve()}")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "audit":
            return _run_audit(args)
        if args.command == "slo":
            return _run_slo(args)
        if args.command == "postmortem":
            return _run_postmortem(args)
    except (FileExistsError, FileNotFoundError, OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    parser.error(f"unknown command: {args.command}")
    return 2

