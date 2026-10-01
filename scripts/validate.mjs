import { readFileSync, realpathSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const queueStates = new Set(['PREPARING', 'READY_FOR_REVIEW', 'APPROVED_TO_SUBMIT', 'SUBMITTING', 'SUBMITTED_UNVERIFIED', 'NEEDS_USER', 'JOB_CLOSED', 'DUPLICATE', 'WITHDRAWN']);
const applicationStates = new Set(['APPLIED_CONFIRMED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const timestamp = value => nonempty(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
function requireValue(condition, message) { if (!condition) throw new Error(message); }

export function parseIndex(text) {
  const match = text.trim().match(/^window\.DASHBOARD_INDEX\s*=\s*(\{[\s\S]*\})\s*;?$/);
  requireValue(match, 'Index must contain only window.DASHBOARD_INDEX = <strict JSON>;');
  return JSON.parse(match[1]);
}

export function parseRecord(text) {
  const match = text.trim().match(/^(?:window\.DASHBOARD_RECORDS\s*=\s*window\.DASHBOARD_RECORDS\s*\|\|\s*\{\}\s*;\s*)?window\.DASHBOARD_RECORDS\["([a-z0-9]+(?:-[a-z0-9]+)*)"\]\s*=\s*(\{[\s\S]*\})\s*;?$/);
  requireValue(match, 'Record must contain only the documented strict-JSON assignment.');
  const record = JSON.parse(match[2]);
  requireValue(record.id === match[1], 'Record assignment key and id differ.');
  return record;
}

export function materialPathIsSafe(path) {
  return typeof path === 'string' &&
    /^\.\/(working-applications|application-archives)\//.test(path) &&
    /\.pdf$/i.test(path) &&
    !path.slice(2).split('/').some(part => !part || part === '.' || part === '..' || /[\\%:#?\x00-\x1f]/.test(part));
}

function inside(root, path) {
  const base = realpathSync(root);
  const actual = realpathSync(join(base, path));
  const rel = relative(base, actual);
  requireValue(rel && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), 'Path resolves outside the workspace.');
  return actual;
}

export function validateRecord(record, root = projectRoot) {
  requireValue(record && typeof record === 'object', 'Record must be an object.');
  requireValue(idPattern.test(record.id), 'Invalid record id.');
  for (const key of ['company', 'role', 'status', 'nextAction']) requireValue(nonempty(record[key]), 'Missing ' + key);
  const states = record.phase === 'QUEUE' ? queueStates : record.phase === 'APPLICATIONS' ? applicationStates : null;
  requireValue(states?.has(record.status), 'Invalid phase or status placement.');
  for (const field of ['addedAt', 'lastUpdatedAt']) requireValue(timestamp(record[field]), 'Missing or invalid ' + field);
  for (const field of ['readyAt', 'approvedAt', 'submittedAt']) {
    if (record[field] != null) requireValue(timestamp(record[field]), 'Invalid ' + field);
  }
  requireValue(record.fitScore == null || (typeof record.fitScore === 'number' && Number.isFinite(record.fitScore) && record.fitScore >= 0 && record.fitScore <= 100), 'Fit score must be null or 0..100.');
  if (record.canonicalUrl) {
    const url = new URL(record.canonicalUrl);
    requireValue(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, 'Unsafe job URL.');
  }
  const ready = ['READY_FOR_REVIEW', 'APPROVED_TO_SUBMIT', 'SUBMITTING', 'SUBMITTED_UNVERIFIED'].includes(record.status);
  const submitted = record.phase === 'APPLICATIONS';
  if (ready) {
    requireValue(timestamp(record.readyAt), 'Review-ready records need readyAt.');
    requireValue(timestamp(record.research?.checkedAt) && record.research?.jobOpenVerified === true && record.research?.duplicateCheckPassed === true,
      'Review-ready records need dated posting and duplicate checks.');
    requireValue(nonempty(record.research?.summary), 'Review-ready records need research.');
    requireValue(typeof record.fitScore === 'number' && nonempty(record.research?.fitRationale), 'Review-ready records need an explained fit score.');
  }
  if (['APPROVED_TO_SUBMIT', 'SUBMITTING', 'SUBMITTED_UNVERIFIED'].includes(record.status)) {
    requireValue(record.review?.status === 'APPROVED' && timestamp(record.approvedAt) &&
      nonempty(record.approvedScope) && nonempty(record.approvalNote), 'Submission needs a recorded, scoped approval.');
  }
  if (submitted) {
    requireValue(timestamp(record.submittedAt) && timestamp(record.confirmation?.confirmedAt) &&
      nonempty(record.confirmation?.summary) && nonempty(record.confirmation?.reference),
    'Applications require dated official confirmation with an evidence reference.');
  }
  if (record.status === 'NEEDS_USER') {
    for (const field of ['issue', 'completed', 'userStep', 'resumeFrom']) {
      requireValue(nonempty(record.blocker?.[field]), 'NEEDS_USER requires blocker.' + field);
    }
  }
  if (['JOB_CLOSED', 'DUPLICATE', 'WITHDRAWN'].includes(record.status) && !submitted) {
    requireValue(nonempty(record.terminalEvidence?.summary) && nonempty(record.terminalEvidence?.reference), 'Unsubmitted terminal outcomes need evidence.');
  }
  for (const field of ['resume', 'coverLetter']) {
    const material = record[field];
    if (ready) requireValue(material?.ready === true && nonempty(material.text) && material.localPath, 'Missing review-ready ' + field);
    if (!material) continue;
    if (material.ready) requireValue(nonempty(material.text) && material.localPath, 'Ready material needs text and a PDF path.');
    if (material.submitted) requireValue(material.ready === true, 'Submitted material must be ready.');
    if (material.localPath) {
      requireValue(materialPathIsSafe(material.localPath), 'Unsafe material path.');
      requireValue(material.fileName === material.localPath.split('/').at(-1), 'Material filename differs from path.');
      requireValue(/^[a-f0-9]{64}$/.test(material.sha256), 'Material needs a SHA-256 hash.');
      const contents = readFileSync(inside(root, material.localPath));
      requireValue(contents.subarray(0, 5).toString() === '%PDF-', 'Material is not a PDF.');
      requireValue(createHash('sha256').update(contents).digest('hex') === material.sha256, 'Material hash differs.');
    }
  }
  return record;
}

export function validate(root = projectRoot) {
  const index = parseIndex(readFileSync(inside(root, 'dashboard-data/index.js'), 'utf8'));
  requireValue(Array.isArray(index.queue) && Array.isArray(index.applications), 'Index needs queue and applications arrays.');
  requireValue(index.generatedAt === null || timestamp(index.generatedAt), 'Invalid index generatedAt.');
  const ids = new Set();
  for (const view of ['queue', 'applications']) for (const item of index[view]) {
    requireValue(item && idPattern.test(item.id) && !ids.has(item.id), 'Invalid or duplicate index ID.');
    ids.add(item.id);
    requireValue(item.recordFile === './dashboard-data/records/' + item.id + '.js', 'Unexpected record path.');
    const record = validateRecord(parseRecord(readFileSync(inside(root, item.recordFile), 'utf8')), root);
    requireValue(record.phase === (view === 'queue' ? 'QUEUE' : 'APPLICATIONS'), 'Record is in the wrong view.');
    for (const field of ['id', 'company', 'role', 'location', 'status', 'fitScore']) {
      requireValue((item[field] ?? null) === (record[field] ?? null), 'Index differs from record: ' + item.id + ' / ' + field);
    }
    requireValue(item.eventTime === (record.phase === 'QUEUE' ? record.addedAt : record.submittedAt), 'Index eventTime differs.');
  }
  const recordDir = inside(root, 'dashboard-data/records');
  for (const entry of readdirSync(recordDir, { withFileTypes: true })) {
    requireValue(entry.isFile() && /^[a-z0-9]+(?:-[a-z0-9]+)*\.js$/.test(entry.name), 'Unexpected record-directory entry.');
    requireValue(ids.has(entry.name.slice(0, -3)), 'Unindexed record: ' + entry.name);
  }
  return { queue: index.queue.length, applications: index.applications.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--record' && process.argv.length === 4) {
      const path = relative(projectRoot, resolve(process.cwd(), process.argv[3]));
      requireValue(/^dashboard-data\/records\/[a-z0-9]+(?:-[a-z0-9]+)*\.js$/.test(path), 'Choose a local record file.');
      validateRecord(parseRecord(readFileSync(inside(projectRoot, path), 'utf8')));
      console.log('Record valid. Update the index, then run full validation.');
    } else {
      requireValue(process.argv.length === 2, 'Usage: node scripts/validate.mjs [--record dashboard-data/records/<id>.js]');
      const result = validate();
      console.log('Valid local dataset: ' + result.queue + ' queue, ' + result.applications + ' applications.');
    }
  } catch (error) { console.error('Validation failed: ' + error.message); process.exitCode = 1; }
}
