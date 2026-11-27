import { createServer, type IncomingMessage, type Server } from "node:http";
import { createServer as createTcpServer, type Server as TcpServer } from "node:net";
import type { AddressInfo } from "node:net";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migrate, type Db } from "@/db/client";
import * as schema from "@/db/schema";
import { alertChannels, mentions, projects, runs } from "@/db/schema";
import { deliverAlert, maybeSendSpikeAlert, testMessage } from "@/lib/alerts";

// Real deliveries against local receivers: an HTTP server for Slack/Discord/webhooks and a minimal SMTP server for email.

interface Received {
  path: string;
  body: unknown;
}

let http: Server;
let httpBase = "";
const received: Received[] = [];

let smtp: TcpServer;
let smtpPort = 0;
const mails: string[] = [];

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    request.on("data", (chunk) => (data += chunk));
    request.on("end", () => resolve(data));
  });
}

beforeAll(async () => {
  http = createServer(async (request, response) => {
    const body = await readBody(request);
    received.push({ path: request.url ?? "", body: JSON.parse(body) });
    response.statusCode = request.url === "/broken" ? 500 : 200;
    response.end("ok");
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  httpBase = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;

  smtp = createTcpServer((socket) => {
    let inData = false;
    let buffer = "";
    let message = "";
    socket.write("220 localhost ESMTP test\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let index: number;
      while ((index = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            mails.push(message);
            message = "";
            socket.write("250 OK queued\r\n");
          } else {
            message += `${line}\n`;
          }
          continue;
        }
        const command = line.slice(0, 4).toUpperCase();
        if (command === "EHLO" || command === "HELO") socket.write("250-localhost\r\n250 8BITMIME\r\n");
        else if (command === "DATA") {
          inData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (command === "QUIT") socket.end("221 Bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  smtpPort = (smtp.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise((resolve) => http.close(resolve));
  await new Promise((resolve) => smtp.close(resolve));
});

beforeEach(() => {
  received.length = 0;
  mails.length = 0;
});

async function freshDb(): Promise<Db> {
  const client = createClient({ url: ":memory:" });
  await migrate(client);
  return drizzle(client, { schema });
}

const now = () => new Date().toISOString();

async function seedProject(db: Db, historyNewMentions: number[]) {
  const project = await db
    .insert(projects)
    .values({ name: "Acme Notes", brandTerms: ["Acme Notes"], keywords: [], competitors: [], excludeTerms: [], sources: {}, createdAt: now() })
    .returning()
    .get();
  for (const [i, count] of historyNewMentions.entries()) {
    const startedAt = new Date(Date.now() - (i + 1) * 60 * 60 * 1000).toISOString();
    await db.insert(runs).values({ projectId: project.id, startedAt, status: "succeeded", newMentions: count });
  }
  const run = await db.insert(runs).values({ projectId: project.id, startedAt: now(), status: "succeeded" }).returning().get();
  return { project, runId: run.id };
}

async function seedMentions(db: Db, projectId: number, count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const row = await db
      .insert(mentions)
      .values({
        projectId,
        source: "reddit",
        platform: "reddit",
        url: `https://www.reddit.com/r/notes/comments/${i}/`,
        title: `Acme Notes thread ${i}`,
        text: "Switched to Acme Notes last week",
        authorHandle: `user${i}`,
        sortAt: new Date(Date.now() - i * 1000).toISOString(),
        metrics: {},
        matchedTerm: "Acme Notes",
        termKind: "brand",
        createdAt: now(),
      })
      .returning({ id: mentions.id })
      .get();
    ids.push(row.id);
  }
  return ids;
}

describe("spike alerts", () => {
  it("notifies Slack, Discord and webhook channels when new mentions exceed the multiplier × 7-day average", async () => {
    const db = await freshDb();
    const { project, runId } = await seedProject(db, [2, 2, 2]);
    for (const [kind, path] of [["slack", "/slack"], ["discord", "/discord"], ["webhook", "/hook"]] as const) {
      await db.insert(alertChannels).values({ projectId: project.id, kind, target: `${httpBase}${path}`, spikeMultiplier: 3, createdAt: now() });
    }
    const ids = await seedMentions(db, project.id, 7);

    expect(await maybeSendSpikeAlert(db, project, runId, ids)).toBe(3);

    const byPath = Object.fromEntries(received.map((r) => [r.path, r.body]));
    const slack = byPath["/slack"] as { text: string };
    expect(slack.text).toContain('7 new mentions for "Acme Notes"');
    expect(slack.text).toContain("3.5× the 7-day average");
    expect(slack.text).toContain("• [reddit] Acme Notes thread 0 — https://www.reddit.com/r/notes/comments/0/");
    expect((byPath["/discord"] as { content: string }).content).toBe(slack.text);
    const hook = byPath["/hook"] as { event: string; newMentions: number; average: number; mentions: unknown[]; project: { name: string } };
    expect(hook).toMatchObject({ event: "spike", newMentions: 7, average: 2, project: { name: "Acme Notes" } });
    expect(hook.mentions).toHaveLength(5);
  });

  it("stays quiet below the threshold or with fewer than three earlier runs", async () => {
    const db = await freshDb();
    const quiet = await seedProject(db, [2, 2, 2]);
    await db.insert(alertChannels).values({ projectId: quiet.project.id, kind: "webhook", target: `${httpBase}/hook`, spikeMultiplier: 3, createdAt: now() });
    expect(await maybeSendSpikeAlert(db, quiet.project, quiet.runId, await seedMentions(db, quiet.project.id, 6))).toBe(0);

    const young = await seedProject(db, [1, 1]);
    await db.insert(alertChannels).values({ projectId: young.project.id, kind: "webhook", target: `${httpBase}/hook`, spikeMultiplier: 3, createdAt: now() });
    expect(await maybeSendSpikeAlert(db, young.project, young.runId, [1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(0);
    expect(received).toHaveLength(0);
  });

  it("keeps notifying the other channels when one fails", async () => {
    const db = await freshDb();
    const { project, runId } = await seedProject(db, [1, 1, 1]);
    await db.insert(alertChannels).values({ projectId: project.id, kind: "webhook", target: `${httpBase}/broken`, spikeMultiplier: 3, createdAt: now() });
    await db.insert(alertChannels).values({ projectId: project.id, kind: "slack", target: `${httpBase}/slack`, spikeMultiplier: 3, createdAt: now() });
    const ids = await seedMentions(db, project.id, 5);
    expect(await maybeSendSpikeAlert(db, project, runId, ids)).toBe(1);
    expect(received.map((r) => r.path).sort()).toEqual(["/broken", "/slack"]);
  });
});

describe("email delivery", () => {
  it("sends the alert through SMTP_URL", async () => {
    const previous = process.env.SMTP_URL;
    process.env.SMTP_URL = `smtp://127.0.0.1:${smtpPort}`;
    try {
      await deliverAlert({ kind: "email", target: "team@example.com" }, testMessage({ id: 1, name: "Acme Notes" }));
    } finally {
      if (previous === undefined) delete process.env.SMTP_URL;
      else process.env.SMTP_URL = previous;
    }
    expect(mails).toHaveLength(1);
    expect(mails[0]).toContain("To: team@example.com");
    expect(mails[0]).toContain("Subject: Test alert for Acme Notes");
    expect(mails[0]).toContain("Open Social Listening");
  });

  it("explains a missing SMTP_URL", async () => {
    const previous = process.env.SMTP_URL;
    delete process.env.SMTP_URL;
    try {
      await expect(deliverAlert({ kind: "email", target: "team@example.com" }, testMessage({ id: 1, name: "Acme" }))).rejects.toThrow("SMTP_URL is not set");
    } finally {
      if (previous !== undefined) process.env.SMTP_URL = previous;
    }
  });
});
