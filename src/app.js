import './styles.css';
import { seedPosts, createPost, filterPosts, findMatches, parseImport, mergePosts, analyzeImport, applyImportPlan, serializePosts, CATEGORIES, DISTRICTS, MAX_IMPORT_BYTES } from './domain.js';

const STORAGE_KEY = 'afterlight-bbs-posts-v1';
const $ = (selector) => document.querySelector(selector);
const state = { posts: [], kind: 'all', query: '', status: 'all', selectedId: null };
let toastTimer;

// User-supplied content is always written via textContent — never injected as HTML.
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5500);
}

function loadPosts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state.posts = saved === null ? seedPosts() : parseImport(saved);
    if (saved === null) savePosts();
  } catch {
    state.posts = seedPosts();
    notify('Local data could not be read. Showing example posts. Use Import to restore a backup.');
  }
}

function savePosts(showWarning = true) {
  try {
    localStorage.setItem(STORAGE_KEY, serializePosts(state.posts));
    return true;
  } catch {
    if (showWarning) notify('Browser could not save data. Changes are only kept for this session — export a backup now.');
    return false;
  }
}

function categoryLabel(category) {
  return CATEGORIES[category] || category;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function badge(post) {
  const isResolved = post.status === 'resolved';
  return element('span', `badge ${isResolved ? 'resolved' : post.kind}`, isResolved ? '✓ Resolved' : post.kind === 'request' ? '↗ Request' : '↙ Offer');
}

function render() {
  const all = state.posts;
  $('#count-all').textContent = all.length;
  $('#count-request').textContent = all.filter((post) => post.kind === 'request').length;
  $('#count-offer').textContent = all.filter((post) => post.kind === 'offer').length;
  $('#stat-request').textContent = all.filter((post) => post.kind === 'request' && post.status === 'open').length;
  $('#stat-offer').textContent = all.filter((post) => post.kind === 'offer' && post.status === 'open').length;
  $('#stat-resolved').textContent = all.filter((post) => post.status === 'resolved').length;
  document.querySelectorAll('[data-kind]').forEach((button) => {
    const active = button.dataset.kind === state.kind;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const visible = filterPosts(all, state);
  $('#result-count').textContent = `${visible.length} post${visible.length !== 1 ? 's' : ''}`;
  $('#empty-state').hidden = visible.length !== 0;
  const fragment = document.createDocumentFragment();
  for (const post of visible) {
    const card = element('article', `post-card ${post.status === 'resolved' ? 'resolved' : ''}`);
    const top = element('div', 'card-top');
    top.append(badge(post), element('span', 'category-label', categoryLabel(post.category)));
    const title = element('h3', 'card-title', post.title);
    const body = element('p', 'card-description', post.body);
    const meta = element('div', 'card-meta');
    const location = element('span', '', `⌖ ${post.district}`);
    const time = element('time', '', formatDate(post.createdAt));
    time.dateTime = post.createdAt;
    meta.append(location, time);
    const footer = element('div', 'card-footer');
    const matches = post.status === 'open' ? findMatches(post, all) : [];
    const hint = element('span', `match-hint ${matches.length ? '' : 'no-match'}`, matches.length ? `✦ ${matches.length} possible match${matches.length !== 1 ? 'es' : ''}` : post.status === 'resolved' ? 'Marked resolved on this device' : 'Waiting for the next signal of kindness');
    const openButton = element('button', 'detail-button', 'View details ↗');
    openButton.type = 'button';
    openButton.dataset.postId = post.id;
    openButton.setAttribute('aria-label', `View details: ${post.title}`);
    footer.append(hint, openButton);
    card.append(top, title, body, meta, footer);
    fragment.append(card);
  }
  $('#posts').replaceChildren(fragment);
}

function openDetail(id) {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;
  state.selectedId = id;
  const kindBadge = badge(post);
  kindBadge.id = 'detail-kind';
  $('#detail-kind').replaceWith(kindBadge);
  $('#detail-title').textContent = post.title;
  $('#detail-meta').textContent = `${categoryLabel(post.category)} · ${post.district} · ${formatDate(post.createdAt)}`;
  $('#detail-body').textContent = post.body;
  $('#matches-title').textContent = post.kind === 'request' ? 'Neighbors who might be able to help' : 'Neighbors who might need this';
  const matches = post.status === 'open' ? findMatches(post, state.posts) : [];
  const nodes = matches.map((match) => {
    const node = element('button', 'match-card');
    node.type = 'button';
    node.dataset.postId = match.id;
    const title = element('strong', '', match.title);
    const reasons = Array.isArray(match.matchReasons) ? match.matchReasons.join(' · ') : 'Related resource';
    node.append(title, element('span', '', `${match.district} · ${reasons} ↗`));
    return node;
  });
  if (!nodes.length) nodes.push(element('p', 'no-matches', post.status === 'resolved' ? 'This post is resolved. Reopen it to resume matching.' : 'No matching local posts yet. Import a neighbor\'s data or check back later.'));
  $('#matches').replaceChildren(...nodes);
  $('#resolve-button').textContent = post.status === 'resolved' ? 'Reopen this post' : '✓ Mark as resolved';
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}

function updateConnection() {
  $('#connection').textContent = navigator.onLine ? 'Device online · Posts saved locally' : 'Device offline · Posts still readable';
}

$('#kind-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-kind]');
  if (!button) return;
  state.kind = button.dataset.kind;
  render();
});
$('#search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
$('#status-filter').addEventListener('change', (event) => { state.status = event.target.value; render(); });
$('#clear-filters').addEventListener('click', () => {
  state.kind = 'all'; state.query = ''; state.status = 'all';
  $('#search').value = ''; $('#status-filter').value = 'all'; render();
});
$('#new-button').addEventListener('click', () => {
  $('#post-form').reset();
  $('#form-error').hidden = true;
  if (state.kind === 'offer') $('#post-form').elements.kind.value = 'offer';
  $('#post-dialog').showModal();
});
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => {
  document.getElementById(button.dataset.close).close();
}));
$('#post-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    if (state.posts.length >= 1000) throw new Error('This node can hold at most 1,000 posts — please export an archive first.');
    const post = createPost(Object.fromEntries(new FormData(event.currentTarget)));
    state.posts = [post, ...state.posts];
    const saved = savePosts();
    $('#post-dialog').close();
    state.kind = 'all'; state.status = 'all'; state.query = '';
    $('#search').value = ''; $('#status-filter').value = 'all';
    render();
    if (saved) notify('Post saved to local node. Export your data to share it with a neighbor.');
  } catch (error) {
    $('#form-error').textContent = error.message || 'Please review the post and try again.';
    $('#form-error').hidden = false;
  }
});
for (const container of [$('#posts'), $('#matches')]) {
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-post-id]');
    if (button) openDetail(button.dataset.postId);
  });
}
$('#resolve-button').addEventListener('click', () => {
  const post = state.posts.find((item) => item.id === state.selectedId);
  if (!post) return;
  post.status = post.status === 'resolved' ? 'open' : 'resolved';
  const saved = savePosts();
  render(); openDetail(post.id);
  if (saved) notify(post.status === 'resolved' ? 'Post marked as resolved. Thanks for catching that signal.' : 'Post reopened.');
});
$('#export-button').addEventListener('click', () => {
  const data = new Blob([serializePosts(state.posts)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(data);
  const anchor = element('a');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  anchor.href = url; anchor.download = `afterlight-node-${stamp}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Node data exported. Hand the file to a neighbor so they can import it on their device.');
});

// ── Import conflict preview ───────────────────────────────────────
// importSession holds a snapshot and analysis result for the current preview,
// preventing stale data from being written if local posts change during review.
let importSession = null;

function fieldLabel(key) {
  const labels = { kind: 'Type', title: 'Title', category: 'Category', district: 'Neighborhood', body: 'Details', status: 'Status' };
  return labels[key] || key;
}

function fieldValue(key, value) {
  if (key === 'kind') return value === 'request' ? '↗ Request' : '↙ Offer';
  if (key === 'status') return value === 'resolved' ? '✓ Resolved' : 'Open';
  if (key === 'category') return CATEGORIES[value] || value;
  return value;
}

function openImportPreview(analysis, snapshotPosts) {
  importSession = { analysis, snapshot: snapshotPosts, decisions: {} };
  const { added, unchanged, conflicts } = analysis;

  const parts = [];
  if (added.length) parts.push(`${added.length} new`);
  if (conflicts.length) parts.push(`${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} (need decision)`);
  if (unchanged.length) parts.push(`${unchanged.length} duplicate${unchanged.length !== 1 ? 's' : ''} (will skip)`);
  $('#import-preview-summary').textContent = parts.length ? parts.join(' · ') : 'Nothing new to add or update.';

  const conflictsSection = $('#import-conflicts-section');
  conflictsSection.hidden = conflicts.length === 0;
  const list = $('#import-conflicts-list');
  list.replaceChildren();

  for (const conflict of conflicts) {
    const item = element('div', 'conflict-item');
    item.setAttribute('role', 'listitem');
    item.append(element('strong', 'conflict-title', conflict.local.title));
    const fieldsEl = element('ul', 'conflict-fields');
    for (const key of conflict.changedFields) {
      const li = element('li', '');
      const label = element('span', 'conflict-field-label', `${fieldLabel(key)}: `);
      const localVal = element('span', 'conflict-local', `Local: ${fieldValue(key, conflict.local[key])}`);
      const sep = element('span', 'conflict-sep', ' → ');
      const incomingVal = element('span', 'conflict-incoming', `Import: ${fieldValue(key, conflict.incoming[key])}`);
      li.append(label, localVal, sep, incomingVal);
      fieldsEl.append(li);
    }
    const choiceRow = element('div', 'conflict-choice');
    for (const value of ['local', 'incoming']) {
      const label = element('label', 'conflict-option');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `conflict-${conflict.id}`;
      radio.value = value;
      radio.checked = value === 'local';
      radio.setAttribute('aria-label', `${conflict.local.title}: ${value === 'local' ? 'Keep local version' : 'Use imported version'}`);
      label.append(radio, document.createTextNode(value === 'local' ? ' Keep local' : ' Use imported'));
      choiceRow.append(label);
    }
    // Track per-conflict decisions as the user makes choices
    choiceRow.addEventListener('change', (event) => {
      if (event.target.name === `conflict-${conflict.id}` && importSession) {
        importSession.decisions[conflict.id] = event.target.value;
      }
    });
    item.append(fieldsEl, choiceRow);
    list.append(item);
  }

  $('#import-preview-error').hidden = true;
  if (!$('#import-preview-dialog').open) $('#import-preview-dialog').showModal();
}

function closeImportPreview() {
  importSession = null;
  if ($('#import-preview-dialog').open) $('#import-preview-dialog').close();
  $('#import-button').focus();
}

$('#import-preview-close').addEventListener('click', closeImportPreview);
$('#import-preview-cancel').addEventListener('click', closeImportPreview);
$('#import-preview-dialog').addEventListener('cancel', closeImportPreview);

$('#import-preview-confirm').addEventListener('click', () => {
  if (!importSession) return;
  // If local posts changed while the preview was open, re-analyse and ask the user to confirm again.
  const currentSerialized = serializePosts(state.posts);
  const snapshotSerialized = serializePosts(importSession.snapshot);
  if (currentSerialized !== snapshotSerialized) {
    const allIncoming = [
      ...importSession.analysis.added,
      ...importSession.analysis.unchanged,
      ...importSession.analysis.conflicts.map(c => c.incoming),
    ];
    const freshAnalysis = analyzeImport(state.posts, allIncoming);
    importSession = null;
    if ($('#import-preview-dialog').open) $('#import-preview-dialog').close();
    notify('Local data changed during preview — re-analysed. Please review and confirm again.');
    openImportPreview(freshAnalysis, [...state.posts]);
    return;
  }
  try {
    const prevCount = importSession.snapshot.length;
    state.posts = applyImportPlan(importSession.snapshot, importSession.analysis, importSession.decisions);
    const newPosts = state.posts.length - prevCount;
    const replaced = importSession.analysis.conflicts.filter(c => importSession.decisions[c.id] === 'incoming').length;
    const skipped = importSession.analysis.unchanged.length;
    const saved = savePosts();
    closeImportPreview();
    render();
    if (saved) notify(`Import complete: ${newPosts} added, ${replaced} replaced, ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped.`);
  } catch (error) {
    $('#import-preview-error').textContent = error.message || 'An error occurred during import. Please try again.';
    $('#import-preview-error').hidden = false;
  }
});

$('#import-button').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('File exceeds 16 MB — please choose a smaller node backup.');
    const imported = parseImport(await file.text());
    const analysis = analyzeImport(state.posts, imported);
    // If everything is a duplicate, skip the preview and give immediate feedback.
    if (analysis.added.length === 0 && analysis.conflicts.length === 0) {
      notify(`All ${analysis.unchanged.length} post${analysis.unchanged.length !== 1 ? 's' : ''} in the file already exist locally — nothing new to import.`);
      return;
    }
    openImportPreview(analysis, [...state.posts]);
  } catch (error) {
    notify(`Import failed: ${error.message || 'Please check the JSON file format.'}`);
  } finally { event.target.value = ''; }
});

$('#reset-button').addEventListener('click', () => $('#reset-dialog').showModal());
$('#confirm-reset').addEventListener('click', () => {
  state.posts = seedPosts();
  const saved = savePosts();
  $('#reset-dialog').close();
  render();
  if (saved) notify('Example posts restored.');
});

// When another window modifies storage, reload to avoid showing stale data.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  loadPosts(); render();
  if ($('#detail-dialog').open) $('#detail-dialog').close();
  notify('Posts synced from another window on this device.');
});
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);

for (const [value, label] of Object.entries(CATEGORIES)) {
  const option = element('option', '', label); option.value = value; $('#category-input').append(option);
}
for (const district of DISTRICTS) {
  const option = element('option'); option.value = district; $('#district-options').append(option);
}
loadPosts();
render();
updateConnection();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(() => navigator.serviceWorker.ready).then(() => {
    $('#offline-ready').textContent = '✦ Offline cache ready · No login needed';
  }).catch(() => {
    $('#offline-ready').textContent = '✦ Saved locally · Offline cache unavailable';
  });
}
