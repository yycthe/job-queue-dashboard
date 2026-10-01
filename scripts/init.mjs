import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function initialize(root = projectRoot) {
  // Refuse linked destinations rather than copying private data outside this workspace.
  for (const relative of ['dashboard-data', 'dashboard-data/records', 'dashboard-data/index.js', 'CANDIDATE_PROFILE.md']) {
    const path = join(root, relative);
    try {
      if (lstatSync(path).isSymbolicLink()) throw new Error('Initialization refuses symlink: ' + relative);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  mkdirSync(join(root, 'dashboard-data', 'records'), { recursive: true });
  const results = [];
  for (const [source, target] of [
    ['templates/index.example.js', 'dashboard-data/index.js'],
    ['templates/CANDIDATE_PROFILE.example.md', 'CANDIDATE_PROFILE.md'],
  ]) {
    const path = join(root, target);
    if (existsSync(path)) { results.push('Kept existing ' + target); continue; }
    writeFileSync(path, readFileSync(join(root, source)), { flag: 'wx', mode: 0o600 });
    results.push('Created private ' + target);
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    for (const line of initialize()) console.log(line);
    console.log('Open dashboard.html in your desktop browser. No server is required.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
