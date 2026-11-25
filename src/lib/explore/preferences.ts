"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function setNsfwPreference(showNsfw: boolean) {
  const store = await cookies();
  store.set("nj_show_nsfw", showNsfw ? "1" : "0", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/explore");
}
