import { db, schema } from "@/db/client";
import { id } from "./ids";
import { env } from "./env";

export type NotifyKind =
  | "qualified_lead"        // L1: new lead qualified by the form engine
  | "extraction_complete"   // L2: lease extraction finished
  | "bulk_load_complete";   // A5: acquisition bulk-load finished

export type NotifyInput = {
  kind: NotifyKind;
  title: string;
  body: string;
  link?: string;
};

export async function notify(input: NotifyInput): Promise<void> {
  await db.insert(schema.notifications).values({
    id: id("ntf"),
    kind: input.kind,
    title: input.title,
    body: input.body,
    link: input.link,
    createdAt: new Date(),
  });

  const slack = env().SLACK_WEBHOOK_URL;
  if (slack) {
    const linkPart = input.link ? `\n${input.link}` : "";
    await fetch(slack, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `*${input.title}*\n${input.body}${linkPart}` }),
    }).catch(() => undefined);
  }
}
