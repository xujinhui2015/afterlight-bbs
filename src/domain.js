export const CATEGORIES = Object.freeze({ supplies: 'Supplies', power: 'Power & Comms', transport: 'Transport', shelter: 'Shelter', other: 'Mutual Aid' });
export const DISTRICTS = ['Lighthouse District', 'Old Harbor', 'North Station', 'Riverside'];
const MAX_POSTS = 1000;
// A valid export of 1000 posts with 2000-char bodies must be re-importable.
export const MAX_IMPORT_BYTES = 16 * 1024 * 1024;
const own = (object, key) => Object.hasOwn(object, key);

function textField(value, label, min, max) {
  if (typeof value !== 'string') throw new Error(`${label} must be text`);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new Error(`${label} must be ${min}–${max} characters`);
  return text;
}

export function validatePost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid post format');
  if (!['request', 'offer'].includes(input.kind)) throw new Error('Please select request or offer');
  if (!own(CATEGORIES, input.category)) throw new Error('Invalid category');
  return {
    kind: input.kind,
    title: textField(input.title, 'Title', 2, 80),
    category: input.category,
    district: textField(input.district, 'Neighborhood', 1, 40),
    body: textField(input.body, 'Details', 5, 2000),
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
  // CJK: use adjacent bigrams to avoid depending on an online tokenizer.
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
      return { ...candidate, score: 40 + (sameDistrict ? 30 : 0) + Math.min(overlap.length * 5, 30), matchReasons: ['Same category', ...(sameDistrict ? ['Same neighborhood'] : []), ...(overlap.length ? ['Similar keywords'] : [])] };
    }).sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
}

function validateStoredPost(input) {
  const clean = validatePost(input);
  const id = textField(input.id, 'Post ID', 1, 100);
  if (!/^[a-zA-Z0-9_-]+$/u.test(id)) throw new Error('Post ID contains invalid characters');
  if (!['open', 'resolved'].includes(input.status)) throw new Error('Invalid post status');
  if (typeof input.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/u.test(input.createdAt) || !Number.isFinite(Date.parse(input.createdAt))) throw new Error('Invalid post timestamp');
  return { ...clean, id, status: input.status, createdAt: new Date(input.createdAt).toISOString() };
}

export function parseImport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error('File must be a JSON text no larger than 16 MB');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON file could not be parsed'); }
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.posts)) throw new Error('Please select an Afterlight BBS v1 export file');
  if (data.posts.length > MAX_POSTS) throw new Error('A single file may contain at most 1,000 posts');
  const posts = data.posts.map(validateStoredPost);
  if (new Set(posts.map(post => post.id)).size !== posts.length) throw new Error('File contains duplicate post IDs — please check and re-import');
  return posts;
}

export function mergePosts(existing, incoming) {
  const ids = new Set(existing.map(post => post.id));
  const merged = [...existing];
  for (const post of incoming) {
    if (!ids.has(post.id)) { merged.push(post); ids.add(post.id); }
  }
  if (merged.length > MAX_POSTS) throw new Error('Total posts cannot exceed 1,000 — please export an archive first');
  return filterPosts(merged);
}

// Use an explicit field list when comparing posts so object key order never causes false conflicts.
const COMPARE_FIELDS = ['kind', 'title', 'category', 'district', 'body', 'status'];

function postsEqual(a, b) {
  return COMPARE_FIELDS.every(key => a[key] === b[key]);
}

/**
 * Analyse import data and return categorised results without modifying any data.
 * @param {object[]} existing Current local posts array
 * @param {object[]} incoming Validated posts from parseImport
 * @returns {{ added: object[], unchanged: object[], conflicts: Array<{id: string, local: object, incoming: object, changedFields: string[]}> }}
 */
export function analyzeImport(existing, incoming) {
  const localMap = new Map(existing.map(post => [post.id, post]));
  const added = [];
  const unchanged = [];
  const conflicts = [];
  for (const post of incoming) {
    const local = localMap.get(post.id);
    if (!local) {
      added.push(post);
    } else if (postsEqual(local, post)) {
      unchanged.push(post);
    } else {
      const changedFields = COMPARE_FIELDS.filter(key => local[key] !== post[key]);
      conflicts.push({ id: post.id, local, incoming: post, changedFields });
    }
  }
  return { added, unchanged, conflicts };
}

/**
 * Apply import decisions and return a new posts array without mutating inputs.
 * @param {object[]} existing Snapshot of local posts at decision time
 * @param {{ added: object[], conflicts: Array<{id: string, local: object, incoming: object}> }} analysis Result of analyzeImport
 * @param {Record<string, 'local' | 'incoming'>} decisions Per-conflict ID choice; defaults to keeping local
 * @returns {object[]}
 */
export function applyImportPlan(existing, analysis, decisions) {
  const result = existing.map(post => {
    const conflict = analysis.conflicts.find(c => c.id === post.id);
    if (!conflict) return post;
    return decisions[post.id] === 'incoming' ? conflict.incoming : post;
  });
  for (const post of analysis.added) result.push(post);
  if (result.length > MAX_POSTS) throw new Error('Total posts cannot exceed 1,000 — please export an archive first');
  return filterPosts(result);
}

export function serializePosts(posts) {
  if (!Array.isArray(posts) || posts.length > MAX_POSTS) throw new Error('Invalid number of posts to export');
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), posts: posts.map(validateStoredPost) }, null, 2);
}

export function seedPosts() {
  const rows = [
    ['request', 'Need two rechargeable camping lanterns', 'power', 'Lighthouse District', 'The reading room on the corner has no power tonight. Two camping lanterns would help neighbors who arrive late. Happy to return them in the morning.', 'open'],
    ['offer', 'Camping lanterns and power bank — available tonight', 'power', 'Lighthouse District', 'I have two fully charged camping lanterns and a power bank, good for reading light. Come by to confirm how they work before taking them.', 'open'],
    ['request', 'Delivering a warm meal to an elderly neighbor', 'supplies', 'Old Harbor', 'An elderly neighbor in my building cannot get downstairs today. Looking for someone in the same district to help deliver a hot meal.', 'open'],
    ['offer', 'Three extra portions of dinner tonight', 'supplies', 'Old Harbor', 'I cooked three extra portions of rice and vegetables. Bring your own container and pick them up at the community kitchen.', 'open'],
    ['offer', 'Hand trolley available to borrow', 'transport', 'North Station', 'Found a sturdy hand trolley while clearing storage. Neighbors can borrow it to move supplies — just return it when done.', 'open'],
    ['request', 'Looking for someone to fix a vintage radio this weekend', 'other', 'Riverside', 'I have an old radio I would love to repair. Looking for a neighbor who knows electronics to troubleshoot it together — I will bring the tools and tea.', 'open'],
    ['offer', 'Temporary shelter on a rainy night', 'shelter', 'Riverside', 'The community room has four seats open tonight with hot water. A good spot to wait if you missed the last bus.', 'open'],
    ['request', 'Children\'s books have found their new home', 'other', 'Lighthouse District', 'All the picture books from the last post have been given away. Thanks to everyone who helped pass them on.', 'resolved'],
  ];
  return rows.map(([kind, title, category, district, body, status], index) => ({ id: `demo-${index + 1}`, kind, title, category, district, body, status, createdAt: new Date(Date.UTC(2026, 10, 6, 9, 0) - index * 1800000).toISOString() }));
}
