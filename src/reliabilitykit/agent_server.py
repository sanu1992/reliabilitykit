"""Local, stdio-only MCP server for ReliabilityKit agent integrations."""

from __future__ import annotations

from typing import Annotated

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations
from pydantic import BaseModel, Field

from reliabilitykit.agent_security import AgentSecurityError, validate_manifest_path
from reliabilitykit.audit import audit_path
from reliabilitykit.postmortem import (
    PostmortemInput,
    format_elapsed,
    generate_postmortem,
    parse_timestamp,
)
from reliabilitykit.slo import calculate_slo

mcp = MCPServer("ReliabilityKit")
READ_ONLY = ToolAnnotations(read_only_hint=True, destructive_hint=False)


class AgentFinding(BaseModel):
    """One redacted, actionable reliability finding."""

    check_id: str
    severity: str
    resource: str
    message: str
    remediation: str


class AgentAuditResult(BaseModel):
    """Structured manifest-audit result for an MCP client."""

    schema_version: str
    generated_at: str
    files_scanned: int
    resources_scanned: int
    sensitive_resources_skipped: int
    score: int
    grade: str
    finding_counts: dict[str, int]
    findings: list[AgentFinding]


class AgentSLOResult(BaseModel):
    """Structured SLO and error-budget calculation."""

    objective_percent: float
    window_days: float
    allowed_downtime_seconds: float
    allowed_downtime_human: str
    total_events: int | None = None
    bad_events: int | None = None
    allowed_bad_events: float | None = None
    remaining_bad_events: float | None = None
    budget_consumed_percent: float | None = None
    observed_availability_percent: float | None = None
    compliant: bool | None = None


class AgentPostmortemResult(BaseModel):
    """Structured wrapper for a generated postmortem draft."""

    schema_version: str
    duration: str
    markdown: str


def _tool_error(error: Exception, fallback: str) -> ToolError:
    if isinstance(error, AgentSecurityError):
        return ToolError(str(error))
    if isinstance(error, FileNotFoundError):
        return ToolError("The manifest path does not exist.")
    if isinstance(error, PermissionError):
        return ToolError("The manifest path is not permitted.")
    return ToolError(fallback)


@mcp.tool(annotations=READ_ONLY)
def audit_kubernetes_manifests(
    path: Annotated[str, Field(min_length=1, max_length=4096, description="Manifest file or directory inside an allowed root.")],
    redact_names: Annotated[bool, Field(description="Hash resource names and namespaces in the result.")] = True,
) -> AgentAuditResult:
    """Audit local Kubernetes YAML or JSON without cluster access or raw manifest output."""

    try:
        safe_path = validate_manifest_path(path)
        report = audit_path(safe_path, redact_names=redact_names)
    except (AgentSecurityError, FileNotFoundError, OSError, ValueError) as error:
        raise _tool_error(error, "The manifest could not be safely parsed or audited.") from error
    return AgentAuditResult(**report.to_dict())


@mcp.tool(annotations=READ_ONLY)
def calculate_slo_error_budget(
    objective_percent: Annotated[float, Field(gt=0, le=100, description="SLO objective percentage.")],
    window_days: Annotated[float, Field(gt=0, le=3660, description="Budget window in days.")] = 30,
    total_events: Annotated[int | None, Field(gt=0, le=10**15, description="Optional total event count.")] = None,
    bad_events: Annotated[int | None, Field(ge=0, le=10**15, description="Optional bad event count.")] = None,
) -> AgentSLOResult:
    """Calculate a time-based and optional event-based SLO error budget."""

    try:
        result = calculate_slo(objective_percent, window_days, total_events, bad_events)
    except ValueError as error:
        raise ToolError(str(error)) from error
    return AgentSLOResult(**result.to_dict())


@mcp.tool(annotations=READ_ONLY)
def generate_incident_postmortem(
    title: Annotated[str, Field(min_length=1, max_length=200)],
    incident_id: Annotated[str, Field(min_length=1, max_length=100)],
    severity: Annotated[str, Field(min_length=1, max_length=50)],
    service: Annotated[str, Field(min_length=1, max_length=200)],
    started_at: Annotated[str, Field(min_length=1, max_length=64, description="ISO-8601 timestamp.")],
    ended_at: Annotated[str, Field(min_length=1, max_length=64, description="ISO-8601 timestamp.")],
    summary: Annotated[str, Field(min_length=1, max_length=5000)],
    impact: Annotated[str, Field(min_length=1, max_length=5000)],
) -> AgentPostmortemResult:
    """Generate a bounded, blameless Markdown postmortem without writing a file."""

    try:
        data = PostmortemInput(
            title=title,
            incident_id=incident_id,
            severity=severity,
            service=service,
            started_at=parse_timestamp(started_at),
            ended_at=parse_timestamp(ended_at),
            summary=summary,
            impact=impact,
        )
        markdown = generate_postmortem(data)
        duration = format_elapsed(data.started_at, data.ended_at)
    except ValueError as error:
        raise ToolError(str(error)) from error
    return AgentPostmortemResult(
        schema_version="reliabilitykit.io/postmortem/v1",
        duration=duration,
        markdown=markdown,
    )


@mcp.resource("reliabilitykit://security-model")
def agent_security_model() -> str:
    """Summarize the MCP server's fixed security boundary."""

    return (
        "ReliabilityKit uses local stdio transport only. It performs no cluster, shell, "
        "or network operations. Manifest reads are restricted to configured roots and "
        "bounded by file count and total bytes. Secret objects and raw manifests are "
        "excluded from tool results."
    )


def main() -> None:
    """Start the MCP server over stdio; no network port is opened."""

    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
