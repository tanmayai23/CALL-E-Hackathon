import { NextResponse } from "next/server";
import { isKillSwitchEngaged, setKillSwitch } from "@/lib/mock/store";

export const dynamic = "force-dynamic";

/** CLAUDE.md §8.2 / §12 — the global halt on outbound calling. */
export async function GET() {
  return NextResponse.json({ engaged: isKillSwitchEngaged() });
}

export async function POST(request: Request) {
  let body: { engaged?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Expected a JSON body" },
      { status: 400 },
    );
  }

  const engaged = setKillSwitch(body.engaged !== false);
  return NextResponse.json({ engaged });
}
