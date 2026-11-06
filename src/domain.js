export const CATEGORIES = Object.freeze({ supplies: '生活物资', power: '供电通信', transport: '出行运输', shelter: '临时空间', other: '其他互助' });
export const DISTRICTS = ['灯塔街区', '旧港街区', '北站街区', '河岸街区'];
const MAX_POSTS = 1000;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const own = (object, key) => Object.hasOwn(object, key);

function textField(value, label, min, max) {
  if (typeof value !== 'string') throw new Error(`${label}必须是文本`);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new Error(`${label}长度须为 ${min}—${max} 字`);
  return text;
}

export function validatePost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('公告格式错误');
  if (!['request', 'offer'].includes(input.kind)) throw new Error('请选择求助或资源');
  if (!own(CATEGORIES, input.category)) throw new Error('公告分类无效');
  return {
    kind: input.kind,
    title: textField(input.title, '标题', 2, 80),
    category: input.category,
    district: textField(input.district, '街区', 1, 40),
    body: textField(input.body, '正文', 5, 2000),
  };
}

export function createPost(input) {
  return { ...validatePost(input), id: crypto.randomUUID(), status: 'open', createdAt: new Date().toISOString() };
}

export function filterPosts(posts, { kind = 'all', query = '', status = 'all' } = {}) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
  return posts.filter(post => {
    const text = [post.title, post.body, post.district, CATEGORIES[post.category]].join(' ').toLocaleLowerCase();
    return (kind === 'all' || post.kind === kind) && (status === 'all' || post.status === status) && terms.every(term => text.includes(term));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function tokens(value) {
  const normalized = value.toLocaleLowerCase();
  const result = new Set(normalized.match(/[a-z0-9]{2,}/gu) || []);
  // 中文使用相邻双字片段，避免依赖在线分词服务。
  for (const segment of normalized.match(/[\p{Script=Han}]+/gu) || []) {
    for (let index = 0; index < segment.length - 1; index++) result.add(segment.slice(index, index + 2));
  }
  return result;
}

export function findMatches(post, posts) {
  if (post.status !== 'open') return [];
  const sourceTokens = tokens(post.title + ' ' + post.body);
  return posts.filter(candidate => candidate.id !== post.id && candidate.status === 'open' && candidate.kind !== post.kind && candidate.category === post.category)
    .map(candidate => {
      const sameDistrict = candidate.district === post.district;
      const overlap = [...tokens(candidate.title + ' ' + candidate.body)].filter(token => sourceTokens.has(token));
      return { ...candidate, score: 40 + (sameDistrict ? 30 : 0) + Math.min(overlap.length * 5, 30), matchReasons: ['同一资源分类', ...(sameDistrict ? ['同一街区'] : []), ...(overlap.length ? ['描述关键词相近'] : [])] };
    }).sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
}

function validateStoredPost(input) {
  const clean = validatePost(input);
  const id = textField(input.id, '公告编号', 1, 100);
  if (!/^[a-zA-Z0-9_-]+$/u.test(id)) throw new Error('公告编号包含无效字符');
  if (!['open', 'resolved'].includes(input.status)) throw new Error('公告状态无效');
  if (typeof input.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/u.test(input.createdAt) || !Number.isFinite(Date.parse(input.createdAt))) throw new Error('公告时间无效');
  return { ...clean, id, status: input.status, createdAt: new Date(input.createdAt).toISOString() };
}

export function parseImport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error('文件须为不超过 2 MB 的 JSON 文本');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON 文件无法解析'); }
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.posts)) throw new Error('请选择 Afterlight BBS 导出的 v1 数据文件');
  if (data.posts.length > MAX_POSTS) throw new Error('单个文件最多包含 1000 条公告');
  const posts = data.posts.map(validateStoredPost);
  if (new Set(posts.map(post => post.id)).size !== posts.length) throw new Error('文件包含重复公告编号，请检查后重新导入');
  return posts;
}

export function mergePosts(existing, incoming) {
  const ids = new Set(existing.map(post => post.id));
  const merged = [...existing];
  for (const post of incoming) {
    if (!ids.has(post.id)) { merged.push(post); ids.add(post.id); }
  }
  if (merged.length > MAX_POSTS) throw new Error('公告总数不能超过 1000 条，请先导出归档');
  return filterPosts(merged);
}

export function serializePosts(posts) {
  if (!Array.isArray(posts) || posts.length > MAX_POSTS) throw new Error('导出公告数量无效');
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), posts: posts.map(validateStoredPost) }, null, 2);
}

export function seedPosts() {
  const rows = [
    ['request', '求借两盏充电露营灯', 'power', '灯塔街区', '街角阅读室今晚停电，需要两盏露营灯，让晚归的邻居有地方等候。可在明早归还。', 'open'],
    ['offer', '露营灯与移动电源，今晚可借', 'power', '灯塔街区', '有两盏充电露营灯和一个移动电源，已经充满，适合阅读照明。请当面确认使用方式。', 'open'],
    ['request', '给独居邻居送一份热饭', 'supplies', '旧港街区', '楼里的独居邻居今天不方便下楼，想找同街区的朋友帮忙送一份热饭。', 'open'],
    ['offer', '厨房多做了三份晚餐', 'supplies', '旧港街区', '今晚有三份米饭和蔬菜热饭可分享，建议自带饭盒，到街区公共厨房领取。', 'open'],
    ['offer', '一辆手推车，帮你搬点东西', 'transport', '北站街区', '整理仓库找到一辆结实的手推车，邻居搬运物资可以来借，用完送回就好。', 'open'],
    ['request', '寻找周末修理收音机的伙伴', 'other', '河岸街区', '有一台旧收音机想修好，想找懂电子维修的邻居一起排查，工具和茶水我准备。', 'open'],
    ['offer', '雨夜里的临时歇脚空间', 'shelter', '河岸街区', '社区活动室开放了四个临时座位，提供热水，可在等车时短暂休息。', 'open'],
    ['request', '旧书已经找到新的主人', 'other', '灯塔街区', '上次发布的儿童绘本已全部送出，谢谢街坊们搭把手。', 'resolved'],
  ];
  return rows.map(([kind, title, category, district, body, status], index) => ({ id: `demo-${index + 1}`, kind, title, category, district, body, status, createdAt: new Date(Date.UTC(2026, 10, 6, 9, 0) - index * 1800000).toISOString() }));
}
