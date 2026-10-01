import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_FILES = new Set([
  ".gitignore",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "dashboard-local/dashboard-loader.js",
  "dashboard-local/privacy-mode.css",
  "dashboard-local/privacy-mode.js",
  "dashboard.html",
  "docs/AI_SETUP_PROMPT.md",
  "docs/DATA_MODEL.md",
  "scripts/check-public.mjs",
  "scripts/init.mjs",
  "scripts/validate.mjs",
  "templates/CANDIDATE_PROFILE.example.md",
  "templates/index.example.js",
  "templates/record.example.json",
  "tests/dashboard.test.mjs",
  "tests/data.test.mjs"
]);
const root = fileURLToPath(new URL('../', import.meta.url));

export function checkPublic(directory = root) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: directory, encoding: 'utf8' }).split('\0').filter(Boolean);
  if (!tracked.length) throw new Error('Stage the explicit public file list first.');
  for (const path of tracked) {
    if (!PUBLIC_FILES.has(path)) throw new Error('Unexpected public file: ' + path);
    if (!lstatSync(join(directory, path)).isFile()) throw new Error('Only regular text files may ship: ' + path);
    const text = readFileSync(join(directory, path), 'utf8');
    if (text.includes('\0')) throw new Error('Binary file rejected: ' + path);
    if (/(?:\/Users\/|\/home\/)[a-zA-Z0-9_.-]+\//.test(text)) throw new Error('Personal absolute path found: ' + path);
    if (/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text)) {
      throw new Error('Possible secret found: ' + path);
    }
  }
  for (const path of PUBLIC_FILES) if (!tracked.includes(path)) throw new Error('Expected public file missing: ' + path);
  // Verify important private categories are ignored and not already tracked.
  for (const path of ['dashboard-data/index.js', 'dashboard-data/records/private.js', 'CANDIDATE_PROFILE.md',
    'knowledge-base/private.md', 'working-applications/private/Resume.pdf', 'application-archives/private/evidence.md',
    'original-files/private.pdf', 'templates/resume/master.docx', 'logs/private.log', 'backups/private.md', '.env',
    '.openai/hosting.json']) {
    try { execFileSync('git', ['check-ignore', '-q', '--', path], { cwd: directory }); }
    catch { throw new Error('Private path is not ignored: ' + path); }
  }
  return tracked.length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log('Public allowlist passed: ' + checkPublic() + ' text files. Review content and history before pushing.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
