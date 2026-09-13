"""Security boundaries for agent-initiated ReliabilityKit operations."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from reliabilitykit.audit import discover_manifest_files

ALLOWED_ROOTS_ENV = "RELIABILITYKIT_ALLOWED_ROOTS"
MAX_ALLOWED_ROOTS = 16
MAX_MANIFEST_FILES = 100
MAX_MANIFEST_BYTES = 4 * 1024 * 1024
MAX_PATH_LENGTH = 4096


class AgentSecurityError(ValueError):
    """A safe, caller-visible rejection at the agent trust boundary."""


def _contains(root: Path, candidate: Path) -> bool:
    return candidate == root or root in candidate.parents


def configured_allowed_roots(cwd: Path | None = None) -> tuple[Path, ...]:
    """Resolve the operator-configured roots, defaulting to the current directory."""

    raw_value = os.environ.get(ALLOWED_ROOTS_ENV)
    raw_roots: Iterable[str]
    if raw_value:
        raw_roots = (item for item in raw_value.split(os.pathsep) if item.strip())
    else:
        raw_roots = (str(cwd or Path.cwd()),)

    roots: list[Path] = []
    for raw_root in raw_roots:
        if len(roots) >= MAX_ALLOWED_ROOTS:
            raise AgentSecurityError("Too many allowed manifest roots are configured.")
        try:
            root = Path(raw_root).expanduser().resolve(strict=True)
        except (OSError, RuntimeError) as error:
            raise AgentSecurityError("An allowed manifest root is unavailable.") from error
        if not root.is_dir():
            raise AgentSecurityError("Every allowed manifest root must be a directory.")
        if root not in roots:
            roots.append(root)

    if not roots:
        raise AgentSecurityError("At least one allowed manifest root is required.")
    return tuple(roots)


def validate_manifest_path(
    requested_path: str,
    *,
    allowed_roots: tuple[Path, ...] | None = None,
    max_files: int = MAX_MANIFEST_FILES,
    max_bytes: int = MAX_MANIFEST_BYTES,
) -> Path:
    """Validate path containment and bounded manifest workload before an agent audit."""

    if not requested_path.strip() or len(requested_path) > MAX_PATH_LENGTH or "\x00" in requested_path:
        raise AgentSecurityError("A valid manifest path is required.")
    roots = configured_allowed_roots() if allowed_roots is None else allowed_roots
    if not roots:
        raise AgentSecurityError("At least one allowed manifest root is required.")

    candidate = Path(requested_path).expanduser()
    if not candidate.is_absolute():
        candidate = Path.cwd() / candidate
    try:
        resolved = candidate.resolve(strict=True)
    except (FileNotFoundError, OSError, RuntimeError) as error:
        raise AgentSecurityError("The manifest path is unavailable.") from error

    if not any(_contains(root, resolved) for root in roots):
        raise AgentSecurityError("The manifest path is outside the configured allowed roots.")
    if not resolved.is_file() and not resolved.is_dir():
        raise AgentSecurityError("The manifest path must be a regular file or directory.")

    try:
        manifest_files = discover_manifest_files(resolved)
    except (FileNotFoundError, OSError, ValueError) as error:
        raise AgentSecurityError("The manifest path cannot be inspected safely.") from error
    if not manifest_files:
        raise AgentSecurityError("No supported YAML or JSON manifests were found.")
    if len(manifest_files) > max_files:
        raise AgentSecurityError(f"The manifest selection exceeds the {max_files}-file limit.")

    total_bytes = 0
    for manifest_file in manifest_files:
        try:
            file_path = manifest_file.resolve(strict=True)
            if not any(_contains(root, file_path) for root in roots):
                raise AgentSecurityError("A manifest resolves outside the configured allowed roots.")
            if not file_path.is_file():
                raise AgentSecurityError("Every manifest must resolve to a regular file.")
            total_bytes += file_path.stat().st_size
        except AgentSecurityError:
            raise
        except (FileNotFoundError, OSError, RuntimeError) as error:
            raise AgentSecurityError("A manifest became unavailable during validation.") from error
        if total_bytes > max_bytes:
            raise AgentSecurityError(f"The manifest selection exceeds the {max_bytes}-byte limit.")

    return resolved
