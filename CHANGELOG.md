# Changelog

All notable changes to ReliabilityKit are documented in this file.

## 0.2.0 - 2026-09-13

### Added

- Local stdio Model Context Protocol server for all three workflows.
- Structured, validated MCP inputs and outputs using the official Python SDK.
- Allowed-root path containment with manifest file-count and byte limits.
- Agent integration guide and repository-level coding-agent instructions.
- MCP in-memory integration and agent security-boundary tests.
- Weekly Dependabot checks for Python, dashboard, and GitHub Actions dependencies.

### Security

- Agent manifest audits redact resource identifiers by default.
- Agent errors are sanitized and raw manifests remain excluded from results.
- Postmortem content escapes raw HTML before Markdown generation.
- Dashboard dependencies were upgraded or overridden to patched versions after
  pre-release Python and npm advisory scans.

## 0.1.0 - 2026-09-13

### Added

- Local-first Kubernetes manifest reliability audit with 14 checks.
- SLO time-based and event-based error-budget calculator.
- Blameless Markdown postmortem generator.
- Responsive browser dashboard for all three workflows.
- JSON and Markdown downloads without an application backend.
- Shared golden contract tests for Python and TypeScript parity.
- Security model, contributor guide, and automated CI.
