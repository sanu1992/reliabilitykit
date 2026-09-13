"""Offline Kubernetes manifest reliability assessment.

The auditor never connects to a cluster. It reads local YAML or JSON manifests and
emits findings only; raw object specifications and values are never copied into
the report.
"""

from __future__ import annotations

import hashlib
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

import yaml

from reliabilitykit.models import Finding, ResourceRef

SUPPORTED_SUFFIXES = {".yaml", ".yml", ".json"}
WORKLOAD_KINDS = {"Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"}
SENSITIVE_KINDS = {"Secret"}
SEVERITY_WEIGHT = {"critical": 20, "high": 10, "medium": 5, "low": 2, "info": 0}
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


@dataclass(frozen=True)
class LoadedObject:
    """A parsed Kubernetes object and its non-sensitive source filename."""

    document: Mapping[str, Any]
    source: str


@dataclass(frozen=True)
class AuditReport:
    """Serializable result of one manifest assessment."""

    schema_version: str
    generated_at: str
    files_scanned: int
    resources_scanned: int
    sensitive_resources_skipped: int
    score: int
    grade: str
    finding_counts: Mapping[str, int]
    findings: Sequence[Finding]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "generated_at": self.generated_at,
            "files_scanned": self.files_scanned,
            "resources_scanned": self.resources_scanned,
            "sensitive_resources_skipped": self.sensitive_resources_skipped,
            "score": self.score,
            "grade": self.grade,
            "finding_counts": dict(self.finding_counts),
            "findings": [finding.to_dict() for finding in self.findings],
        }


def discover_manifest_files(input_path: Path) -> list[Path]:
    """Return deterministically ordered manifest files below a file or directory."""

    if not input_path.exists():
        raise FileNotFoundError(f"manifest path does not exist: {input_path}")
    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_SUFFIXES:
            raise ValueError(f"unsupported manifest extension: {input_path.suffix}")
        return [input_path]
    return sorted(
        path
        for path in input_path.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES
    )


def _expand_document(document: Any) -> Iterable[Mapping[str, Any]]:
    if not isinstance(document, Mapping):
        return []
    if document.get("kind") == "List" and isinstance(document.get("items"), list):
        return [item for item in document["items"] if isinstance(item, Mapping)]
    return [document]


def load_manifests(input_path: Path) -> tuple[list[LoadedObject], int, int]:
    """Safely parse manifests and count skipped Secret objects."""

    files = discover_manifest_files(input_path)
    if not files:
        raise ValueError(f"no YAML or JSON manifests found under: {input_path}")

    objects: list[LoadedObject] = []
    sensitive_skipped = 0
    for path in files:
        try:
            documents = yaml.safe_load_all(path.read_text(encoding="utf-8"))
            for parsed in documents:
                for document in _expand_document(parsed):
                    if document.get("kind") in SENSITIVE_KINDS:
                        sensitive_skipped += 1
                        continue
                    objects.append(LoadedObject(document=document, source=path.name))
        except (OSError, UnicodeError, yaml.YAMLError) as error:
            raise ValueError(f"could not parse {path.name}: {error}") from error
    return objects, len(files), sensitive_skipped


def _short_hash(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]


def _resource_ref(document: Mapping[str, Any], redact_names: bool) -> ResourceRef:
    metadata = document.get("metadata") if isinstance(document.get("metadata"), Mapping) else {}
    kind = str(document.get("kind") or "Unknown")
    namespace = str(metadata.get("namespace") or "default")
    name = str(metadata.get("name") or "unnamed")
    if redact_names:
        namespace = _short_hash(namespace)
        name = _short_hash(name)
    return ResourceRef(kind=kind, namespace=namespace, name=name)


def _pod_spec(document: Mapping[str, Any]) -> Mapping[str, Any] | None:
    spec = document.get("spec")
    if not isinstance(spec, Mapping):
        return None
    kind = document.get("kind")
    if kind == "CronJob":
        job_template = spec.get("jobTemplate")
        job_spec = job_template.get("spec") if isinstance(job_template, Mapping) else None
        template = job_spec.get("template") if isinstance(job_spec, Mapping) else None
        pod_spec = template.get("spec") if isinstance(template, Mapping) else None
    elif kind in {"Deployment", "StatefulSet", "DaemonSet", "Job"}:
        template = spec.get("template")
        pod_spec = template.get("spec") if isinstance(template, Mapping) else None
    elif kind == "Pod":
        pod_spec = spec
    else:
        return None
    return pod_spec if isinstance(pod_spec, Mapping) else None


def _pod_labels(document: Mapping[str, Any]) -> Mapping[str, str]:
    spec = document.get("spec")
    if not isinstance(spec, Mapping):
        return {}
    template = spec.get("template")
    if not isinstance(template, Mapping):
        return {}
    metadata = template.get("metadata")
    if not isinstance(metadata, Mapping):
        return {}
    labels = metadata.get("labels")
    return labels if isinstance(labels, Mapping) else {}


def _namespace(document: Mapping[str, Any]) -> str:
    metadata = document.get("metadata")
    return str(metadata.get("namespace") or "default") if isinstance(metadata, Mapping) else "default"


def _name(document: Mapping[str, Any]) -> str:
    metadata = document.get("metadata")
    return str(metadata.get("name") or "unnamed") if isinstance(metadata, Mapping) else "unnamed"


def _matching_pdb_exists(workload: Mapping[str, Any], pdbs: Sequence[Mapping[str, Any]]) -> bool:
    labels = _pod_labels(workload)
    if not labels:
        return False
    namespace = _namespace(workload)
    for pdb in pdbs:
        if _namespace(pdb) != namespace:
            continue
        spec = pdb.get("spec")
        selector = spec.get("selector") if isinstance(spec, Mapping) else None
        match_labels = selector.get("matchLabels") if isinstance(selector, Mapping) else None
        if isinstance(match_labels, Mapping) and all(labels.get(key) == value for key, value in match_labels.items()):
            return True
    return False


def _hpa_min_replicas(workload: Mapping[str, Any], hpas: Sequence[Mapping[str, Any]]) -> int | None:
    namespace = _namespace(workload)
    name = _name(workload)
    kind = str(workload.get("kind") or "")
    for hpa in hpas:
        if _namespace(hpa) != namespace:
            continue
        spec = hpa.get("spec")
        target = spec.get("scaleTargetRef") if isinstance(spec, Mapping) else None
        if not isinstance(target, Mapping):
            continue
        if target.get("kind") == kind and target.get("name") == name:
            value = spec.get("minReplicas", 1)
            return value if isinstance(value, int) else 1
    return None


def _finding(
    document: Mapping[str, Any],
    redact_names: bool,
    check_id: str,
    severity: str,
    message: str,
    remediation: str,
) -> Finding:
    return Finding(
        check_id=check_id,
        severity=severity,  # type: ignore[arg-type]
        resource=_resource_ref(document, redact_names),
        message=message,
        remediation=remediation,
    )


def _audit_workload(
    document: Mapping[str, Any],
    pdbs: Sequence[Mapping[str, Any]],
    hpas: Sequence[Mapping[str, Any]],
    redact_names: bool,
) -> list[Finding]:
    findings: list[Finding] = []
    kind = str(document.get("kind") or "")
    spec = document.get("spec") if isinstance(document.get("spec"), Mapping) else {}
    pod_spec = _pod_spec(document)

    if kind == "Pod":
        findings.append(
            _finding(
                document,
                redact_names,
                "RK-K8S-001",
                "high",
                "A bare Pod has no workload controller to recreate it after failure.",
                "Use a Deployment, StatefulSet, Job, or another appropriate controller.",
            )
        )

    effective_replicas: int | None = None
    if kind in {"Deployment", "StatefulSet"}:
        replicas = spec.get("replicas", 1)
        replicas = replicas if isinstance(replicas, int) else 1
        hpa_minimum = _hpa_min_replicas(document, hpas)
        effective_replicas = max(replicas, hpa_minimum or 0)
        if effective_replicas < 2:
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-002",
                    "high",
                    "The workload can run with a single replica.",
                    "Use at least two replicas or configure an HPA with minReplicas of at least two when availability requires it.",
                )
            )

        if effective_replicas >= 2 and not _matching_pdb_exists(document, pdbs):
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-003",
                    "medium",
                    "No matching PodDisruptionBudget was found.",
                    "Add a PodDisruptionBudget whose selector matches the workload labels and permits safe voluntary disruption.",
                )
            )

        template_spec = pod_spec or {}
        affinity = template_spec.get("affinity")
        pod_anti_affinity = affinity.get("podAntiAffinity") if isinstance(affinity, Mapping) else None
        topology_spread = template_spec.get("topologySpreadConstraints")
        if effective_replicas >= 2 and not pod_anti_affinity and not topology_spread:
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-004",
                    "medium",
                    "Replicas have no explicit topology spread or pod anti-affinity policy.",
                    "Spread replicas across appropriate hostname or zone failure domains.",
                )
            )

    if kind == "Deployment":
        strategy = spec.get("strategy")
        strategy_type = strategy.get("type", "RollingUpdate") if isinstance(strategy, Mapping) else "RollingUpdate"
        if strategy_type == "Recreate":
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-005",
                    "high",
                    "The Deployment uses the Recreate strategy, which can cause downtime.",
                    "Use RollingUpdate unless application constraints require a deliberate outage.",
                )
            )

    if kind == "CronJob":
        concurrency_policy = spec.get("concurrencyPolicy", "Allow")
        if concurrency_policy == "Allow":
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-006",
                    "low",
                    "The CronJob allows overlapping executions.",
                    "Choose Forbid or Replace if concurrent executions are unsafe or expensive.",
                )
            )

    if pod_spec is None:
        findings.append(
            _finding(
                document,
                redact_names,
                "RK-K8S-007",
                "high",
                "The workload does not contain a readable Pod specification.",
                "Validate the manifest structure and apiVersion for this workload kind.",
            )
        )
        return findings

    containers = pod_spec.get("containers")
    if not isinstance(containers, list) or not containers:
        findings.append(
            _finding(
                document,
                redact_names,
                "RK-K8S-008",
                "critical",
                "The Pod specification has no containers.",
                "Add at least one valid application container.",
            )
        )
        return findings

    for index, container in enumerate(containers):
        if not isinstance(container, Mapping):
            continue
        container_name = str(container.get("name") or f"container-{index + 1}")
        if not container.get("readinessProbe"):
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-009",
                    "high",
                    f"Container '{container_name}' has no readiness probe.",
                    "Add a readiness probe that reflects whether this container can safely receive traffic or work.",
                )
            )
        if not container.get("livenessProbe"):
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-010",
                    "medium",
                    f"Container '{container_name}' has no liveness probe.",
                    "Add a conservative liveness probe when Kubernetes can safely recover a stuck process.",
                )
            )

        resources = container.get("resources")
        requests = resources.get("requests") if isinstance(resources, Mapping) else None
        limits = resources.get("limits") if isinstance(resources, Mapping) else None
        if not isinstance(requests, Mapping) or not requests.get("cpu"):
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-011",
                    "medium",
                    f"Container '{container_name}' has no CPU request.",
                    "Set a measured CPU request so scheduling and autoscaling decisions have a reliable baseline.",
                )
            )
        if not isinstance(requests, Mapping) or not requests.get("memory"):
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-012",
                    "medium",
                    f"Container '{container_name}' has no memory request.",
                    "Set a measured memory request to reduce node pressure and scheduling risk.",
                )
            )
        if not isinstance(limits, Mapping) or not limits.get("memory"):
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-013",
                    "medium",
                    f"Container '{container_name}' has no memory limit.",
                    "Set a tested memory limit or document why an external policy provides equivalent protection.",
                )
            )

        image = str(container.get("image") or "")
        image_without_digest = image.split("@", 1)[0]
        last_segment = image_without_digest.rsplit("/", 1)[-1]
        mutable = not image or ("@sha256:" not in image and (":" not in last_segment or last_segment.endswith(":latest")))
        if mutable:
            findings.append(
                _finding(
                    document,
                    redact_names,
                    "RK-K8S-014",
                    "medium",
                    f"Container '{container_name}' uses an unpinned or latest image reference.",
                    "Use an immutable image digest or a controlled, non-latest version tag.",
                )
            )

    return findings


def _grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def audit_path(input_path: Path, redact_names: bool = False) -> AuditReport:
    """Assess all supported manifests below ``input_path``."""

    objects, files_scanned, sensitive_skipped = load_manifests(input_path)
    pdbs = [loaded.document for loaded in objects if loaded.document.get("kind") == "PodDisruptionBudget"]
    hpas = [loaded.document for loaded in objects if loaded.document.get("kind") == "HorizontalPodAutoscaler"]
    findings: list[Finding] = []

    for loaded in objects:
        kind = loaded.document.get("kind")
        if kind in WORKLOAD_KINDS or kind == "Pod":
            findings.extend(_audit_workload(loaded.document, pdbs, hpas, redact_names))

    findings.sort(
        key=lambda finding: (
            SEVERITY_ORDER[finding.severity],
            finding.resource.display_name,
            finding.check_id,
        )
    )
    penalty = sum(SEVERITY_WEIGHT[finding.severity] for finding in findings)
    score = max(0, 100 - penalty)
    counts = Counter(finding.severity for finding in findings)
    finding_counts = {severity: counts.get(severity, 0) for severity in SEVERITY_ORDER}

    return AuditReport(
        schema_version="reliabilitykit.io/audit/v1",
        generated_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        files_scanned=files_scanned,
        resources_scanned=len(objects),
        sensitive_resources_skipped=sensitive_skipped,
        score=score,
        grade=_grade(score),
        finding_counts=finding_counts,
        findings=findings,
    )

