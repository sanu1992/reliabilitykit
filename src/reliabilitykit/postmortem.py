"""Blameless incident postmortem generation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class PostmortemInput:
    """User-provided context for a postmortem draft."""

    title: str
    incident_id: str
    severity: str
    service: str
    started_at: datetime
    ended_at: datetime
    summary: str
    impact: str


def parse_timestamp(value: str) -> datetime:
    """Parse an ISO-8601 timestamp and normalize it to UTC."""

    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def format_elapsed(started_at: datetime, ended_at: datetime) -> str:
    """Format incident duration in hours, minutes, and seconds."""

    if ended_at < started_at:
        raise ValueError("ended_at cannot be earlier than started_at")
    total_seconds = int((ended_at - started_at).total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    parts: list[str] = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if seconds or not parts:
        parts.append(f"{seconds}s")
    return " ".join(parts)


def generate_postmortem(data: PostmortemInput) -> str:
    """Generate a structured, blameless Markdown postmortem draft."""

    duration = format_elapsed(data.started_at, data.ended_at)
    started = data.started_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    ended = data.ended_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    return f"""# {data.title}

> This document is blameless. It focuses on system conditions, safeguards, and learning rather than individual fault.

## Incident metadata

| Field | Value |
|---|---|
| Incident ID | {data.incident_id} |
| Severity | {data.severity} |
| Service | {data.service} |
| Status | Draft |
| Started (UTC) | {started} |
| Ended (UTC) | {ended} |
| Duration | {duration} |

## Executive summary

{data.summary}

## Customer and business impact

{data.impact}

## Detection

- How was the incident first detected?
- Which signal or alert fired?
- How could detection be made earlier or more precise?

## Timeline

| Time (UTC) | Event |
|---|---|
| {started} | Incident began. |
| TODO | Detection and initial triage. |
| TODO | Mitigation started. |
| {ended} | Customer impact ended. |

## Response and recovery

- What actions limited the impact?
- What restored the service?
- Which actions were manual, delayed, or risky?

## Contributing factors

- Technical factors:
- Process factors:
- Detection or observability gaps:
- Conditions that increased the blast radius:

## Five whys

1. Why did the customer-visible impact occur?
2. Why was that condition possible?
3. Why did safeguards not prevent it?
4. Why was it not detected or mitigated sooner?
5. What systemic improvement will reduce recurrence?

## What went well

- TODO

## What did not go well

- TODO

## Where we got lucky

- TODO

## Corrective actions

| Priority | Action | Owner | Due date | Verification | Status |
|---|---|---|---|---|---|
| P0 | TODO | TODO | YYYY-MM-DD | Test or measurable signal | Open |
| P1 | TODO | TODO | YYYY-MM-DD | Test or measurable signal | Open |

## SLO and error-budget impact

- SLO affected:
- Bad events or downtime:
- Error budget consumed:
- Policy consequence:

## Follow-up review

- Review date:
- Reviewers:
- Evidence that corrective actions worked:
"""


def write_postmortem(data: PostmortemInput, output: Path) -> Path:
    """Write a generated postmortem without overwriting an existing file."""

    if output.exists():
        raise FileExistsError(f"refusing to overwrite existing file: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(generate_postmortem(data), encoding="utf-8")
    return output

