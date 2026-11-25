import type { Area } from "react-easy-crop";

export type CropArea = Area;

/**
 * 共用的图片裁切工具。CharacterForm 和 UserAvatarUpload 都走它。
 *
 * `cropImage` 在浏览器侧通过 canvas 把源图按选区裁出 Blob —— 上传走 multipart
 * 上来的就是已裁好的方/竖图，服务端不需要再处理。
 */

function createImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image load failed"));
    image.src = src;
  });
}

export function cropImage(
  sourceUrl: string,
  crop: CropArea,
  mimeType: string,
): Promise<Blob> {
  return createImageElement(sourceUrl).then(
    (image) =>
      new Promise<Blob>((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(crop.width));
        canvas.height = Math.max(1, Math.round(crop.height));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("canvas unavailable"));
          return;
        }

        context.drawImage(
          image,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("crop failed"));
              return;
            }
            resolve(blob);
          },
          mimeType || "image/jpeg",
          0.92,
        );
      }),
  );
}

export function guessExtension(file: File) {
  const type = file.type.toLowerCase();
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export function replaceExtension(filename: string, ext: string) {
  return `${filename.replace(/\.[^.]+$/, "")}.${ext}`;
}
