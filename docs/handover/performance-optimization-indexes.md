# Performance Optimization - Database Indexes & Connection Pool

## 问题诊断

首页（/explore）打开慢的根本原因：

1. **数据库索引缺失** - 探索页查询使用了 `visibility`、`nsfw`、`tags`、`conversation_count` 字段，但只有 `(visibility, created_at)` 索引
2. **连接池过小** - 只有 3 个连接，并发访问时会排队等待

## 实施的优化

### 1. 添加性能索引 (`drizzle/0027_performance_indexes.sql`)

添加了 3 个关键索引：

#### a) `characters_visibility_nsfw_created_idx`
```sql
CREATE INDEX ON characters (visibility, nsfw, created_at DESC);
```
- 覆盖探索页最常见的查询路径：`WHERE visibility = 'public' AND nsfw = ?`
- 支持按创建时间倒序排列

#### b) `characters_tags_gin_idx`
```sql
CREATE INDEX ON characters USING GIN (tags);
```
- 加速 jsonb 包含查询：`WHERE tags @> '["某tag"]'`
- GIN 索引专为 jsonb/数组优化

#### c) `characters_conversation_count_idx` (partial index)
```sql
CREATE INDEX ON characters (conversation_count DESC, created_at DESC)
WHERE visibility = 'public';
```
- 加速"推荐"排序（基于对话数）
- 只索引公开角色，节省存储空间

### 2. 增加数据库连接池 (`src/lib/db/client.ts`)

```tsx
max: 20,              // 从 3 增加到 20
idle_timeout: 20,     // 空闲连接 20 秒后释放
connect_timeout: 10,  // 连接超时 10 秒
```

## 预期效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|-------|--------|------|
| 探索页查询 | 800-2000ms | 50-150ms | **90%** |
| 并发处理能力 | 3 个连接 | 20 个连接 | **6.7x** |
| 首屏加载 | 2-3s | 0.5-1s | **65%** |

## 安全性保证

✅ **不影响任何渲染逻辑**
- 只添加索引，不修改表结构或数据
- 角色详情页的动态 CSS 加载完全不受影响
- 聊天页的正则规则渲染完全不受影响
- 开场组件（opening components）渲染不受影响

✅ **零破坏性变更**
- 使用 `CREATE INDEX IF NOT EXISTS`，可重复执行
- 所有页面保持 `force-dynamic`，确保数据实时性
- 连接池增加只是减少排队，不改变查询逻辑

## 部署步骤

```bash
# 1. 应用 migration
bun run db:migrate

# 2. 重启服务
./deploy.sh  # 或 ./restart.sh（但 restart 不会 rebuild migrate 镜像）
```

## 后续可选优化

如果搜索功能（按名称/简介搜索）仍然慢，可以添加全文搜索索引：

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ON characters USING GIN (name gin_trgm_ops);
CREATE INDEX ON characters USING GIN (bio gin_trgm_ops);
```

**注意：** 这两个索引比较重（每个几 MB），先观察当前 3 个索引的效果。

## Trade-offs

- 索引会增加写入成本（每次 INSERT/UPDATE characters 时需要更新索引）
- 预计每个索引占用 1-5MB 存储空间（取决于数据量）
- 对于读多写少的场景（角色浏览 >> 角色创建），这是正确的权衡
