/**
 * 图片上传后端 —— 方案① 分支:从 Cloudflare R2 改接 Supabase Storage。
 *
 * 历史:原实现走 R2(@aws-sdk/client-s3 + R2_* 环境变量)。迁到 Supabase 后,
 * 本地/云端都用 Supabase 自带的对象存储(public bucket `media`)。函数名
 * `uploadImageToR2` 保持不变以免改调用方(目前仅 /api/uploads/image)。
 *
 * 用 service(secret)key 上传:绕过 storage RLS,服务端可信。bucket 设为 public,
 * 故 getPublicUrl 返回的地址浏览器可直接访问。
 *   本地 publicUrl 形如 http://127.0.0.1:54321/storage/v1/object/public/media/<key>
 *   云端形如 https://<project>.supabase.co/storage/v1/object/public/media/<key>
 *
 * 需要的环境变量:
 *   - NEXT_PUBLIC_SUPABASE_URL: 浏览器可访问的公开 Supabase URL
 *   - SUPABASE_URL: 可选，服务端/容器内网访问 Supabase 的 URL
 *   - SERVICE_ROLE_KEY 或 SUPABASE_SECRET_KEY: 服务端上传用密钥
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface UploadImageInput {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
  /** Deterministic import jobs may safely overwrite the same content hash. */
  upsert?: boolean;
}

export interface UploadImageResult {
  key: string;
  publicUrl: string;
}

const BUCKET = "media";

let cachedClient: SupabaseClient | null = null;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function objectPublicUrl(publicBaseUrl: string, key: string): string {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${trimTrailingSlash(publicBaseUrl)}/storage/v1/object/public/${BUCKET}/${encodedKey}`;
}

function storageClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "Missing Supabase storage env: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL / SERVICE_ROLE_KEY",
    );
  }

  cachedClient = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export async function uploadImageToR2(
  input: UploadImageInput,
): Promise<UploadImageResult> {
  const supabase = storageClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(input.key, input.body, {
      contentType: input.contentType,
      // supabase 取秒数字符串;默认一年、不可变。
      cacheControl: input.cacheControl ?? "31536000",
      upsert: input.upsert ?? false,
    });
  if (error) {
    throw error;
  }

  const publicBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!publicBaseUrl) {
    throw new Error("Missing Supabase public env: NEXT_PUBLIC_SUPABASE_URL");
  }

  return {
    key: input.key,
    publicUrl: objectPublicUrl(publicBaseUrl, input.key),
  };
}

/** Supabase storage 的 list() 单次上限;超过要靠 offset 翻页。 */
const LIST_PAGE_SIZE = 100;
/** remove() 一次删太多容易超时,分批走。 */
const REMOVE_BATCH_SIZE = 100;

/**
 * 递归列出某前缀下的全部对象 key。
 *
 * Supabase storage 是扁平 key + 伪目录:list(prefix) 只返回该层,子目录以
 * `id === null` 的条目出现,要自己往下走。上传路径最深是
 * `characters/<uid>/<scope>/<uuid>.ext`,两层就够,但这里写成通用递归 ——
 * 以后加一层 scope 不会悄悄漏删。
 */
async function listAllKeysUnder(prefix: string): Promise<string[]> {
  const supabase = storageClient();
  const keys: string[] = [];
  const pending = [prefix];

  while (pending.length > 0) {
    const dir = pending.pop() as string;
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(dir, { limit: LIST_PAGE_SIZE, offset });
      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const entry of data) {
        const full = `${dir}/${entry.name}`;
        // 伪目录没有 id / metadata;真对象两者都有。
        if (entry.id === null) pending.push(full);
        else keys.push(full);
      }

      if (data.length < LIST_PAGE_SIZE) break;
      offset += data.length;
    }
  }

  return keys;
}

/**
 * 删掉某用户上传的全部图片对象。
 *
 * 为什么必须单独做:`media` 是 **public bucket**,而对象存储不在 Postgres 的
 * 外键级联范围内 —— 删账号只会删掉数据库里那条 avatar_url 字符串,图片本身
 * 还躺在公网可直接访问的地址上,且此后**再没有任何记录能指向它去清理**。
 *
 * key 前缀见 src/app/api/uploads/image/route.ts:
 *   users/<uid>/avatar/…        用户头像
 *   characters/<uid>/<scope>/…  角色头像 / 封面 / studio 参考图
 *
 * 返回删掉的对象数,供调用方记日志。
 */
export async function deleteUserUploads(userId: string): Promise<number> {
  const supabase = storageClient();
  const keys = (
    await Promise.all([
      listAllKeysUnder(`users/${userId}`),
      listAllKeysUnder(`characters/${userId}`),
    ])
  ).flat();

  for (let i = 0; i < keys.length; i += REMOVE_BATCH_SIZE) {
    const batch = keys.slice(i, i + REMOVE_BATCH_SIZE);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw error;
  }

  return keys.length;
}
