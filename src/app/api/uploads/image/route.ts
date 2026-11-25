import type { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { uploadImageToR2 } from "@/lib/r2/client";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function safeUploadScope(value: FormDataEntryValue | null) {
  if (
    value === "avatar" ||
    value === "cover" ||
    value === "user_avatar" ||
    value === "studio_ref"
  ) {
    return value;
  }
  return "image";
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return jsonError("unauthorized", 401);
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("file required", 400);
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return jsonError("unsupported image type", 415);
  }

  if (file.size <= 0) {
    return jsonError("empty file", 400);
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return jsonError("image too large", 413);
  }

  const ext = ALLOWED_IMAGE_TYPES.get(file.type);
  const scope = safeUploadScope(formData.get("scope"));
  // user_avatar 走 users/ 前缀，把用户头像跟角色资产在 R2 路径上分开，
  // 后续按用户清理 / 迁移更直观。其它 scope 仍归 characters/$uid/$scope/。
  const key =
    scope === "user_avatar"
      ? `users/${userId}/avatar/${crypto.randomUUID()}.${ext}`
      : `characters/${userId}/${scope}/${crypto.randomUUID()}.${ext}`;
  const body = new Uint8Array(await file.arrayBuffer());

  try {
    const uploaded = await uploadImageToR2({
      key,
      body,
      contentType: file.type,
    });
    return Response.json(uploaded);
  } catch (error) {
    console.error("[dearm] R2 image upload failed", error);
    return jsonError("upload failed", 500);
  }
}
