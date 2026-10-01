# Contributing

Keep the viewer dependency-free and usable by opening dashboard.html directly. Preserve keyboard navigation, lazy records, and count-only Privacy Mode.

Run `node --test` with Node.js 22+ and, in a Git checkout, `node scripts/check-public.mjs`. Test fixtures must be clearly fictional and must not be copied from a person's application history.

Review `git diff --cached` before committing. Stage specific public files rather than the whole workspace. Never force-add private runtime folders. If a new public source file is intentional, update the explicit allowlist in scripts/check-public.mjs.

Describe what changed and how it was verified. Do not claim mock-DOM tests are browser or visual tests.
