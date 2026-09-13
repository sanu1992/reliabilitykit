# Contributing

ReliabilityKit is currently in its initial development phase. Small, focused
changes with tests are welcome after the public repository is launched.

## Development principles

- Keep data collection local-first and transparent.
- Never request broader Kubernetes permissions for convenience.
- Never include credentials, Secret values, logs, or customer data in fixtures.
- Explain the operational tradeoff behind every new reliability check.
- Add tests for both the finding and a configuration that should pass.
- Keep generated reports stable and machine-readable.

## Local verification

```powershell
$env:PYTHONPATH = "src"
python -m unittest discover -s tests -v
```

