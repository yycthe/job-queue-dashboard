# Job Queue Dashboard

A local-first job-search workspace: prepare, review, approve, and track applications without a hosted service. Plain HTML, CSS, and JavaScript. No accounts, dependencies, build step, database, telemetry, or background uploads.

This repository contains the reusable interface and workflow, **not anyone's candidate profile, job history, resume, or credentials**. Your private data is created locally and ignored by Git.

## Get started

1. Download this repository or clone your own copy.
2. From the project folder, run `node scripts/init.mjs` with Node.js 22 or newer. No package installation is needed.
3. Double-click `dashboard.html` to open it in a normal desktop browser.

No Node.js? Create a `dashboard-data` folder with an empty `records` subfolder, copy `templates/index.example.js` to `dashboard-data/index.js`, and open `dashboard.html`. For your profile, copy `templates/CANDIDATE_PROFILE.example.md` to `CANDIDATE_PROFILE.md`. The Node scripts are optional setup and validation tools; the browser itself does not need Node.

The dashboard starts empty. It does not invent sample applications or contact employers. Some embedded browsers restrict local files or PDFs; open the folder in your ordinary browser instead of bypassing the restriction.

## Set it up with your AI

Give a file-capable assistant access to **your local copy**, ask it to read `AGENTS.md`, and paste [the complete setup prompt](docs/AI_SETUP_PROMPT.md).

The workflow is:

1. Interview you about your actual experience and preferences.
2. Create one evidence-labeled `CANDIDATE_PROFILE.md`.
3. Build a private knowledge base for research, preparation, submission, and evidence.
4. Research authorized roles and add them to Queue with explainable fit scores.
5. Prepare truthful resume and cover-letter materials for your review.
6. Submit only after your specific approval, and record official confirmation.

AI capabilities vary. This is a local viewer plus a workflow specification, **not a built-in AI agent or an automatic job-application bot**. The assistant or you edits the local data files. Reload the page after changes.

## What the dashboard does

- Queue and Applications views, search, time sorting, status filtering on Applications, and pagination.
- Lazily loaded job details: research, fit scores, gaps, approval state, blockers, next actions, and evidence summaries.
- Resume and cover-letter text in the details, with project-relative PDF links.
- Previous/next detail navigation and arrow-key shortcuts.
- Privacy Mode hides aggregate counts, including filter-menu totals and pagination totals. It preserves records and details; `?privacy=1` turns it on.

**Privacy Mode is not anonymization, authentication, or encryption.** Names, companies, documents, dates, fit scores, and other record contents remain visible. Do not use it to make private data suitable for publishing or screen sharing.

## Your data stays separate

The public files live in `dashboard-local/`, `docs/`, `scripts/`, `templates/`, and `tests/`.

These local paths are ignored by Git:

- `CANDIDATE_PROFILE.md` and `knowledge-base/`
- `dashboard-data/` (index and complete records)
- `original-files/`, `templates/resume/`, `working-applications/`, and `application-archives/`
- Logs, backups, private outputs, environment files, and common document/image formats

Ignored files are not encrypted or backed up. Git ignore rules do not protect files already tracked or force-added. Review staged content and Git history before any push; do not upload this whole working folder or enable GitHub Pages with personal data in it. Choose a separate secure backup process for your private records.

There is no cloud mirror, macOS background helper, sync switch, API key, or deployed service in this release. The setup prompt describes optional private synchronization only as a future, separately authorized project.

## Records and checks

Read [the data model](docs/DATA_MODEL.md). The example JSON is a **placeholder schema**, never loaded into the dashboard automatically.

```sh
node scripts/init.mjs
node scripts/validate.mjs
node --test
node scripts/check-public.mjs
```

The validator reads strict JSON wrapped in known script assignments without executing the record scripts. It checks identity, record/index consistency, state placement, material files and hashes, and required approval/confirmation fields. It cannot verify the truth of a candidate claim, whether a job is still open, the authenticity of evidence, or the freshness of a user's approval. Those require real review.

Tests use isolated fictional fixtures and a mock DOM; they are not a claim of cross-browser visual testing. Public-file checks are an additional guardrail, not a guarantee that arbitrary free text contains no sensitive information.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Keep the local `file://` loading model and the dependency-free viewer. Never include real candidate data in an issue, screenshot, test, or pull request.

## License

[MIT](LICENSE).
