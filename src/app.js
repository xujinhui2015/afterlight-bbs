import './styles.css';
import { seedPosts, createPost, filterPosts, findMatches, parseImport, mergePosts, analyzeImport, applyImportPlan, serializePosts, CATEGORIES, DISTRICTS, MAX_IMPORT_BYTES } from './domain.js';

const STORAGE_KEY = 'afterlight-bbs-posts-v1';
const $ = (selector) => document.querySelector(selector);
const state = { posts: [], kind: 'all', query: '', status: 'all', selectedId: null };
let toastTimer;

// 用户发布的内容始终通过 textContent 写入，避免把导入数据当作 HTML。
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
    notify('本地数据无法读取，已临时展示示例。可用导入功能恢复备份。');
  }
}

function savePosts(showWarning = true) {
  try {
    localStorage.setItem(STORAGE_KEY, serializePosts(state.posts));
    return true;
  } catch {
    if (showWarning) notify('浏览器无法保存数据。当前变更仅在本次打开期间保留，请立即导出备份。');
    return false;
  }
}

function categoryLabel(category) {
  return CATEGORIES[category] || category;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function badge(post) {
  const isResolved = post.status === 'resolved';
  return element('span', `badge ${isResolved ? 'resolved' : post.kind}`, isResolved ? '✓ 已完成' : post.kind === 'request' ? '↗ 需要帮助' : '↙ 可以提供');
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
  $('#result-count').textContent = `${visible.length} 条消息`;
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
    const hint = element('span', `match-hint ${matches.length ? '' : 'no-match'}`, matches.length ? `✦ ${matches.length} 条可能匹配` : post.status === 'resolved' ? '已由本机标记完成' : '等待下一段善意的信号');
    const openButton = element('button', 'detail-button', '查看详情 ↗');
    openButton.type = 'button';
    openButton.dataset.postId = post.id;
    openButton.setAttribute('aria-label', `查看详情：${post.title}`);
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
  $('#matches-title').textContent = post.kind === 'request' ? '可能提供帮助的邻居' : '可能需要这份资源的邻居';
  const matches = post.status === 'open' ? findMatches(post, state.posts) : [];
  const nodes = matches.map((match) => {
    const node = element('button', 'match-card');
    node.type = 'button';
    node.dataset.postId = match.id;
    const title = element('strong', '', match.title);
    const reasons = Array.isArray(match.matchReasons) ? match.matchReasons.join(' · ') : '相关资源';
    node.append(title, element('span', '', `${match.district} · ${reasons} ↗`));
    return node;
  });
  if (!nodes.length) nodes.push(element('p', 'no-matches', post.status === 'resolved' ? '这条公告已完成。重新开启后将继续寻找匹配。' : '目前没有合适的本地公告。导入邻居的数据，或稍后再看看。'));
  $('#matches').replaceChildren(...nodes);
  $('#resolve-button').textContent = post.status === 'resolved' ? '重新开启这条公告' : '✓ 标记为已完成';
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}

function updateConnection() {
  $('#connection').textContent = navigator.onLine ? '设备在线 · 公告在本地' : '设备离线 · 仍可读写公告';
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
    if (state.posts.length >= 1000) throw new Error('本地节点最多保存 1000 条公告，请先导出归档。');
    const post = createPost(Object.fromEntries(new FormData(event.currentTarget)));
    state.posts = [post, ...state.posts];
    const saved = savePosts();
    $('#post-dialog').close();
    state.kind = 'all'; state.status = 'all'; state.query = '';
    $('#search').value = ''; $('#status-filter').value = 'all';
    render();
    if (saved) notify('公告已保存到本地节点。可以导出数据，与邻居分享。');
  } catch (error) {
    $('#form-error').textContent = error.message || '请检查公告内容后重试。';
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
  if (saved) notify(post.status === 'resolved' ? '这条公告已完成。谢谢你接住这段信号。' : '公告已重新开启。');
});
$('#export-button').addEventListener('click', () => {
  const data = new Blob([serializePosts(state.posts)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(data);
  const anchor = element('a');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  anchor.href = url; anchor.download = `afterlight-node-${stamp}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('节点数据已导出。将文件交给邻居，即可在对方设备导入。');
});

// ── 导入冲突预览 ──────────────────────────────────────────────────
// importSession 保存当前预览会话的数据快照与分析结果，防止用户在预览期间改变数据导致覆写。
let importSession = null;

function fieldLabel(key) {
  const labels = { kind: '类型', title: '标题', category: '分类', district: '街区', body: '正文', status: '状态' };
  return labels[key] || key;
}

function fieldValue(key, value) {
  if (key === 'kind') return value === 'request' ? '↗ 需要帮助' : '↙ 可以提供';
  if (key === 'status') return value === 'resolved' ? '✓ 已完成' : '进行中';
  if (key === 'category') return CATEGORIES[value] || value;
  return value;
}

function openImportPreview(analysis, snapshotPosts) {
  importSession = { analysis, snapshot: snapshotPosts, decisions: {} };
  const { added, unchanged, conflicts } = analysis;

  const parts = [];
  if (added.length) parts.push(`新增 ${added.length} 条`);
  if (conflicts.length) parts.push(`冲突 ${conflicts.length} 条（需选择）`);
  if (unchanged.length) parts.push(`重复 ${unchanged.length} 条（将跳过）`);
  $('#import-preview-summary').textContent = parts.length ? parts.join(' · ') : '没有需要新增或更新的公告。';

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
      const label = element('span', 'conflict-field-label', `${fieldLabel(key)}：`);
      const localVal = element('span', 'conflict-local', `本地：${fieldValue(key, conflict.local[key])}`);
      const sep = element('span', 'conflict-sep', ' → ');
      const incomingVal = element('span', 'conflict-incoming', `导入：${fieldValue(key, conflict.incoming[key])}`);
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
      radio.setAttribute('aria-label', `${conflict.local.title}：${value === 'local' ? '保留本地版本' : '采用导入版本'}`);
      label.append(radio, document.createTextNode(value === 'local' ? ' 保留本地版本' : ' 采用导入版本'));
      choiceRow.append(label);
    }
    // 监听选择变化，更新 decisions 记录
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
  // 若预览期间本地数据已变化，重新分析并提示用户再次确认。
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
    notify('导入期间本地数据已更新，已重新分析。请再次确认。');
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
    if (saved) notify(`导入完成：新增 ${newPosts} 条，替换 ${replaced} 条，跳过重复 ${skipped} 条。`);
  } catch (error) {
    $('#import-preview-error').textContent = error.message || '导入时发生错误，请重试。';
    $('#import-preview-error').hidden = false;
  }
});

$('#import-button').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('文件超过 16 MB，请选择更小的节点备份。');
    const imported = parseImport(await file.text());
    const analysis = analyzeImport(state.posts, imported);
    // 全部为重复时，无需打开预览，直接给出反馈。
    if (analysis.added.length === 0 && analysis.conflicts.length === 0) {
      notify(`导入文件中 ${analysis.unchanged.length} 条公告均已在本地，没有新内容。`);
      return;
    }
    openImportPreview(analysis, [...state.posts]);
  } catch (error) {
    notify(`导入失败：${error.message || '请检查 JSON 文件格式。'}`);
  } finally { event.target.value = ''; }
});

$('#reset-button').addEventListener('click', () => $('#reset-dialog').showModal());
$('#confirm-reset').addEventListener('click', () => {
  state.posts = seedPosts();
  const saved = savePosts();
  $('#reset-dialog').close();
  render();
  if (saved) notify('已恢复示例公告。');
});

// 多窗口修改时重新读取，避免界面继续显示过期的本地状态。
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  loadPosts(); render();
  if ($('#detail-dialog').open) $('#detail-dialog').close();
  notify('已同步此设备另一窗口的公告变更。');
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
    $('#offline-ready').textContent = '✦ 离线缓存已就绪 · 无需登录';
  }).catch(() => {
    $('#offline-ready').textContent = '✦ 本地保存 · 离线缓存暂不可用';
  });
}
