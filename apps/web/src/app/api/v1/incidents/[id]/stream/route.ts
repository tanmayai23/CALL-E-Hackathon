import { getRun, subscribe } from "@/lib/mock/store";
import type { SentinelEvent } from "@/lib/contracts/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * CLAUDE.md §8.2 — GET /api/v1/incidents/:id/stream
 *
 * Server-Sent Events carrying the frozen `SentinelEvent` union (§8.3). Events
 * already emitted are replayed first so a page loaded mid-call catches up
 * rather than showing a half-built timeline.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getRun(id);

  if (!run) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (event: SentinelEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const comment = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ${text}\n\n`));
        } catch {
          closed = true;
        }
      };

      comment("stream open");
      run.emitted.forEach(send);

      const unsubscribe = subscribe(run, send);

      // Keep-alive: proxies drop idle connections, and a silently dead stream
      // is worse on camera than a visible "reconnecting" (§7.4).
      const heartbeat = setInterval(() => comment("keep-alive"), 15_000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
