# SFW 版部署执行清单

## 当前状态
- ✅ **代码实现完成**：SFW 模式四层防护全部到位
- ✅ **类型检查通过**：0 个错误
- ✅ **测试通过**：944 个测试全部通过
- ✅ **磁盘清理**：测试服释放 4 GB 空间（72% → 68%）
- ⏳ **代码待提交**：15 个文件 + 1 个实现文档

---

## 下一步工作（按顺序）

### 阶段 1：本地验证（0.5 天）

#### 1.1 提交代码
```bash
cd /e/agent/YearnAI/yearn-chat
git add src/lib/config/site.ts \
  src/components/Shell.tsx \
  src/components/TopbarMobileMenu.tsx \
  src/components/characters/CharacterGridCard.tsx \
  src/components/characters/CharacterDetailView.tsx \
  src/components/characters/CharacterForm.tsx \
  src/app/share/[code]/page.tsx \
  src/app/explore/page.tsx \
  src/app/explore/actions.ts \
  src/app/characters/[id]/page.tsx \
  src/app/chat/[characterId]/page.tsx \
  src/lib/characters/schema.ts \
  src/lib/characters/import-actions.ts \
  src/lib/import/external-card.ts \
  src/lib/import/mufy-migration.ts \
  SFW-MODE-IMPLEMENTATION.md

git commit -m "feat(sfw): implement SFW mode with four-layer protection

Add NEXT_PUBLIC_SFW_MODE environment flag that enables a safe-for-work
version of the platform. When set to \"1\", the build produces a variant
that removes adult content at four layers:

1. Display: hide NSFW badges and toggles
2. Query: force showNsfw=false in all explore/creator queries
3. Write: force nsfw=false in forms, imports, and migrations
4. Access: return 404 for NSFW character detail/chat pages

All write paths (form submission, one-click import, external card import,
Mufy migration) now pass through forceSfwNsfw() to ensure no nsfw=true
rows enter the database when SFW_MODE is active.

Access layer blocks known URLs (detail/chat) even for the character owner,
ensuring no \"my adult cards\" concept exists in SFW mode.

Verified: 0 type errors, 944 tests pass, four-layer coverage complete.

Technical debt paid: write-layer unification, import-path coverage, and
access-layer interception now complete.

Files: 15 changed (1 new: lib/config/site.ts)
Doc: SFW-MODE-IMPLEMENTATION.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

#### 1.2 本地构建验证
```bash
# 主站模式
NEXT_PUBLIC_SFW_MODE=0 docker compose build
# 检查 bundle 大小、构建日志无异常

# SFW 模式
NEXT_PUBLIC_SFW_MODE=1 docker compose build
# 确认两次构建产出不同镜像
docker images | grep yearn-chat
```

---

### 阶段 2：数据库准备（1 天）

#### 2.1 决定数据库方案
**方案 A（推荐）**：复用测试服现有 `supabase-db`，新建 database `dearm_sfw`
- ✅ 省内存：不新起容器，只增约 100 MB
- ✅ 简单：一条 SQL 建库，跑 53 个迁移
- ✅ 隔离：逻辑上完全独立，auth/storage 共用但数据分离
- ⚠️ 风险：测试服同时承载正式库 `dearm-prod-*`，需监控资源

**方案 B**：新买一台 4 GB 服务器
- ✅ 最省心，资源独立
- ❌ 成本增加（几百/年）

#### 2.2 执行建库（以方案 A 为例）
```bash
ssh root@115.29.213.73

# 1. 进入 postgres 容器
docker exec -it supabase-db psql -U postgres

# 2. 建库
CREATE DATABASE dearm_sfw OWNER postgres;
\c dearm_sfw

# 3. 退出，回到宿主机
exit

# 4. 跑迁移（从本地）
cd /e/agent/YearnAI/yearn-chat
DATABASE_URL="postgres://postgres:<password>@115.29.213.73:15432/dearm_sfw" \
  bun run scripts/db-migrate.ts

# 5. 验证表结构
docker exec supabase-db psql -U postgres -d dearm_sfw -c "\dt"
# 应该看到 36 张表
```

#### 2.3 导入精选角色
```bash
# 从测试库导出干净卡（nsfw=false 且内容审读通过）
docker exec supabase-db pg_dump -U postgres -d postgres \
  -t characters -t users -t beautification_packs \
  --data-only \
  --column-inserts \
  -f /tmp/sfw-seed.sql \
  --where="nsfw = false AND visibility = 'public'"

# 导入 SFW 库
docker exec -i supabase-db psql -U postgres -d dearm_sfw < /tmp/sfw-seed.sql
```

**注意**：这只是 SQL 层面；真正的内容审读需要逐张读 `persona` / `opening`。

---

### 阶段 3：部署与配置（1 天）

#### 3.1 准备环境配置
```bash
# 在测试服新建 SFW 版工作目录
ssh root@115.29.213.73
mkdir -p /root/projects/yearn-sfw
cd /root/projects/yearn-sfw

# 拷贝主站配置并修改
scp root@115.29.213.73:/root/projects/yearn-chat/.env .env.sfw
```

#### 3.2 修改 `.env.sfw`
```bash
# 关键变更
NEXT_PUBLIC_SFW_MODE=1
APP_PORT=8094  # 避开 8091（主站）、8092（reskin）、8093（其他）
DATABASE_URL=postgres://postgres:<password>@db:5432/dearm_sfw
NEXT_PUBLIC_APP_URL=https://sfw.dearm.ai  # 独立域名
SITE_URL=https://sfw.dearm.ai
```

#### 3.3 部署
```bash
cd /root/projects/yearn-sfw
git clone https://github.com/YearnAI/yearn-chat.git .
git checkout <SFW-commit-sha>

docker compose build
docker compose up -d

# 验证
curl http://127.0.0.1:8094
docker compose ps
docker compose logs app | tail -20
```

#### 3.4 配置 nginx + TLS
```bash
# /etc/nginx/conf.d/sfw-dearm.conf
server {
    listen 80;
    server_name sfw.dearm.ai;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sfw.dearm.ai;

    ssl_certificate /etc/letsencrypt/live/sfw.dearm.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sfw.dearm.ai/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8094;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 申请证书
certbot certonly --nginx -d sfw.dearm.ai

# 重载 nginx
nginx -t && nginx -s reload
```

---

### 阶段 4：验收（0.5 天）

#### 4.1 功能验收
- [ ] 注册、登录、登出
- [ ] 探索页：只显示 nsfw=false 的卡
- [ ] 顶栏：无 NSFW 开关（桌面 + 移动）
- [ ] 创建角色：表单无 NSFW 勾选框，提交后库里 nsfw=false
- [ ] 详情页：无 R18 角标，已知 NSFW 卡 URL 返回 404
- [ ] 聊天：只能进 nsfw=false 的卡，NSFW 卡返回 404
- [ ] 分享页：无 R18 角标

#### 4.2 支付链路验收（Stripe test mode）
```bash
# 1. 配置 Stripe test key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# 2. 前端发起购买
# 3. 用 Stripe 测试卡 4242 4242 4242 4242
# 4. 确认 webhook 到账、会员权益生效
# 5. Dashboard 确认订单记录
```

#### 4.3 压力点检查
- [ ] 测试服内存占用（`free -h`，不超 2.5 GB）
- [ ] 两站同时访问无相互影响
- [ ] 日志无异常（`docker compose logs -f`）

---

### 阶段 5：支付申请（时间不可控）

#### 5.1 准备材料
- [ ] 独立域名：`sfw.dearm.ai`（或另选）
- [ ] HTTPS 证书：Let's Encrypt
- [ ] 商户资料：公司名、地址、税号（香港主体）
- [ ] 业务描述：AI 角色聊天平台（**不提成人内容**）
- [ ] 网站截图：探索页、聊天页、支付流程

#### 5.2 提交 Stripe 申请
- Stripe Dashboard → Settings → Account details
- 填写商户信息、上传材料
- 提交审核

#### 5.3 等待审批
- 标准审核：3–7 个工作日
- 补充材料：可能延长至 2–4 周
- **不可控因素**：Stripe 可能质询业务模式、关联性

#### 5.4 审批通过后
```bash
# 关闭 Adaptive Pricing（见 GO-LIVE.md）
# 开启支付宝、微信（香港主体才支持）
# 配置 live webhook
# 切换 live key

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
PAYMENT_PROVIDER=stripe  # 或 payproo

docker compose up -d
```

#### 5.5 真实支付验收
- [ ] 买一档（HK$30 / 68 / 128）
- [ ] 确认到账、会员生效
- [ ] Dashboard 退款一次，确认对账正常

---

## 关键风险点

### 1. 支付审批不可控
- **风险**：Stripe 可能拒绝、要求补充材料、或关联到主站
- **缓解**：
  - 独立域名、独立部署
  - 业务描述只写「AI 角色聊天」，不提成人内容
  - 如果用同一香港主体，准备好「两条产品线」的说辞

### 2. 服务器资源不足
- **现状**：测试服 2 核 / 3 GB，已跑 17 个容器
- **风险**：再加一套 app 可能 OOM
- **缓解**：
  - 方案 A：复用现有 Postgres，只增 100 MB
  - 监控内存，必要时升级或新购

### 3. 内容审读遗漏
- **风险**：`nsfw=false` 的卡里仍有成人主题（`persona` / `opening` 是散文）
- **缓解**：
  - 精选导入，逐张人工审读
  - 或只导入 10–20 张确认干净的卡作为首版

### 4. 两站关联
- **风险**：同 IP、同主体、同资质被 Stripe 关联
- **缓解**：
  - 独立域名、独立 TLS 证书
  - 业务描述区分清楚
  - 长期考虑：不同主体申请（成本高）

---

## 时间估算（总计 3–6 天 + 审批时间）

| 阶段 | 工作内容 | 预计时间 | 依赖 |
|---|---|---|---|
| 1 | 本地验证 | 0.5 天 | 无 |
| 2 | 数据库准备 | 1 天 | 阶段 1 |
| 3 | 部署与配置 | 1 天 | 阶段 2 |
| 4 | 功能验收 | 0.5 天 | 阶段 3 |
| 5 | 支付申请 | **3–7 工作日**（标准）至 **2–4 周**（补材料） | 阶段 4 |
| 6 | 真实支付验收 | 0.5 天 | 阶段 5 通过 |

**累计工程时间**：3–6 天（不含支付审批等待）

---

## 后续优化（非阻塞）

- [ ] 法律文书：SFW 版需要独立的用户协议（去掉「永不审核」条款）
- [ ] 域名备案（如果上线大陆）
- [ ] CDN 加速（Cloudflare）
- [ ] 监控与告警（Sentry、Uptime Robot）
- [ ] 退款链路（webhook `charge.refunded`）
- [ ] 订阅到期提醒（cron）

---

## 联系人

**技术实施**：Claude（本次会话）  
**决策确认**：需老师确认的事项
- 数据库方案 A 还是 B？
- 域名用 `sfw.dearm.ai` 还是另选？
- 精选角色谁来审读？
- 支付主体是否与主站相同？

---

## 附录：快速回滚

如果 SFW 版部署后发现问题，回滚步骤：

```bash
ssh root@115.29.213.73
cd /root/projects/yearn-sfw
docker compose down
# nginx 里注释掉 sfw-dearm.conf
nginx -s reload
# 数据库保留，不删（后续可能还用）
```

不影响主站，回滚代价低。
