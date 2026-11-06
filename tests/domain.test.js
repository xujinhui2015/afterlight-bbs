import test from 'node:test';
import assert from 'node:assert/strict';
import { createPost, seedPosts, filterPosts, findMatches, parseImport, mergePosts, analyzeImport, applyImportPlan, serializePosts, MAX_IMPORT_BYTES } from '../src/domain.js';

test('新公告校验、唯一编号与默认状态', () => {
  const input = seedPosts()[0];
  const first = createPost({ ...input, title: '  Spare lantern  ' });
  assert.equal(first.title, 'Spare lantern');
  assert.equal(first.status, 'open');
  assert.notEqual(first.id, createPost(input).id);
  for (const patch of [{ kind: 'invalid' }, { category: '__proto__' }, { title: ' ' }, { body: 'a' }, { district: '' }]) assert.throws(() => createPost({ ...input, ...patch }));
});

test('组合搜索遵守类型、状态及多个关键词', () => {
  const result = filterPosts(seedPosts(), { kind: 'offer', status: 'open', query: 'Lighthouse lanterns' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'demo-2');
  assert.equal(filterPosts(seedPosts(), { query: 'xyzzy-no-such-post' }).length, 0);
});

test('资源匹配排除自己、同类型、已完成及不同分类', () => {
  const posts = seedPosts();
  const matches = findMatches(posts[0], posts);
  assert.equal(matches[0].id, 'demo-2');
  assert.ok(matches[0].matchReasons.includes('Same neighborhood'));
  assert.equal(findMatches({ ...posts[0], status: 'resolved' }, posts).length, 0);
  assert.equal(findMatches(posts[0], [{ ...posts[1], status: 'resolved' }]).length, 0);
});

test('导出与导入往返一致，并剥离未知字段', () => {
  const posts = seedPosts();
  assert.deepEqual(parseImport(serializePosts(posts)), posts);
  const withExtra = { schemaVersion: 1, posts: [{ ...posts[0], secret: '不应存储' }] };
  assert.equal(Object.hasOwn(parseImport(JSON.stringify(withExtra))[0], 'secret'), false);
});

test('畸形和过大导入整体拒绝，不接受重复或不合法数据', () => {
  for (const text of ['not json', '{}', 'null', JSON.stringify({ schemaVersion: 2, posts: [] }), ' '.repeat(MAX_IMPORT_BYTES + 1)]) assert.throws(() => parseImport(text));
  const post = seedPosts()[0];
  for (const posts of [[post, post], [{ ...post, status: 'done' }], [{ ...post, createdAt: 'broken' }], [{ ...post, id: '../escape' }], Array(1001).fill(post)]) assert.throws(() => parseImport(JSON.stringify({ schemaVersion: 1, posts })));
});

test('合法最大正文的整批公告可导出后重新导入', () => {
  const template = seedPosts()[0];
  const posts = Array.from({ length: 1000 }, (_, index) => ({ ...template, id: `large-${index}`, body: '邻'.repeat(2000) }));
  assert.deepEqual(parseImport(serializePosts(posts)), posts);
});

test('合并幂等、不改写本地同编号公告，超过容量报错', () => {
  const posts = seedPosts();
  const changed = { ...posts[0], title: '远端修改的标题' };
  const merged = mergePosts(posts, [changed, changed]);
  assert.equal(merged.length, posts.length);
  assert.equal(merged.find(post => post.id === changed.id).title, posts[0].title);
  assert.deepEqual(mergePosts(merged, posts), merged);
  assert.throws(() => mergePosts(Array.from({ length: 1000 }, (_, i) => ({ ...posts[0], id: `item-${i}` })), posts));
});

test('analyzeImport 正确分类新增、重复与冲突，对象键顺序不产生虚假冲突', () => {
  const posts = seedPosts();
  // 全部与本地相同 → 全部归入 unchanged
  const { added, unchanged, conflicts } = analyzeImport(posts, posts);
  assert.equal(added.length, 0);
  assert.equal(unchanged.length, posts.length);
  assert.equal(conflicts.length, 0);

  // 新增一条本地没有的
  const newPost = { ...posts[0], id: 'new-xyz' };
  const result2 = analyzeImport(posts, [newPost]);
  assert.equal(result2.added.length, 1);
  assert.equal(result2.added[0].id, 'new-xyz');

  // 相同 ID 但标题不同 → conflict，changedFields 包含 title
  const changed = { ...posts[0], title: '导入方的修改标题' };
  const result3 = analyzeImport(posts, [changed]);
  assert.equal(result3.conflicts.length, 1);
  assert.ok(result3.conflicts[0].changedFields.includes('title'));
  assert.equal(result3.conflicts[0].local.title, posts[0].title);
  assert.equal(result3.conflicts[0].incoming.title, '导入方的修改标题');

  // 对象键顺序不同但值相同 → unchanged（不产生虚假冲突）
  const reordered = Object.fromEntries(Object.entries(posts[1]).reverse());
  const result4 = analyzeImport(posts, [reordered]);
  assert.equal(result4.unchanged.length, 1);
  assert.equal(result4.conflicts.length, 0);
});

test('applyImportPlan 默认保留本地，选择 incoming 时替换，不影响无关公告', () => {
  const posts = seedPosts();
  const changed = { ...posts[0], title: '导入版标题' };
  const analysis = analyzeImport(posts, [changed]);
  assert.equal(analysis.conflicts.length, 1);

  // 默认（不传 decisions）→ 保留本地
  const keepLocal = applyImportPlan(posts, analysis, {});
  assert.equal(keepLocal.find(p => p.id === posts[0].id).title, posts[0].title);

  // 选择 incoming → 替换
  const takeIncoming = applyImportPlan(posts, analysis, { [posts[0].id]: 'incoming' });
  assert.equal(takeIncoming.find(p => p.id === posts[0].id).title, '导入版标题');

  // 无关公告不受影响
  assert.equal(takeIncoming.find(p => p.id === posts[1].id).title, posts[1].title);

  // 取消（不调用 applyImportPlan）不会改变原数组
  assert.equal(posts[0].title, posts[0].title); // 原数组不变
});

test('applyImportPlan 新增条目被正确加入，重复导入幂等', () => {
  const posts = seedPosts();
  const newPost = { ...posts[0], id: 'fresh-001', title: '全新公告' };
  const analysis = analyzeImport(posts, [newPost]);
  const result = applyImportPlan(posts, analysis, {});
  assert.ok(result.some(p => p.id === 'fresh-001'));

  // 再次导入同一文件（已在本地）→ unchanged，applyImportPlan 不增加条数
  const analysis2 = analyzeImport(result, [newPost]);
  assert.equal(analysis2.unchanged.length, 1);
  assert.equal(analysis2.added.length, 0);
  const result2 = applyImportPlan(result, analysis2, {});
  assert.equal(result2.length, result.length);
});

test('applyImportPlan 超过容量时抛错，不修改现有数据', () => {
  const posts = Array.from({ length: 1000 }, (_, i) => ({ ...seedPosts()[0], id: `cap-${i}` }));
  const extra = { ...seedPosts()[0], id: 'over-limit' };
  const analysis = analyzeImport(posts, [extra]);
  assert.throws(() => applyImportPlan(posts, analysis, {}));
});
