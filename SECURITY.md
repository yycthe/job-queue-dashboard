# Security and privacy

This is a local, single-user viewer. It provides no authentication, encryption, or isolation from other software or users on the same computer.

## Trust boundary

Data uses local JavaScript assignments to support file:// loading. **Record scripts are executable code.** Only open a dashboard containing data you or your trusted assistant created. Do not load downloaded or emailed record scripts. The validator parses strict JSON, but it is not a sandbox and cannot make a malicious file safe to open.

Displayed text is escaped. Job links are limited to HTTP(S), and material links to relative PDF paths inside working-applications/ or application-archives/. The validator rejects symlinks escaping the workspace. These safeguards do not replace operating-system security or protect you from an already malicious local script.

Privacy Mode hides counts only. Opening a job link contacts that website; the dashboard makes no background network requests.

## Before publishing

Review the entire staged tree and history, not just current files. Never force-add ignored personal data. Do not post candidate details, raw application records, credentials, private URLs, or screenshots of real records in public issues.

If a credential is exposed, revoke it at its provider. Removing it from the newest commit does not remove copies or history. If personal data is exposed, restrict access and follow the hosting provider's removal process; do not assume deletion recalls all copies.

## Reporting

For a non-sensitive bug, open an issue with a minimal fictional reproduction. For sensitive findings, use GitHub's private vulnerability reporting if available on the repository. Do not disclose exploitable details or private data in a public issue. Never include actual secrets in a report.
