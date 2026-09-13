# Agent integration

ReliabilityKit exposes its three workflows through a local Model Context
Protocol (MCP) server. An MCP host launches the server as a child process and
communicates over standard input/output. The server does not open a network
port.

## Install

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -e ".[agent]"
```

## Start command

```powershell
.venv\Scripts\reliabilitykit-mcp
```

Configure any MCP-compatible host with the absolute path to that command. Set
`RELIABILITYKIT_ALLOWED_ROOTS` to the only directories from which agents may
request manifest audits. Separate multiple roots using the operating system's
path separator.

```json
{
  "mcpServers": {
    "reliabilitykit": {
      "command": "C:\\absolute\\path\\to\\.venv\\Scripts\\reliabilitykit-mcp.exe",
      "env": {
        "RELIABILITYKIT_ALLOWED_ROOTS": "C:\\approved\\manifest-export"
      }
    }
  }
}
```

If the environment variable is absent, the server permits only its current
working directory. Use a dedicated, Secret-free manifest export directory.

## Exposed tools

- `audit_kubernetes_manifests`: reads bounded YAML/JSON input from an allowed
  root and returns findings, with resource-name redaction enabled by default.
- `calculate_slo_error_budget`: returns a structured time and event error
  budget calculation.
- `generate_incident_postmortem`: returns bounded, HTML-escaped Markdown and
  does not write a file.

The server also exposes `reliabilitykit://security-model` as a read-only MCP
resource.

## Security boundary

- No Kubernetes client, kubeconfig access, shell execution, or subprocesses
- No HTTP listener and no outbound network requests
- Canonical-path containment checks, including symlink target validation
- Maximum 100 manifest files and 4 MiB per audit request
- Secret objects and raw manifests excluded from results
- Expected failures returned as sanitized tool errors
- Structured input constraints and structured output validation

Do not expose the stdio server through an HTTP bridge without authentication,
authorization, request limits, tenant isolation, audit logging, and a separate
threat model.
