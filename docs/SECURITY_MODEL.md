# ReliabilityKit security model

## Current trust boundary

Version 0.1 is an offline manifest analysis tool. It:

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

