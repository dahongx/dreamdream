import { type NextRequest, NextResponse } from "next/server";
import { publicUrl } from "@/lib/auth/urls";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(publicUrl(request, "/signin"), { status: 303 });
}
