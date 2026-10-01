import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const html = read('dashboard.html');
const scripts = Object.fromEntries(['privacy-mode', 'dashboard-loader'].map(name => [name, read('dashboard-local/' + name + '.js')]));
const storageKey = 'job-dashboard:privacy-mode';

function fixture() {
  const item = (view, i, status) => ({
    id: view + '-' + i, company: 'Company ' + i, role: 'Implementation Consultant',
    location: 'Example City', status, eventTime: new Date(Date.UTC(2025, 8, 1, 0, i)).toISOString(),
    recordFile: './dashboard-data/records/' + view + '-' + i + '.js',
  });
  return {
    queue: Array.from({ length: 31 }, (_, i) => item('queue', i, 'READY_FOR_REVIEW')),
    applications: Array.from({ length: 60 }, (_, i) => item('application', i,
      i < 28 ? 'INTERVIEW' : i < 58 ? 'APPLIED_CONFIRMED' : 'REJECTED')),
  };
}

function page({ query = '', saved, storage = new Map(saved === undefined ? [] : [[storageKey, saved]]),
  storageBlocked = false, historyBlocked = false, broken = false, invalid = false,
  index = fixture(), records = {} } = {}) {
  class Element {
    constructor(id) {
      this.id = id; this.dataset = {}; this.attributes = {}; this.listeners = {};
      this.children = []; this.value = ''; this.hidden = false; this._html = ''; this._text = '';
      this.classList = { toggle() {} };
    }
    set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
    get textContent() { return this._text; }
    set innerHTML(value) { this._html = String(value); this._text = ''; this.children = []; }
    get innerHTML() { return this._html; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name]; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; this._html = ''; this._text = ''; this.value = ''; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    click() { if (!this.disabled) this.listeners.click?.({ target: this }); }
  }
  const markup = html;
  const main = markup.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const elements = new Map([...markup.matchAll(/id="([^"]+)"/g)].map(match => [match[1], new Element(match[1])]));
  elements.get('sort').value = 'newest';
  elements.get('privacyModeToggle').disabled = true;
  const all = new Element('option'); all.value = ''; all.textContent = 'All statuses';
  elements.get('statusFilter').appendChild(all);
  const tabs = ['queue', 'applications'].map(view => Object.assign(new Element(), { dataset: { view } }));
  const loaded = []; const replaced = [];
  const document = {
    title: 'Job Queue', documentElement: new Element(), body: new Element(), head: new Element(),
    getElementById(id) { assert.ok(elements.has(id), 'Missing element ' + id); return elements.get(id); },
    querySelectorAll(selector) { assert.equal(selector, '.tab'); return tabs; },
    createElement(tag) { return new Element(tag); }, addEventListener() {},
  };
  const window = {
    location: new URL('file:///test-project/dashboard.html' + query),
    localStorage: {
      getItem(key) { if (storageBlocked) throw new Error('Storage unavailable'); return storage.get(key) ?? null; },
      setItem(key, value) { if (storageBlocked) throw new Error('Storage unavailable'); storage.set(key, value); },
    },
    history: { replaceState(state, title, url) {
      if (historyBlocked) throw new Error('History unavailable');
      replaced.push(url); window.location = new URL(url);
    } },
  };
  const context = vm.createContext({ window, document, URL, URLSearchParams });
  document.body.appendChild = script => {
    loaded.push(script.src);
    if (script.src === './dashboard-data/index.js') {
      if (broken) { script.onerror(); return; }
      window.DASHBOARD_INDEX = invalid ? {} : structuredClone(index);
      script.onload();
    } else if (script.src.startsWith('./dashboard-data/records/')) {
      const item = [...index.queue, ...index.applications].find(item => item.recordFile === script.src);
      assert.ok(item, 'Unexpected record load');
      window.DASHBOARD_RECORDS[item.id] = structuredClone(records[item.id] || {
        ...item, jobId: '467', fitScore: 82, addedAt: item.eventTime,
        phase: item.id.startsWith('application') ? 'APPLICATIONS' : 'QUEUE',
        canonicalUrl: 'https://example.invalid/careers/467', review: { required: true, status: 'PENDING' },
        resume: { fileName: 'Resume.pdf', localPath: './working-applications/example/materials/Resume.pdf' },
        coverLetter: { fileName: 'Cover Letter.pdf', localPath: './working-applications/example/materials/Cover Letter.pdf' },
        research: { summary: 'Implementation and client delivery.', knownGaps: ['Platform-specific onboarding.'] },
        blocker: { issue: 'Candidate action needed.', userStep: 'Review the materials.' },
        notes: 'Experience: 5 years',
      });
      script.onload();
    } else assert.fail('Unexpected script: ' + script.src);
  };
  vm.runInContext(scripts['privacy-mode'], context);
  vm.runInContext(main, context);
  vm.runInContext(scripts['dashboard-loader'], context);
  return {
    window, document, loaded, replaced, storage,
    element(id) { return elements.get(id); },
    toggle() { elements.get('privacyModeToggle').click(); },
    view(name) { tabs.find(tab => tab.dataset.view === name).click(); },
    options() { return elements.get('statusFilter').children.map(option => [option.value, option.textContent]); },
    change(id, value) { elements.get(id).value = value; elements.get(id).listeners[id === 'search' ? 'input' : 'change'](); },
    record(id) { elements.get('list').listeners.click({ target: { closest: () => ({ dataset: { id } }) } }); },
  };
}

function assertMasked(p) {
  for (const id of ['queueCount', 'applicationCount']) {
    assert.equal(p.element(id).textContent, '—');
    assert.equal(p.element(id).attributes['aria-label'], 'Count hidden');
    assert.doesNotMatch(JSON.stringify(p.element(id).attributes), /\d/);
  }
  assert.ok(p.options().every(([, label]) => !/\d|\([^)]+\)/.test(label)));
  assert.match(p.element('pageStatus').textContent, /^Page \d+$/);
  assert.equal(p.element('privacyModeToggle').attributes['aria-checked'], 'true');
  assert.equal(p.element('privacyModeState').textContent, 'On');
}

test('default view shows real counts and always loads the real index', () => {
  const p = page();
  assert.deepEqual(p.loaded, ['./dashboard-data/index.js']);
  assert.equal(p.element('queueCount').textContent, '31');
  assert.equal(p.element('applicationCount').textContent, '60');
  assert.deepEqual(p.options(), [['', 'All statuses'], ['INTERVIEW', 'INTERVIEW (28)'],
    ['APPLIED_CONFIRMED', 'APPLIED CONFIRMED (30)'], ['REJECTED', 'REJECTED (2)']]);
  assert.equal(p.element('pageStatus').textContent, 'Page 1 of 2 · 31 records');
  assert.equal(p.element('privacyModeToggle').attributes['aria-checked'], 'false');
  assert.equal(p.element('privacyModeToggle').disabled, false);
  assert.equal(p.document.title, 'Job Queue Dashboard');
});

test('Privacy Mode masks counts in tabs, opened native filters and pagination without replacing data', () => {
  const p = page({ query: '?privacy=1' });
  assertMasked(p);
  assert.deepEqual(p.loaded, ['./dashboard-data/index.js']);
  assert.match(p.element('list').innerHTML, /Company 30/);
  assert.match(p.element('list').innerHTML, /2025/);
  p.view('applications');
  assertMasked(p);
  assert.equal(p.element('statusFilter').hidden, false);
  assert.deepEqual(p.options().map(([value]) => value), ['', 'INTERVIEW', 'APPLIED_CONFIRMED', 'REJECTED']);
  p.change('statusFilter', 'INTERVIEW');
  assertMasked(p);
  assert.doesNotMatch(p.element('list').innerHTML, /APPLIED_CONFIRMED/);
  p.element('nextPage').click();
  assert.equal(p.element('pageStatus').textContent, 'Page 2');
  assert.equal(p.element('nextPage').disabled, true);
  p.change('search', 'Company 2');
  assertMasked(p);
  assert.equal(p.element('pageStatus').textContent, 'Page 1');
  p.change('search', 'No match');
  assertMasked(p);
  assert.match(p.element('list').innerHTML, /Nothing found/);
});

test('toggling preserves selection, search, sort, page, open details and record cache without loading scripts', () => {
  const p = page();
  p.view('applications');
  p.change('statusFilter', 'INTERVIEW');
  p.change('search', 'Implementation');
  p.change('sort', 'oldest');
  p.element('nextPage').click();
  p.record('application-26');
  const rows = p.element('list').innerHTML, detail = p.element('detailBody').innerHTML;
  const data = p.window.DASHBOARD_INDEX, cache = p.window.DASHBOARD_RECORDS;
  const loaded = [...p.loaded];
  p.toggle();
  assertMasked(p);
  assert.equal(p.element('pageStatus').textContent, 'Page 2');
  assert.equal(p.element('statusFilter').value, 'INTERVIEW');
  assert.equal(p.element('search').value, 'Implementation');
  assert.equal(p.element('sort').value, 'oldest');
  assert.equal(p.element('list').innerHTML, rows);
  assert.equal(p.element('detailBody').innerHTML, detail);
  assert.equal(p.element('detailDialog').open, true);
  p.toggle();
  assert.equal(p.element('queueCount').textContent, '31');
  assert.equal(p.element('applicationCount').textContent, '60');
  assert.equal(p.element('pageStatus').textContent, 'Page 2 of 2 · 28 records');
  assert.equal(p.element('statusFilter').value, 'INTERVIEW');
  assert.equal(p.window.DASHBOARD_INDEX, data);
  assert.equal(p.window.DASHBOARD_RECORDS, cache);
  assert.deepEqual(p.loaded, loaded);
});

test('records still load lazily and retain fit scores, dates, job links and both original material links', () => {
  const p = page({ query: '?privacy=1' });
  p.record('queue-30');
  assert.equal(p.loaded.at(-1), './dashboard-data/records/queue-30.js');
  const detail = p.element('detailBody').innerHTML;
  for (const text of ['82 / 100', '467', '2025', 'Open job posting', 'Your action:', 'Waiting for your review', '5 years']) assert.ok(detail.includes(text), text);


  p.element('nextRecord').click();
  assert.equal(p.element('detailCompany').textContent, 'Company 29');
  p.element('previousRecord').click();
  assert.equal(p.loaded.filter(path => path.endsWith('queue-30.js')).length, 1);
});

test('setting persists and explicit privacy URLs override the saved preference', () => {
  const p = page(); p.toggle();
  assert.equal(p.storage.get(storageKey), '1');
  assertMasked(page({ storage: p.storage }));
  assertMasked(page({ query: '?privacy=1', saved: '0' }));
  const off = page({ query: '?privacy=0', saved: '1' });
  assert.equal(off.element('queueCount').textContent, '31');
  assert.equal(off.storage.get(storageKey), '0');
  p.toggle();
  assert.equal(page({ storage: p.storage }).element('queueCount').textContent, '31');
});

test('unavailable local storage or history does not break the page or current-page toggle', () => {
  for (const settings of [{ storageBlocked: true }, { historyBlocked: true }, { storageBlocked: true, historyBlocked: true }]) {
    const p = page({ query: '?privacy=1', ...settings });
    assertMasked(p);
    p.toggle();
    assert.equal(p.element('queueCount').textContent, '31');
    p.toggle();
    assertMasked(p);
  }
});

test('missing or invalid real index reports a clear error without loading alternate records', () => {
  for (const settings of [{ broken: true }, { invalid: true }]) {
    const p = page({ query: '?privacy=1', ...settings });
    assert.deepEqual(p.loaded, ['./dashboard-data/index.js']);
    assert.match(p.element('list').textContent, /local application index could not be loaded/);
    assert.equal(p.element('privacyModeToggle').disabled, true);
  }
});

test('empty lists mask zero totals and still support toggling and the all-statuses option', () => {
  const p = page({ query: '?privacy=1', index: { queue: [], applications: [] } });
  assertMasked(p);
  assert.deepEqual(p.options(), [['', 'All statuses']]);
  p.toggle();
  assert.equal(p.element('queueCount').textContent, '0');
  assert.equal(p.element('applicationCount').textContent, '0');
});


test('material text is escaped and visible without a PDF; executable links are rejected', () => {
  const p = page({ records: { 'queue-30': {
    id: 'queue-30', phase: 'QUEUE', status: 'PREPARING',
    canonicalUrl: 'javascript:alert(1)',
    resume: { fileName: 'Resume.pdf', text: '<script>bad()</script>\nA supported claim.' },
    coverLetter: { localPath: './working-applications/../private.pdf', text: 'Dear hiring team,' },
  } } });
  p.record('queue-30');
  const body = p.element('detailBody').innerHTML;
  assert.match(body, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(body, /A supported claim/);
  assert.match(body, /Dear hiring team/);
  assert.doesNotMatch(body, /href=|<script>/);
});

test('links use relative material paths and URL-encoded filenames', () => {
  const p = page({ records: { 'queue-30': {
    phase: 'QUEUE', resume: { localPath: './working-applications/example/My Resume.pdf' },
  } } });
  p.record('queue-30');
  assert.ok(p.element('detailBody').innerHTML.includes('href="./working-applications/example/My%20Resume.pdf"'));
});

test('remote and traversal record scripts are never loaded', () => {
  for (const recordFile of ['https://example.invalid/record.js', './dashboard-data/records/../private.js']) {
    const index = fixture();
    index.queue[30].recordFile = recordFile;
    const p = page({ index });
    p.record('queue-30');
    assert.deepEqual(p.loaded, ['./dashboard-data/index.js']);
    assert.match(p.element('detailBody').textContent, /Unsafe record path/);
  }
});

test('export has no sync controller or external resources', () => {
  assert.doesNotMatch(html, /sync-panel|sync-controls|https?:\/\//);
  assert.doesNotMatch(scripts['dashboard-loader'], /sync|fetch\(/);
});
