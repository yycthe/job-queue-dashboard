# Local data model

The browser loads only `dashboard-data/index.js` at startup. Opening details loads one trusted record script. These runtime files are ignored by Git.

## Index

Write strict JSON after the assignment:

```js
window.DASHBOARD_INDEX = {
  "generatedAt": "2025-01-01T00:00:00Z",
  "queue": [],
  "applications": []
};
```

Each list item contains `id`, `company`, `role`, `location`, `status`, `fitScore`, `eventTime`, and `recordFile`. Derive these fields from the complete record. Use `addedAt` as eventTime for Queue and `submittedAt` for Applications. The path must be exactly `./dashboard-data/records/<id>.js`. IDs are lowercase letters/digits separated by single hyphens.

## Complete records

Start from [record.example.json](../templates/record.example.json). It is a placeholder, not a real opportunity or candidate claim. Replace its facts with verified sources before adding it to your private data.

Serialize with `JSON.stringify(record, null, 2)`, not hand-built string interpolation or executable expressions:

```js
window.DASHBOARD_RECORDS = window.DASHBOARD_RECORDS || {};
window.DASHBOARD_RECORDS["example-opportunity"] = { "id": "example-opportunity" };
```

The minimal object above demonstrates the wrapper only; the complete required fields are in the template. Do not add comments, functions, imports, or trailing commas to JSON. Do not embed records in HTML. Never execute downloaded record scripts. The validator parses the known wrapper without evaluating JavaScript.

## States and placement

| View / phase | States |
| --- | --- |
| Queue / QUEUE | PREPARING, READY_FOR_REVIEW, APPROVED_TO_SUBMIT, SUBMITTING, SUBMITTED_UNVERIFIED, NEEDS_USER |
| Applications / APPLICATIONS | APPLIED_CONFIRMED, ASSESSMENT, INTERVIEW, OFFER, REJECTED, WITHDRAWN |

Verified unsubmitted JOB_CLOSED, DUPLICATE, or WITHDRAWN outcomes can remain in Queue with `terminalEvidence.summary` and `terminalEvidence.reference`. They are not submissions; the Queue total includes them. Do not mistake them for active preparation. This release does not have a separate terminal-history view.

Preparation stops at READY_FOR_REVIEW. It requires dated official posting/duplicate checks, research, an explained fit score, and both ready materials. Fit scores are advisory 0..100, not hiring probabilities. Store the rubric, supported matches, and gaps in research.

Submission requires explicit scope and current candidate approval of exact materials: `review.status: "APPROVED"`, `approvedAt`, `approvedScope`, and `approvalNote`. A field is not proof of permission; the assistant must verify the actual current request. If materials change, renew review/approval.

All Applications records require `submittedAt` and `confirmation: { confirmedAt, summary, reference }` backed by actual official success evidence. Later stages retain that original evidence and are not new applications. Imported historical submissions may lack an automation approval; preserve their provenance rather than fabricating it.

Keep uncertainty in Queue. NEEDS_USER requires `blocker: { issue, completed, userStep, resumeFrom }`. SUBMITTED_UNVERIFIED requires evidence reconciliation, not another Submit click. Preserve changes and previous stages in `history`.

Use ISO timestamps with explicit time zones. Keep unavailable fields null, not invented. Job links may use only HTTP(S), without embedded credentials.

## Materials

Each resume/coverLetter object can contain:

- `ready`, `submitted`: booleans.
- `fileName`: basename of the exact PDF.
- `localPath`: `./working-applications/<folder>/.../Resume.pdf` or `./application-archives/<folder>/.../Resume.pdf`.
- `text`: full readable plain text; escaped when displayed.
- `sha256`: lowercase SHA-256 of the exact bytes.

Use literal filenames, not percent-encoded paths. Absolute paths, parent traversal, backslashes, symlink escapes, and non-PDF links are rejected. Text remains visible if no file link is available. Do not store meeting links or credentials in records. Preserve exact submitted material bytes and update paths after authorized archival.

## Safe updates

1. Re-read the complete record and matching index entry.
2. Update the full record without losing unknown fields or evidence.
3. Run `node scripts/validate.mjs --record dashboard-data/records/<id>.js`.
4. Derive the matching index entry and its view.
5. Run `node scripts/validate.mjs` across all records.
6. Reload the rendered Dashboard.

Validation detects structural problems and missing evidence fields; it does not prove claims, timestamps, live job availability, approval freshness, legal transitions in historical events, or evidence authenticity. PDF magic bytes and hashes do not validate layout, accessibility, or page count. Perform those checks separately before marking materials ready.
