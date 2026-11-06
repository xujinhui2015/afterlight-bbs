import './styles.css';
import { seedPosts, createPost, filterPosts, findMatches, parseImport, mergePosts, serializePosts, CATEGORIES, DISTRICTS } from './domain.js';

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
    const hint = element('span', `match-hint ${matches.length ? '' : 'no-match'}`, matches.length ? `✦ ${matches.length} 条可能匹配` : post.status === 'resolved' ? '这条消息已有回应' : '等待下一段善意的信号');
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
$('#import-button').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('文件超过 2 MB，请选择更小的节点备份。');
    const imported = parseImport(await file.text());
    const previous = state.posts.length;
    state.posts = mergePosts(state.posts, imported);
    const saved = savePosts();
    render();
    if (saved) notify(`导入完成，新增 ${state.posts.length - previous} 条公告。同 ID 的本地公告已保留。`);
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
