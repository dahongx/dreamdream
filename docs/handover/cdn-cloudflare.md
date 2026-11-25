# Cloudflare 橙云代理 + CDN 加速配置

> 配套背景:部署编排见 [docker-compose.cloud.yml](../../docker-compose.cloud.yml)(注释里早已假设「必须经 nginx(443) + Cloudflare 进来」)· 反代/TLS 由宿主 nginx 终止转给容器 3000 端口。
> 适用:给已上线的 `dearm.ai` 套 Cloudflare 免费档,拿到 Anycast + 边缘 TLS + 源站 IP 隐藏 + 静态资源边缘缓存。
> 状态:纯 Cloudflare 后台配置 + 源站防火墙/nginx 小改,**零代码改动、无需重新构建镜像**。

---

## 0. 为什么这么配(先理解再动手)

三类资源必须**分开对待**,不能一刀切全缓存:

| 资源 | 例子 | 源站缓存头 | CDN 策略 |
|------|------|-----------|---------|
| 内容哈希静态资源 | `/_next/static/chunk-a3f2.js` | `max-age=31536000, immutable` | 边缘缓存一年(改代码文件名就变,零失效风险) |
| 固定名静态资源 | `/public/favicon.ico`、og 图 | 弱缓存头 | 听源站的,不锁死(换 logo 才刷得掉) |
| 动态内容 | 聊天页 / RSC / `/api/*` | 带 Supabase auth cookie | **绝不缓存**(缓了会把 A 用户会话发给 B) |

关键红线:**永远别开「Cache Everything / 缓存所有内容」全站缓存** —— 聊天页和 `/api/*` 带 auth cookie,缓存会串号。默认橙云模式本来就不缓存带 cookie 的 HTML,所以按下面配即可,不要手贱改成全缓存。

---

## 1. 把域名接进 Cloudflare(若还没接)

1. 登录 Cloudflare → **Add a site** → 输入 `dearm.ai` → 选 **Free** 档。
2. CF 扫描导入现有 DNS 记录,给你**两个 CF nameserver**(形如 `xxx.ns.cloudflare.com`)。
3. 去**域名注册商后台**把 NS 改成这两个。生效需几分钟~几小时。
4. Cloudflare 面板显示 `Active` 即接管成功。

> 已在 Cloudflare 的跳过本节。

## 2. DNS 记录 + 开橙云

**DNS → Records**:

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|---------|
| A | `dearm.ai`(或 `@`) | 源站公网 IP | **Proxied(橙云 ☁️)** |
| A/CNAME | `www` | 源站 IP 或 `dearm.ai` | Proxied |

代理状态那列**必须是橙色云**(Proxied);灰色是 DNS-only(只解析,不加速不隐藏 IP)。点云图标切换。

## 3. SSL/TLS 模式(最易踩坑)

**SSL/TLS → Overview**,按源站 443 证书情况选:

- 源站有**有效证书**(Let's Encrypt 等)→ **Full (strict)** ✅ 推荐
- 源站是**自签证书** → **Full**
- 源站**只有 80** → **Flexible**(⚠️ CF→源站明文,不安全,仅临时)

**推荐**:`SSL/TLS → Origin Server → Create Certificate` 生成 **Cloudflare Origin CA 证书**(15 年),装到源站 nginx,再用 **Full (strict)** —— 源站从此不用管 Let's Encrypt 续期。

`SSL/TLS → Edge Certificates`:
- Always Use HTTPS = ON
- Automatic HTTPS Rewrites = ON
- Min TLS Version = 1.2

⚠️ **顺序**:先确认源站 443 能通,再切 Full (strict),否则全站 502。

## 4. 锁死源站,防绕过 CF 直连(重要)

橙云只隐藏 IP;拿到真实 IP 仍能直连 443 绕过 CF。源站防火墙只放行 Cloudflare IP 段:

```bash
# 只允许 Cloudflare IP 段访问 443,其它拒绝
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  sudo ufw allow from "$ip" to any port 443 proto tcp
done
sudo ufw deny 443/tcp
sudo ufw reload
```

nginx 恢复真实访客 IP(否则日志/限流看到的全是 CF 的 IP):

```nginx
# /etc/nginx/conf.d/cloudflare-realip.conf —— IP 段随官方更新
real_ip_header CF-Connecting-IP;
# set_real_ip_from <逐条填 https://www.cloudflare.com/ips-v4 的段>;
```

---

## 5. 缓存规则(核心)

**Caching → Cache Rules**。规则**从上往下匹配,第一个命中即止**,所以顺序至关重要。

### 规则 1(放最上面):bypass-api —— 挡掉动态请求

- 名称:`bypass-api`
- When(匹配条件):
  - 字段 = **URI 路径 (URI Path)**
  - 运算符 = **开头为 (starts with)**
  - 值 = `/api/`
  - 表达式写法:`(starts_with(http.request.uri.path, "/api/"))`
- Then:
  - **缓存资格 (Cache eligibility) = 绕过缓存 (Bypass cache)**
  - (选了绕过缓存后 Edge/Browser TTL 自动消失,正常)

### 规则 2:static-assets —— 缓存静态资源

- 名称:`static-assets`
- When(匹配条件,一条表达式同时覆盖两类):
  ```
  (http.request.uri.path wildcard r"/_next/static/") or (http.request.uri.path wildcard r"/public/")
  ```
- Then:
  - **缓存资格 = 符合缓存条件 (Eligible for cache)**
  - **Edge TTL = 使用缓存控制标头（如果存在），否则绕过缓存**(= Respect origin)
  - **Browser TTL = 接受源服务器 TTL**(= Respect origin)

为什么两类资源同一条规则不会出错:都选「听源站的」(Respect origin)——
- `/_next/static/*` 源站发 immutable → 边缘缓存一年;
- `/public/*` 源站发弱缓存头 → 不会被锁死,换 logo/favicon 后刷得掉;
- 万一某响应没缓存头 → 「否则绕过缓存」自动兜底不缓存。

### 最终顺序

```
1. bypass-api      ← 必须最上面
2. static-assets
```

---

## 6. 验证

```bash
# 1. 是否走了 Cloudflare(有 server: cloudflare + cf-ray)
curl -sI https://dearm.ai | grep -iE 'server|cf-ray|cf-cache-status'

# 2. 静态资源第二次应为 HIT(边缘命中)
curl -sI https://dearm.ai/_next/static/chunks/任意一个.js | grep -iE 'cf-cache-status|age'

# 3. /api 应为 BYPASS 或 DYNAMIC(未缓存)
curl -sI https://dearm.ai/api/health | grep -i cf-cache-status

# 4. 直连源站 IP 应被防火墙拒绝(超时/拒绝才对)
curl -sI --connect-timeout 5 https://<源站IP>/ ; echo "exit=$?"
```

- `cf-cache-status: HIT` = 边缘命中;`DYNAMIC`/`BYPASS` = 未缓存(动态路径正确)
- `age: N` = 已在边缘存了 N 秒

---

## 7. 上线三条不能错

1. **别开「缓存所有内容 / Cache Everything」** —— 聊天页/`/api/*` 带 auth cookie,缓存会串号。
2. **Stripe webhook 要能进来** —— `/api/stripe/webhook` 走 CF 没问题(POST 不缓存,且被规则 1 bypass),但确认 CF 的 WAF / Bot Fight Mode 别拦了 Stripe 回调。上线前用 Stripe Dashboard 的 webhook 测试打一发确认 200。见 [stripe-payments.md](./stripe-payments.md)。
3. **切 SSL 模式前先确认源站 443 能通** —— 顺序错了(先切 Full strict 但源站没证书)会全站 502。

---

## 8. 后续可选(本次不做)

- **`/public` 想更激进缓存**:改代码给固定名资源带版本查询串(`/og.png?v=2`),再把 Edge TTL 覆写成长值;或更新后走 `Caching → Purge Cache` 手动刷。
- **静态资源剥离到独立域名**:`next.config.ts` 配 `assetPrefix: "https://cdn.dearm.ai"`(build 时内联,需在 Dockerfile build 阶段注入,同 `NEXT_PUBLIC_*`)。层 5 已覆盖 90% 收益,非必要。
- **用户图片加速**:图片现直连 `<project>.supabase.co/storage/...`(`src/lib/r2/client.ts`,已设 `cacheControl: 31536000`)。Supabase Pro 自带 Smart CDN;想自控可给 Storage 挂 custom domain(如 `img.dearm.ai`)再套橙云,需把 `objectPublicUrl` 的 base 换成独立图片域名变量。
