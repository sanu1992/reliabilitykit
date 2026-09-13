"""Shared data models for ReliabilityKit reports."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Literal

Severity = Literal["critical", "high", "medium", "low", "info"]


@dataclass(frozen=True)
class ResourceRef:
    """A non-sensitive reference to a Kubernetes object."""

    kind: str
    namespace: str
    name: str

    @property
    def display_name(self) -> str:
        return f"{self.kind}/{self.namespace}/{self.name}"


@dataclass(frozen=True)
class Finding:
    """One actionable reliability observation."""

    check_id: str
    severity: Severity
    resource: ResourceRef
    message: str
    remediation: str

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["resource"] = self.resource.display_name
        return payload

