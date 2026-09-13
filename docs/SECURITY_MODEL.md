# ReliabilityKit security model

## Current trust boundary

The ReliabilityKit CLI and dashboard remain offline, local-first tools. They:

- Reads only the file or directory selected by the operator
- Does not connect to Kubernetes
- Does not read a kubeconfig
- Does not make network requests
- Does not execute manifest content
- Does not modify the supplied manifests
- Writes a report only when an explicit output path is provided

## Sensitive data handling

Kubernetes `Secret` objects are counted and excluded from analysis. Report
output contains finding identifiers, severities, resource references,
descriptions, and remediation text. It does not contain raw object
specifications.

Resource names and namespaces may themselves reveal sensitive information.
Use `--redact-names` to replace them with stable, truncated SHA-256 hashes.

The YAML parser must still read a selected file into the local process before
it can identify and skip a Secret object. Do not provide untrusted manifests or
Secret exports. Prefer a dedicated, Secret-free export directory.

Workload specifications can contain plaintext environment values. The auditor
checks only the fields needed by its rules and does not copy environment values
into the report.

## Agent trust boundary

Version 0.2 includes an optional MCP server that uses local stdio transport. It
does not listen on a network interface. Agent-requested manifest reads are
restricted to `RELIABILITYKIT_ALLOWED_ROOTS`, or the server's current working
directory when no roots are configured.

Before an agent audit, ReliabilityKit resolves canonical paths, rejects reads
outside the allowed roots, verifies resolved manifest files remain inside the
boundary, and enforces a maximum of 100 files and 4 MiB. Resource-name
redaction is enabled by default. The server exposes no shell, subprocess,
Kubernetes, kubeconfig, log, Secret-value, or general-purpose file tool.

The local operating-system user remains inside the trust boundary. A user who
can modify an allowed directory or the running process can also change what the
server reads. Use a dedicated, read-only manifest export directory when the
source is not fully trusted.

Expected validation and access failures are returned as sanitized tool errors.
Unexpected failures are left to the MCP SDK's production error sanitization.

Do not put an unauthenticated HTTP bridge in front of the stdio server. A
multi-user service requires tenant isolation, authentication, authorization,
rate limits, secure audit logging, and a separate threat model.

## Future live collector requirements

A future live-cluster collector must:

1. Use a dedicated ServiceAccount and an explicit allowlist of API resources.
2. Use only necessary `get` and `list` permissions, without wildcards.
3. Exclude Secrets, ConfigMap contents, pod logs, exec, attach, proxy, port
   forwarding, token requests, and all write verbs.
4. Prefer metadata-only API responses where full specifications are not needed.
5. Keep kubeconfig files and credentials on the customer's machine.
6. Produce a deterministic bundle that the customer can inspect before upload.
7. Redact or hash identifiers before any network transmission.
8. Sign release artifacts and publish reproducible build instructions.
9. Document every collected field and its purpose.
10. Support a fully offline assessment mode.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Once the GitHub
repository is published, use its private vulnerability reporting feature. Until
then, stop using the affected function and retain the minimum evidence needed
to reproduce the issue safely.
