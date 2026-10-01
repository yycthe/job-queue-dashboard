import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { initialize } from '../scripts/init.mjs';
import { parseIndex, parseRecord, validateRecord, validate, materialPathIsSafe } from '../scripts/validate.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const example = () => JSON.parse(read('templates/record.example.json'));
function workspace(t) {
  const root = mkdtempSync(join(tmpdir(), 'job-dashboard-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'templates'));
  for (const name of ['index.example.js', 'CANDIDATE_PROFILE.example.md']) {
    writeFileSync(join(root, 'templates', name), read('templates/' + name));
  }
  initialize(root);
  return root;
}
function saveRecord(root, record) {
  writeFileSync(join(root, 'dashboard-data/records', record.id + '.js'),
    'window.DASHBOARD_RECORDS = window.DASHBOARD_RECORDS || {};\nwindow.DASHBOARD_RECORDS[' +
    JSON.stringify(record.id) + '] = ' + JSON.stringify(record) + ';\n');
}
function saveIndex(root, records) {
  const data = { generatedAt: '2025-01-01T00:00:00Z', queue: [], applications: [] };
  for (const r of records) {
    const view = r.phase === 'QUEUE' ? 'queue' : 'applications';
    const item = Object.fromEntries(['id', 'company', 'role', 'location', 'status', 'fitScore'].map(key => [key, r[key]]));
    data[view].push({ ...item, eventTime: view === 'queue' ? r.addedAt : r.submittedAt,
      recordFile: './dashboard-data/records/' + r.id + '.js' });
  }
  writeFileSync(join(root, 'dashboard-data/index.js'), 'window.DASHBOARD_INDEX = ' + JSON.stringify(data) + ';\n');
}
function readyRecord(root) {
  const record = example();
  record.status = 'READY_FOR_REVIEW';
  record.readyAt = record.addedAt;
  record.fitScore = 50;
  record.research = { checkedAt: record.addedAt, jobOpenVerified: true, duplicateCheckPassed: true,
    summary: 'Synthetic test research', fitRationale: 'Synthetic rubric: 50/100.' };
  mkdirSync(join(root, 'working-applications/example'), { recursive: true });
  // Minimal bytes for hash checks, not a usable candidate PDF or layout fixture.
  const pdf = Buffer.from('%PDF-1.4\nsynthetic-test-only');
  for (const key of ['resume', 'coverLetter']) {
    const fileName = key + '.pdf';
    writeFileSync(join(root, 'working-applications/example', fileName), pdf);
    record[key] = { ready: true, submitted: false, fileName,
      localPath: './working-applications/example/' + fileName, text: 'Fictional test material.',
      sha256: createHash('sha256').update(pdf).digest('hex') };
  }
  return record;
}

test('initialization creates empty private data and preserves existing data on repeat', t => {
  const root = workspace(t);
  assert.deepEqual(validate(root), { queue: 0, applications: 0 });
  writeFileSync(join(root, 'CANDIDATE_PROFILE.md'), 'Private test note');
  assert.ok(initialize(root).every(line => line.startsWith('Kept existing')));
  assert.equal(readFileSync(join(root, 'CANDIDATE_PROFILE.md'), 'utf8'), 'Private test note');
});

test('initialization rejects symlinked profile and data directories', t => {
  const root = workspace(t);
  rmSync(join(root, 'CANDIDATE_PROFILE.md'));
  symlinkSync(join(root, 'templates/CANDIDATE_PROFILE.example.md'), join(root, 'CANDIDATE_PROFILE.md'));
  assert.throws(() => initialize(root), /symlink/);
});

test('strict data parsers never evaluate trailing or embedded code', () => {
  assert.throws(() => parseIndex('window.DASHBOARD_INDEX = {}; throw new Error("executed")'));
  assert.throws(() => parseIndex('window.DASHBOARD_INDEX = { "queue": doSomething() };'));
  assert.throws(() => parseRecord('window.DASHBOARD_RECORDS["one"] = {"id":"two"};'), /differ/);
  assert.equal(parseRecord('window.DASHBOARD_RECORDS["one"] = {"id":"one"};').id, 'one');
  assert.throws(() => parseRecord('window.DASHBOARD_RECORDS["one"] = {"id":"one"}; alert(1)'));
});

test('empty and preparing datasets validate, while unindexed records fail', t => {
  const root = workspace(t);
  const record = example();
  saveRecord(root, record);
  assert.throws(() => validate(root), /Unindexed/);
  saveIndex(root, [record]);
  assert.deepEqual(validate(root), { queue: 1, applications: 0 });
});

test('index cannot disagree, duplicate an ID, reference a remote path or omit a record', t => {
  const root = workspace(t), record = example();
  saveRecord(root, record); saveIndex(root, [record]);
  for (const change of [
    data => { data.queue[0].company = 'Different example'; },
    data => { data.queue.push(data.queue[0]); },
    data => { data.queue[0].recordFile = 'https://example.invalid/remote.js'; },
    data => { data.queue[0].recordFile = './dashboard-data/records/../index.js'; },
  ]) {
    saveIndex(root, [record]);
    const data = parseIndex(readFileSync(join(root, 'dashboard-data/index.js'), 'utf8'));
    change(data);
    writeFileSync(join(root, 'dashboard-data/index.js'), 'window.DASHBOARD_INDEX = ' + JSON.stringify(data));
    assert.throws(() => validate(root));
  }
  saveIndex(root, [record]); rmSync(join(root, 'dashboard-data/records', record.id + '.js'));
  assert.throws(() => validate(root));
});

test('READY_FOR_REVIEW requires real material bytes, matching hashes, text, research and rationale', t => {
  const root = workspace(t), ready = readyRecord(root);
  assert.equal(validateRecord(ready, root).status, 'READY_FOR_REVIEW');
  for (const change of [
    r => { r.resume.sha256 = '0'.repeat(64); },
    r => { r.resume.text = ''; },
    r => { r.coverLetter.ready = false; },
    r => { r.research.duplicateCheckPassed = false; },
    r => { r.research.jobOpenVerified = false; },
    r => { r.research.fitRationale = ''; },
    r => { r.fitScore = null; },
  ]) {
    const broken = structuredClone(ready); change(broken);
    assert.throws(() => validateRecord(broken, root));
  }
});

test('submission and blocked states need scoped evidence fields', t => {
  const root = workspace(t), record = readyRecord(root);
  record.status = 'SUBMITTING';
  assert.throws(() => validateRecord(record, root), /approval/);
  record.review.status = 'APPROVED';
  record.approvedAt = record.addedAt; record.approvedScope = record.id;
  record.approvalNote = 'Synthetic test approval, not real permission.';
  validateRecord(record, root);
  record.status = 'NEEDS_USER';
  assert.throws(() => validateRecord(record, root), /blocker/);
  record.blocker = { issue: 'Example', completed: 'Example', userStep: 'Example', resumeFrom: 'SUBMITTING' };
  validateRecord(record, root);
});

test('Applications preserve submission evidence through interview and cannot contain NEEDS_USER', t => {
  const root = workspace(t), record = example();
  record.phase = 'APPLICATIONS'; record.status = 'INTERVIEW';
  assert.throws(() => validateRecord(record, root), /confirmation/);
  record.submittedAt = record.addedAt;
  record.confirmation = { confirmedAt: record.addedAt, summary: 'Synthetic confirmation', reference: 'private/test-evidence' };
  saveRecord(root, record); saveIndex(root, [record]);
  assert.deepEqual(validate(root), { queue: 0, applications: 1 });
  record.status = 'NEEDS_USER';
  assert.throws(() => validateRecord(record, root), /placement/);
});

test('unsafe material paths and external job schemes are rejected', () => {
  for (const path of ['../outside.pdf', '/absolute.pdf', 'file:///outside.pdf', './working-applications/../outside.pdf',
    './working-applications/%2e%2e/outside.pdf', './working-applications/a\\outside.pdf', './working-applications/a.html']) {
    assert.equal(materialPathIsSafe(path), false, path);
  }
  assert.equal(materialPathIsSafe('./application-archives/example/My Resume.pdf'), true);
  const record = example();
  for (const canonicalUrl of ['javascript:alert(1)', 'data:text/plain,test', 'https://name:secret@example.invalid']) {
    assert.throws(() => validateRecord({ ...record, canonicalUrl }));
  }
});

test('symlink escapes are rejected when reading a material', t => {
  const root = workspace(t), record = readyRecord(root);
  const outside = mkdtempSync(join(tmpdir(), 'job-dashboard-external-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const path = join(root, record.resume.localPath);
  const bytes = readFileSync(path);
  writeFileSync(join(outside, 'document.pdf'), bytes);
  rmSync(path);
  symlinkSync(join(outside, 'document.pdf'), path);
  assert.throws(() => validateRecord(record, root), /outside the workspace/);
});
