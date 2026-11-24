import { and, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { createTransport } from "nodemailer";
import type { Db } from "@/db/client";
import { alertChannels, mentions, runs, type AlertChannelRow, type ProjectRow } from "@/db/schema";
import { errorMessage } from "@/lib/socq/errors";

export interface AlertMention {
  source: string;
  url: string;
  title: string | null;
  text: string | null;
  author: string | null;
}

export interface AlertMessage {
  event: "spike" | "test";
  subject: string;
  text: string;
  project: { id: number; name: string };
  newMentions: number;
  /** Average new mentions per run over the last 7 days, before this run. */
  average: number | null;
  mentions: AlertMention[];
}

const MIN_HISTORY_RUNS = 3;
const HISTORY_DAYS = 7;
const SAMPLE_SIZE = 5;

/**
 * Notify every enabled channel whose spike threshold this run crossed:
 * new mentions > spike_multiplier × the 7-day average per run (needs at least 3 earlier runs).
 * Returns how many channels were notified.
 */
export async function maybeSendSpikeAlert(db: Db, project: ProjectRow, runId: number, newMentionIds: number[]): Promise<number> {
  const channels = await db
    .select()
    .from(alertChannels)
    .where(and(eq(alertChannels.projectId, project.id), eq(alertChannels.enabled, true)));
  if (!channels.length) return 0;

  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const history = await db
    .select({ newMentions: runs.newMentions })
    .from(runs)
    .where(
      and(
        eq(runs.projectId, project.id),
        ne(runs.id, runId),
        gte(runs.startedAt, since),
        inArray(runs.status, ["succeeded", "partial"]),
      ),
    );
  if (history.length < MIN_HISTORY_RUNS) return 0;
  const average = history.reduce((sum, row) => sum + row.newMentions, 0) / history.length;
  const count = newMentionIds.length;

  const due = channels.filter((channel) => count > channel.spikeMultiplier * average);
  if (!due.length) return 0;

  const sample = await db
    .select()
    .from(mentions)
    .where(inArray(mentions.id, newMentionIds.slice(0, 200)))
    .orderBy(desc(mentions.sortAt))
    .limit(SAMPLE_SIZE);

  const ratio = average > 0 ? `${(count / average).toFixed(1)}× the 7-day average` : "well above the 7-day average";
  const message: AlertMessage = {
    event: "spike",
    subject: `${count} new mentions for ${project.name}`,
    text: `${count} new mentions for "${project.name}" in the latest run (${ratio}).`,
    project: { id: project.id, name: project.name },
    newMentions: count,
    average: Math.round(average * 10) / 10,
    mentions: sample.map((row) => ({
      source: row.source,
      url: row.url,
      title: row.title,
      text: row.text ? row.text.slice(0, 280) : null,
      author: row.authorHandle ?? row.authorName,
    })),
  };

  let sent = 0;
  for (const channel of due) {
    try {
      await deliverAlert(channel, message);
      sent++;
    } catch (error) {
      console.error(`[open-social-listening] alert channel ${channel.id} (${channel.kind}) failed:`, errorMessage(error));
    }
  }
  return sent;
}

export function testMessage(project: { id: number; name: string }): AlertMessage {
  return {
    event: "test",
    subject: `Test alert for ${project.name}`,
    text: `This is a test alert from Open Social Listening for "${project.name}". Spike alerts will arrive here.`,
    project,
    newMentions: 0,
    average: null,
    mentions: [],
  };
}

function plainText(message: AlertMessage): string {
  const lines = [message.text];
  for (const mention of message.mentions) {
    const label = mention.title ?? mention.text ?? mention.url;
    lines.push(`• [${mention.source}] ${label.slice(0, 140)} — ${mention.url}`);
  }
  return lines.join("\n");
}

async function postJson(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Webhook responded with ${response.status}`);
}

export async function deliverAlert(channel: Pick<AlertChannelRow, "kind" | "target">, message: AlertMessage): Promise<void> {
  switch (channel.kind) {
    case "slack":
      return postJson(channel.target, { text: plainText(message) });
    case "discord":
      return postJson(channel.target, { content: plainText(message).slice(0, 1900) });
    case "webhook":
      return postJson(channel.target, message);
    case "email": {
      const smtpUrl = process.env.SMTP_URL?.trim();
      if (!smtpUrl) throw new Error("SMTP_URL is not set");
      const transport = createTransport(smtpUrl);
      await transport.sendMail({
        from: process.env.ALERT_FROM?.trim() || "Open Social Listening <alerts@localhost>",
        to: channel.target,
        subject: message.subject,
        text: plainText(message),
      });
      return;
    }
    default: {
      const kind: never = channel.kind;
      throw new Error(`Unknown alert channel kind: ${String(kind)}`);
    }
  }
}
