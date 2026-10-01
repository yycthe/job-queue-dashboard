# Public dashboard and private workspace contract

Read this file before working in a copy of this repository.

## Public code vs. private data

The checked-in interface, tests, templates, and documentation are reusable. Candidate facts, applications, research, evidence, and materials belong only in the ignored local paths. Do not copy private data into README files, tests, example templates, issues, commits, or public screenshots. Never store credentials anywhere in the project.

Do not publish user data, create accounts, send messages, upload materials, or submit applications without current scoped permission. Permission to edit this dashboard is not permission to apply for a job.

Keep maintained project files in English. Preserve original evidence and label translations. Do not infer candidate facts from examples or another user's history.

## Local architecture

Keep dashboard.html as a server-free file:// viewer. Do not add a framework, package manager, server, API, database, telemetry, external fetch, or background uploader without an explicit new request. The dashboard has no write API. Use trusted, strict-JSON record scripts and lazy loading. Follow docs/DATA_MODEL.md.

Do not rewrite accepted UI code just to add records. Do not overwrite user data during initialization. Preserve unrelated changes and unknown fields. Do not upload the whole project directory.

## Authority and workflow

- CANDIDATE_PROFILE.md is the only operational source for personal facts and preferences. Label sources, dates, scope, uncertainty, and qualifications.
- knowledge-base/ contains private reusable methods, not another candidate profile.
- dashboard-data/records/<id>.js is the complete control record. dashboard-data/index.js is derived.
- Exact materials and official confirmation evidence stay together in the application folder.

Preparation stops at READY_FOR_REVIEW. Submission requires current explicit approval of the exact reviewed materials and IDs, recorded with timestamp, scope, and a non-sensitive note. No permission may be inferred from silence, viewing, or prior approval. Do not bypass security protections.

APPLIED_CONFIRMED requires unambiguous official success evidence. Uncertain outcomes remain SUBMITTED_UNVERIFIED in Queue; reconcile evidence before any retry. Keep NEEDS_USER in Queue with the exact blocker and resume state. Preserve original confirmation and submittedAt during interview or later-stage updates.

Before preparation and submission, check ID, official URL/job ID, and normalized company + role for duplicates. Never count an interview as a second application. Archive a complete application folder only after confirmed submission.

For a change, re-read record/index, update the full record first, validate it with --record, update the derived index, validate the full dataset, and reload the page. Never change approved materials during submission without renewed review.

## Public contributions

Use only synthetic fixtures. Run node --test and node scripts/check-public.mjs. Stage an explicit file allowlist, inspect the diff and history, and exclude all private paths. .gitignore is not a security boundary.
