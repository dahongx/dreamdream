import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { publicUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(publicUrl(request, next));
    }
  }

  return NextResponse.redirect(
    publicUrl(request, "/signin?error=callbackFailed"),
  );
}
