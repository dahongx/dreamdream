import { getRecentModelStatuses } from "@/lib/ai/model-status";

export const dynamic = "force-dynamic";

/** Shared operational data only; contains no account or conversation fields. */
export async function GET() {
  const models = await getRecentModelStatuses();
  return Response.json(
    { models },
    {
      headers: {
        "Cache-Control": "public, max-age=10, stale-while-revalidate=20",
      },
    },
  );
}
