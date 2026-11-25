import type { Locale } from "@/i18n/types";

const categories = [
  {
    value: "古风",
    labels: ["古風", "Historical", "時代もの", "ย้อนยุค"],
    tags: ["古风", "古城趣事"],
  },
  {
    value: "校园",
    labels: ["校園", "School", "学園", "โรงเรียน"],
    tags: ["校园", "校园运动", "校园绘画", "看星星"],
  },
  {
    value: "城市生活",
    labels: ["城市生活", "City Life", "街の暮らし", "ชีวิตในเมือง"],
    tags: ["城市生活", "港城生活", "邻里生活", "小城生活"],
  },
  {
    value: "手工",
    labels: ["手工", "Crafts", "手作り", "งานฝีมือ"],
    tags: ["手工", "手工故事", "家乡手艺", "模型手工", "旧物日常"],
  },
  {
    value: "工作日常",
    labels: ["工作日常", "At Work", "仕事の日常", "ชีวิตการทำงาน"],
    tags: ["工作日常"],
  },
  {
    value: "音乐",
    labels: ["音樂", "Music", "音楽", "ดนตรี"],
    tags: ["音乐", "音乐日常"],
  },
] as const;

export function sfwExploreTagOptions(locale: Locale) {
  const index = { "zh-TW": 0, en: 1, "ja-JP": 2, "th-TH": 3 } as const;
  return categories.map(({ value, labels }) => ({
    value,
    label: labels[index[locale]],
  }));
}

export function sfwExploreTagValues(value: string): readonly string[] {
  return categories.find((category) => category.value === value)?.tags ?? [value];
}

export function sfwExploreCategory(value: string): string {
  return (
    categories.find(
      (category) =>
        category.value === value ||
        (category.tags as readonly string[]).includes(value),
    )?.value ?? ""
  );
}
