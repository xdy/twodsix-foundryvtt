# Security Policy

## Supported Versions

Only the latest version, whatever that is.

## Reporting a Vulnerability

Create an issue explaining the problem.

## Dependency security

This project uses pnpm for dependency management and performs security checks both locally and in CI.

- Local audit:
```
pnpm audit
```
- CI audit: Our GitHub Actions workflow runs `pnpm audit --prod --audit-level=high` as a non-blocking step on release builds. If you want to enforce failures on findings, remove the `continue-on-error` flag and/or adjust `--audit-level`.

If you discover a vulnerability in a dependency that affects this project, please open an issue with details, including the vulnerable package, version, and any relevant advisory links.
