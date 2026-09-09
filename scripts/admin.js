const $ = id => document.getElementById(id);
const state = {
  kind: 'applications', status: 'pending', q: '', page: 1, records: [], counts: {},
  selectedId: null, pagination: null, authed: false, saving: false, drafts: new Map(),
};
const statuses = ['pending', 'reviewing', 'approved', 'rejected', 'all'];
let loadController, loadVersion = 0, searchTimer;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const title = value => value.charAt(0).toUpperCase() + value.slice(1);
const date = value => new Date(value).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });

function feedback(message = '', error = false) {
  $('feedback').textContent = message;
  $('feedback').classList.toggle('error', error);
}

function showGate(message = '') {
  state.authed = false;
  loadController?.abort();
  loadVersion++;
  state.records = [];
  state.selectedId = null;
  $('list').replaceChildren();
  $('detail').replaceChildren();
  $('app').classList.remove('show');
  $('gate').style.display = '';
  $('gate-err').textContent = message;
  $('gate-btn').disabled = false;
  $('gate-btn').textContent = 'Sign in';
  $('pw').value = '';
}

async function request(url, { confirmed = true, signal, ...options } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once:true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 15000);
  try {
    const response = await fetch(url, { ...options, signal:controller.signal, credentials:'same-origin', cache:'no-store' });
    const data = await response.json().catch(() => null);
    if (response.status === 401 && !url.endsWith('/login')) {
      showGate('Your session expired. Sign in again to continue.');
      throw new Error('Session expired');
    }
    if (!response.ok || !data || (confirmed && data.ok !== true)) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Could not confirm the request. Please try again.');
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('The request took too long. Please try again.');
    if (error instanceof TypeError) throw new Error('Could not connect. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

async function checkSession() {
  try {
    const session = await request('/api/admin/session', { confirmed:false });
    if (session.authed === true) {
      state.authed = true;
      $('gate').style.display = 'none';
      $('app').classList.add('show');
      await load();
    } else showGate();
  } catch (error) { showGate(error.message); }
}

$('gate-form').addEventListener('submit', async event => {
  event.preventDefault();
  if ($('gate-btn').disabled) return;
  $('gate-btn').disabled = true;
  $('gate-btn').textContent = 'Signing in...';
  $('gate-err').textContent = '';
  try {
    await request('/api/admin/login', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ password:$('pw').value }),
    });
    $('pw').value = '';
    state.authed = true;
    $('gate').style.display = 'none';
    $('app').classList.add('show');
    await load();
  } catch (error) {
    $('gate-err').textContent = error.message;
  } finally {
    $('gate-btn').disabled = false;
    $('gate-btn').textContent = 'Sign in';
  }
});

$('logout').addEventListener('click', async () => {
  if (state.saving) return;
  if (state.drafts.size && !window.confirm('Sign out and discard your unsaved notes?')) return;
  $('logout').disabled = true;
  try {
    await request('/api/admin/logout', { method:'POST' });
    state.drafts.clear();
    showGate('Signed out.');
    $('pw').focus();
  } catch (error) { feedback(error.message, true); }
  finally { $('logout').disabled = false; }
});

function pageButtons(loading = false) {
  $('previous').disabled = loading || state.page <= 1;
  $('next').disabled = loading || !state.pagination?.hasMore;
  $('refresh').disabled = loading || state.saving;
}

async function load(successMessage = '') {
  if (!state.authed || state.saving) return;
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  const version = ++loadVersion;
  pageButtons(true);
  $('list').setAttribute('aria-busy', 'true');
  feedback('Loading submissions...');
  const params = new URLSearchParams({ page:String(state.page), limit:'25' });
  if (state.kind === 'applications') params.set('status', state.status);
  if (state.q) params.set('q', state.q);
  try {
    const data = await request(`/api/admin/${state.kind}?${params}`, { signal:controller.signal });
    if (version !== loadVersion || !state.authed) return;
    const records = state.kind === 'applications' ? data.applications : data.signups;
    if (!Array.isArray(records) || !data.pagination) throw new Error('Could not read the inbox. Please refresh.');
    state.records = records;
    state.counts = data.counts || {};
    state.pagination = data.pagination;
    if (!records.length && state.page > 1) {
      state.page = Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize));
      return load(successMessage);
    }
    renderTabs();
    renderList();
    const selected = records.find(row => row.id === state.selectedId);
    if (selected) renderDetail(selected);
    else {
      state.selectedId = null;
      $('detail').innerHTML = '<div class="ad-empty">Select a submission to see the details.</div>';
    }
    const total = data.pagination.total;
    const first = total ? (state.page - 1) * data.pagination.pageSize + 1 : 0;
    $('page-info').textContent = `${first}-${first ? first + records.length - 1 : 0} of ${total}`;
    feedback(successMessage || (state.drafts.size ? 'You have unsaved notes. Open that application to save them.' : ''));
  } catch (error) {
    if (controller.signal.aborted || version !== loadVersion || !state.authed) return;
    feedback(error.message, true);
    if (!state.records.length) $('list').innerHTML = '<div class="ad-empty">Could not load submissions. Use Refresh to try again.</div>';
  } finally {
    if (version === loadVersion) {
      $('list').removeAttribute('aria-busy');
      pageButtons();
    }
  }
}

function resetView() {
  state.page = 1;
  state.selectedId = null;
  state.records = [];
  $('list').innerHTML = '<div class="ad-empty">Loading submissions...</div>';
  $('detail').innerHTML = '<div class="ad-empty">Select a submission to see the details.</div>';
}

document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  if (state.saving || button.dataset.kind === state.kind) return;
  state.kind = button.dataset.kind;
  state.q = '';
  $('search').value = '';
  clearTimeout(searchTimer);
  document.querySelectorAll('[data-kind]').forEach(item => {
    item.classList.toggle('active', item.dataset.kind === state.kind);
    item.setAttribute('aria-pressed', String(item.dataset.kind === state.kind));
  });
  $('search').placeholder = state.kind === 'applications' ? 'Search name, email, credits...' : 'Search email, specialty, credits...';
  resetView();
  renderTabs();
  load();
}));

function renderTabs() {
  $('tabs').hidden = state.kind !== 'applications';
  if ($('tabs').hidden) return;
  const total = Object.values(state.counts).reduce((sum, n) => sum + n, 0);
  $('tabs').innerHTML = statuses.map(status => `<button type="button" class="ad-tab ${state.status === status ? 'active' : ''}" aria-pressed="${state.status === status}" data-status="${status}">${title(status)} <span class="ad-tab-count">${status === 'all' ? total : state.counts[status] || 0}</span></button>`).join('');
  $('tabs').querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => {
    if (state.saving) return;
    state.status = button.dataset.status;
    resetView();
    renderTabs();
    load();
  }));
}

function renderList() {
  if (!state.records.length) {
    $('list').innerHTML = `<div class="ad-empty">${state.q ? 'No submissions match that search.' : state.kind === 'waitlist' ? 'No waitlist signups yet.' : state.status === 'all' ? 'No applications yet.' : `No ${esc(state.status)} applications.`}</div>`;
    return;
  }
  $('list').innerHTML = state.records.map(row => `<button type="button" class="ad-item ${row.id === state.selectedId ? 'active' : ''}" data-id="${esc(row.id)}" aria-pressed="${row.id === state.selectedId}">
    <div class="ad-item-top"><span class="ad-item-name">${esc(row.full_name || row.email)}</span><span class="ad-item-date">${esc(date(row.created_at))}</span></div>
    ${row.full_name ? `<div class="ad-item-sub">${esc(row.email)}</div>` : ''}
    <div class="ad-item-specs">${row.status ? `<span class="pill status-${esc(row.status)}">${esc(title(row.status))}</span>` : ''}
    ${(row.specialties || (row.specialty ? [row.specialty] : [])).slice(0, 2).map(s => `<span class="pill">${esc(s)}</span>`).join('')}
    ${state.drafts.has(row.id) ? '<span class="pill">Unsaved notes</span>' : ''}</div>
  </button>`).join('');
  $('list').querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => {
    if (state.saving) return;
    state.selectedId = button.dataset.id;
    renderList();
    renderDetail(state.records.find(row => row.id === state.selectedId));
    if (matchMedia('(max-width:900px)').matches) $('detail').scrollIntoView({ block:'start', behavior:'instant' });
    $('detail-title').focus({ preventScroll:true });
  }));
}

const cell = (label, value) => `<div><div class="ad-cell-label">${label}</div><div class="ad-cell-value">${value || '<span class="muted">Not provided</span>'}</div></div>`;
function link(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return esc(value);
    return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(url.host + url.pathname)}</a>`;
  } catch { return esc(value); }
}

function renderDetail(row) {
  if (!row) return;
  const application = state.kind === 'applications';
  const notes = state.drafts.get(row.id) ?? row.admin_notes ?? '';
  $('detail').innerHTML = `
    <button type="button" class="ad-btn ad-back-list" id="back-list">Back to submissions</button>
    <div class="ad-d-head"><div><h2 class="ad-d-name" id="detail-title" tabindex="-1">${esc(row.full_name || 'Waitlist signup')}</h2><div class="ad-d-mail"><a href="mailto:${esc(encodeURIComponent(row.email))}">${esc(row.email)}</a></div></div>${application ? `<span class="pill status-${esc(row.status)}">${esc(title(row.status))}</span>` : ''}</div>
    <div class="ad-grid">${cell(application ? 'Applied' : 'Joined', esc(date(row.created_at)))}
      ${application ? [cell('Country',esc(row.country)),cell('Experience',row.years_experience != null ? `${row.years_experience} years` : ''),cell('Availability',row.hours_per_week != null ? `${row.hours_per_week} hours/week` : ''),cell('Hourly rate',row.hourly_rate_usd != null ? `$${Number(row.hourly_rate_usd).toFixed(2)} USD` : ''),cell('Heard via',esc(row.heard_from))].join('') : cell('Specialty',esc(row.specialty))}</div>
    ${application ? `<div class="ad-grid">${cell('Portfolio',link(row.portfolio_url))}${cell('GitHub',link(row.github_url))}${cell('LinkedIn',link(row.linkedin_url))}${cell('Video',link(row.video_url))}</div><div class="ad-block"><h3 class="ad-block-title">Specialties, ranked</h3><div class="ad-item-specs">${(row.specialties || []).map((s,i) => `<span class="pill">${i+1}. ${esc(s)}</span>`).join('')}</div></div>` : ''}
    <div class="ad-block"><h3 class="ad-block-title">Shipped credits</h3><div class="ad-prose">${esc(row.shipped_credits || row.credits || 'Not provided')}</div></div>
    ${row.notes ? `<div class="ad-block"><h3 class="ad-block-title">Notes from applicant</h3><div class="ad-prose">${esc(row.notes)}</div></div>` : ''}
    ${application ? `<div class="ad-block"><label class="ad-block-title" for="admin-notes">Your notes (private)</label><textarea class="ad-notes" id="admin-notes" maxlength="4000" placeholder="Your assessment and next steps">${esc(notes)}</textarea></div><div class="ad-actions">
      <button class="ad-btn approve" type="button" data-act="approved">Approve</button><button class="ad-btn" type="button" data-act="reviewing">Mark reviewing</button><button class="ad-btn reject" type="button" data-act="rejected">Reject</button><button class="ad-btn" type="button" data-act="notes">Save notes</button><span class="ad-save-msg" id="save-msg" role="status">${state.drafts.has(row.id) ? 'Unsaved notes' : ''}</span></div>` : ''}`;
  $('back-list').addEventListener('click', () => {
    $('list').scrollIntoView({ block:'start', behavior:'instant' });
    $('list').querySelector('.ad-item.active')?.focus({ preventScroll:true });
  });
  if (application) {
    $('admin-notes').addEventListener('input', event => {
      if (event.target.value === (row.admin_notes || '')) state.drafts.delete(row.id);
      else state.drafts.set(row.id, event.target.value);
      $('save-msg').textContent = state.drafts.has(row.id) ? 'Unsaved notes' : '';
    });
    $('detail').querySelectorAll('[data-act]').forEach(button => button.addEventListener('click', () => decide(row.id, button.dataset.act)));
  }
}

async function decide(id, action) {
  if (state.saving || !state.authed) return;
  clearTimeout(searchTimer);
  loadController?.abort();
  loadVersion++;
  $('list').removeAttribute('aria-busy');
  state.saving = true;
  const notes = $('admin-notes').value;
  const body = { id, admin_notes:notes };
  if (action !== 'notes') body.status = action;
  const controls = [...document.querySelectorAll('#app button, #search, #admin-notes')];
  const disabled = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  $('save-msg').textContent = 'Saving...';
  let saved = false;
  try {
    const data = await request('/api/admin/decide', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) });
    if (data.application?.id !== id) throw new Error('Could not confirm the update. Your notes are still here.');
    state.drafts.delete(id);
    saved = true;
  } catch (error) {
    if (state.authed) {
      $('save-msg').textContent = error.message;
      feedback(error.message, true);
    }
  } finally {
    controls.forEach((control,i) => { control.disabled = disabled[i]; });
    state.saving = false;
    pageButtons();
  }
  if (saved) await load(action === 'notes' ? 'Notes saved.' : `Application marked ${action}.`);
}

$('refresh').addEventListener('click', () => load());
$('previous').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
$('next').addEventListener('click', () => { if (state.pagination?.hasMore) { state.page++; load(); } });
$('search').addEventListener('input', event => {
  clearTimeout(searchTimer);
  const value = event.target.value.trim();
  searchTimer = setTimeout(() => { state.q = value; resetView(); load(); }, 250);
});
window.addEventListener('beforeunload', event => {
  if (state.drafts.size || state.saving) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('pageshow', event => { if (event.persisted) checkSession(); });
checkSession();
