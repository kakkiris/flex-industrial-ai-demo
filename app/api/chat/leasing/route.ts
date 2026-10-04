import { db, schema } from "@/db/client";
import { anthropic, pickModel } from "@/lib/anthropic";
import { leasingChatSystemPrompt } from "@/lib/prompts/leasing-chat-original";
import type { AvailableUnit } from "@/lib/prompts/leasing-chat";
import { isNull, eq } from "drizzle-orm";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  let body: { sessionId?: string; messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ data: null, error: "Invalid JSON" }), { status: 400 });
  }
  if (!body.messages || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ data: null, error: "messages required" }), { status: 400 });
  }

  // Load vacant unit availability for the system prompt context.
  const rows = await db
    .select({
      propertyName: schema.properties.name,
      submarket: schema.properties.submarket,
      suite: schema.units.suite,
      sizeSqft: schema.units.sizeSqft,
      rentPerSqft: schema.units.rentPerSqft,
      leaseType: schema.units.leaseType,
    })
    .from(schema.units)
    .innerJoin(schema.properties, eq(schema.properties.id, schema.units.propertyId))
    .where(isNull(schema.units.tenantName))
    .limit(30);

  const availability: AvailableUnit[] = rows
    .filter((r) => r.propertyName && r.submarket && r.suite && r.sizeSqft && r.leaseType)
    .map((r) => ({
      propertyName: r.propertyName as string,
      submarket: r.submarket as string,
      suite: r.suite as string,
      sizeSqft: r.sizeSqft as number,
      rentPerSqft: typeof r.rentPerSqft === "number" ? r.rentPerSqft : 0,
      leaseType: r.leaseType as string,
    }));

  const systemPrompt = leasingChatSystemPrompt({ availability });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const llmStream = anthropic().messages.stream({
          model: pickModel("default"),
          max_tokens: 1500,
          system: systemPrompt,
          messages: body.messages!.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of llmStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        // Propagate as a stream error so the client's ReadableStream consumer
        // sees a rejection rather than a successful close with error text mixed
        // into the message body. Also log for server-side debugging.
        const message = err instanceof Error ? err.message : "stream error";
        console.error("[chat/leasing] stream error:", message);
        controller.error(err instanceof Error ? err : new Error(message));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
