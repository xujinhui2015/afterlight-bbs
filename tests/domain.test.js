import test from 'node:test';
import assert from 'node:assert/strict';
import { createPost, seedPosts, filterPosts, findMatches, parseImport, mergePosts, serializePosts } from '../src/domain.js';

test('新公告校验、唯一编号与默认状态', () => {
  const input = seedPosts()[0];
  const first = createPost({ ...input, title: '  求借照明灯  ' });
  assert.equal(first.title, '求借照明灯');
  assert.equal(first.status, 'open');
  assert.notEqual(first.id, createPost(input).id);
  for (const patch of [{ kind: 'invalid' }, { category: '__proto__' }, { title: ' ' }, { body: 'a' }, { district: '' }]) assert.throws(() => createPost({ ...input, ...patch }));
});

test('组合搜索遵守类型、状态及多个关键词', () => {
  const result = filterPosts(seedPosts(), { kind: 'offer', status: 'open', query: '灯塔 露营灯' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'demo-2');
  assert.equal(filterPosts(seedPosts(), { query: '不存在的公告' }).length, 0);
});

test('资源匹配排除自己、同类型、已完成及不同分类', () => {
  const posts = seedPosts();
  const matches = findMatches(posts[0], posts);
  assert.equal(matches[0].id, 'demo-2');
  assert.ok(matches[0].matchReasons.includes('同一街区'));
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
  for (const text of ['not json', '{}', 'null', JSON.stringify({ schemaVersion: 2, posts: [] }), ' '.repeat(2 * 1024 * 1024 + 1)]) assert.throws(() => parseImport(text));
  const post = seedPosts()[0];
  for (const posts of [[post, post], [{ ...post, status: 'done' }], [{ ...post, createdAt: 'broken' }], [{ ...post, id: '../escape' }], Array(1001).fill(post)]) assert.throws(() => parseImport(JSON.stringify({ schemaVersion: 1, posts })));
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
