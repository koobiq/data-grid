# Security Policy

## Supported Packages and Versions

The packages and versions covered by this security policy are listed below.

### `@koobiq/ag-grid-angular-theme`

Security fixes are provided for every released version of this package.

| Version         | Supported |
| --------------- | --------- |
| `34.x` (latest) | ✅        |
| `33.x`          | ✅        |
| `32.x`          | ✅        |
| `31.x`          | ✅        |
| `30.x`          | ✅        |

## Reporting a Vulnerability

Please report suspected vulnerabilities privately through [GitHub Private Vulnerability Reporting](https://github.com/koobiq/data-grid/security/advisories/new). Do not disclose a suspected vulnerability in a public GitHub issue, discussion, or pull request.

Include enough information for us to reproduce and assess the issue, such as:

- the type of vulnerability;
- the affected package, version, and source files;
- any configuration required to reproduce the issue;
- step-by-step reproduction instructions or a minimal example;
- proof-of-concept or exploit code, if available;
- the potential impact and how an attacker might exploit the issue;
- any known mitigations or workarounds.

We will acknowledge the report within three business days. We will then investigate it and provide a status update at least once every seven business days until the report is resolved. We will let you know whether the report was accepted or declined and explain our decision where possible.

If a vulnerability is confirmed, we will coordinate a fix and its public disclosure with the reporter. Please keep the report confidential until the fix has been released and we have agreed on the disclosure timing.

We will credit the reporter in the published security advisory unless they prefer to remain anonymous.

## Scope

This policy covers vulnerabilities in the packages listed under [Supported Packages and Versions](#supported-packages-and-versions).

- Report ordinary bugs and feature requests through [GitHub Issues](https://github.com/koobiq/data-grid/issues).
- Report vulnerabilities that exist exclusively in AG Grid, Angular, or another dependency to that dependency's maintainers.
- Report vulnerabilities caused or made worse by this project's integration with a dependency through our private reporting channel.

## Dependency Security

Dependabot is configured to check npm and GitHub Actions dependencies for updates each month.

## Bug Bounty

This project does not currently operate a bug bounty program or offer monetary rewards for vulnerability reports.
