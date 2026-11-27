import { count, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { mentions, projects, runs, type NewMentionRow } from "@/db/schema";
import { defaultSourcesConfig } from "@/lib/sources";
import type { SourceId } from "@/lib/sources/types";
import type { MentionMetrics, Sentiment, TermKind } from "@/lib/types";

/**
 * Demo data for a fictional note-taking app, "Acme Notes", tracked against two fictional
 * competitors. Every name, handle and post below is invented; links point at example.com.
 */
interface DemoMention {
  source: SourceId;
  kind: TermKind;
  competitor?: "Globex Docs" | "Initech Wiki";
  sentiment: Sentiment;
  /** Days before seeding; fractions place it within the day. */
  ago: number;
  author: string;
  handle: string;
  title?: string;
  text: string;
  metrics?: MentionMetrics;
}

const BRAND = "Acme Notes";
const KEYWORD = "note taking app";

const DEMO: DemoMention[] = [
  { source: "reddit", kind: "brand", sentiment: "positive", ago: 0.2, author: "quietlibrarian", handle: "quietlibrarian", title: "Acme Notes finally made me stop losing meeting notes", text: "Switched from paper three weeks ago. The daily page plus backlinks is exactly what I needed. Sync on Android was instant.", metrics: { likes: 214, comments: 37 } },
  { source: "x", kind: "brand", sentiment: "negative", ago: 0.4, author: "Dana Ruiz", handle: "danaruiz_dev", text: "Acme Notes sync has been stuck on \"Uploading 3 changes\" since this morning. Anyone else? Status page says all green.", metrics: { likes: 48, comments: 19, shares: 6, views: 5200 } },
  { source: "x", kind: "brand", sentiment: "negative", ago: 0.5, author: "Theo Park", handle: "theopark", text: "Same here, Acme Notes desktop won't sync since the 4.2 update. Rolling back for now.", metrics: { likes: 22, comments: 8, views: 2100 } },
  { source: "youtube", kind: "keyword", sentiment: "positive", ago: 0.7, author: "Focus Lab", handle: "focuslab", title: "I tested 6 note taking apps for a month — here's my ranking", text: "Acme Notes came second for speed, Globex Docs won for team sharing. Full breakdown with timestamps.", metrics: { likes: 3100, comments: 412, views: 88000 } },
  { source: "news", kind: "brand", sentiment: "neutral", ago: 0.9, author: "The Product Ledger", handle: "productledger.example", title: "Acme Notes raises seed round to expand offline-first sync", text: "The company says the funding will go toward its end-to-end encrypted sync engine and a public API." },
  { source: "web", kind: "brand", sentiment: "positive", ago: 1.1, author: "Margin Notes Blog", handle: "marginnotes.example", title: "Why I moved my research vault to Acme Notes", text: "Graph view is nice, but the real win is how fast search is across 9,000 notes." },
  { source: "tiktok", kind: "brand", sentiment: "positive", ago: 1.3, author: "studywithmira", handle: "studywithmira", text: "my exam setup: Acme Notes daily page + pomodoro timer 📚 template link in bio", metrics: { likes: 18400, comments: 302, shares: 1200, views: 241000 } },
  { source: "reddit", kind: "competitor", competitor: "Globex Docs", sentiment: "negative", ago: 1.4, author: "ops_wrangler", handle: "ops_wrangler", title: "Globex Docs price increase is wild", text: "Our 12-seat plan just went up 40%. Looking at Acme Notes and Initech Wiki as alternatives — experiences?", metrics: { likes: 389, comments: 141 } },
  { source: "reddit", kind: "keyword", sentiment: "neutral", ago: 1.6, author: "grad_student_42", handle: "grad_student_42", title: "Best note taking app for a PhD with lots of PDFs?", text: "Need PDF annotation, citations and something that won't break when I have 2,000 papers.", metrics: { likes: 96, comments: 88 } },
  { source: "x", kind: "competitor", competitor: "Initech Wiki", sentiment: "positive", ago: 1.8, author: "Priya N.", handle: "priyabuilds", text: "Initech Wiki's new page templates are genuinely good. Onboarded our whole support team in a day.", metrics: { likes: 76, comments: 9, views: 6400 } },
  { source: "web", kind: "competitor", competitor: "Globex Docs", sentiment: "neutral", ago: 2.1, author: "SaaS Pricing Watch", handle: "pricingwatch.example", title: "Globex Docs restructures plans, drops free tier for teams", text: "Existing teams keep their pricing until renewal, according to the announcement." },
  { source: "youtube", kind: "brand", sentiment: "positive", ago: 2.3, author: "Calm Systems", handle: "calmsystems", title: "My Acme Notes setup for 2026 (PARA + daily notes)", text: "A tour of folders, templates and the three plugins I actually use.", metrics: { likes: 1450, comments: 133, views: 31000 } },
  { source: "news", kind: "competitor", competitor: "Initech Wiki", sentiment: "positive", ago: 2.5, author: "Workplace Weekly", handle: "workplaceweekly.example", title: "Initech Wiki adds AI search across team spaces", text: "The feature rolls out to business plans first, with admin controls for data retention." },
  { source: "reddit", kind: "brand", sentiment: "negative", ago: 2.7, author: "linuxlefty", handle: "linuxlefty", title: "Acme Notes on Linux still has no tray icon", text: "Love the app but the Linux build feels like an afterthought. Please fix the AppImage update loop.", metrics: { likes: 57, comments: 24 } },
  { source: "x", kind: "keyword", sentiment: "neutral", ago: 2.9, author: "Sam Okafor", handle: "samokafor", text: "Hot take: the best note taking app is the one you open every day. Mine's still a plain text file.", metrics: { likes: 930, comments: 211, shares: 64, views: 74000 } },
  { source: "tiktok", kind: "competitor", competitor: "Globex Docs", sentiment: "neutral", ago: 3.1, author: "deskhacks", handle: "deskhacks", text: "Globex Docs vs Acme Notes in 30 seconds — which one fits your brain?", metrics: { likes: 6200, comments: 540, shares: 310, views: 96000 } },
  { source: "web", kind: "keyword", sentiment: "positive", ago: 3.3, author: "Indie Tools Review", handle: "indietools.example", title: "The best note taking app for writers in 2026", text: "Our pick for long-form drafts is Acme Notes, thanks to focus mode and version history." },
  { source: "reddit", kind: "brand", sentiment: "positive", ago: 3.5, author: "nightshift_nurse", handle: "nightshift_nurse", title: "Acme Notes templates for shift handovers", text: "Sharing my handover template — it cut our morning briefing from 20 to 8 minutes.", metrics: { likes: 642, comments: 58 } },
  { source: "x", kind: "brand", sentiment: "positive", ago: 3.8, author: "Lena Hoff", handle: "lenahoff", text: "Acme Notes quick capture on iOS is so fast I've stopped using voice memos.", metrics: { likes: 131, comments: 12, views: 9800 } },
  { source: "news", kind: "keyword", sentiment: "neutral", ago: 4.0, author: "Tech Daily Brief", handle: "techdailybrief.example", title: "Note taking app market grows as teams move off shared drives", text: "Analysts point to offline support and privacy as the main buying criteria this year." },
  { source: "youtube", kind: "competitor", competitor: "Initech Wiki", sentiment: "positive", ago: 4.2, author: "Team Ops Weekly", handle: "teamopsweekly", title: "Initech Wiki full tutorial for support teams", text: "Spaces, permissions and the new template gallery, step by step.", metrics: { likes: 870, comments: 64, views: 22000 } },
  { source: "reddit", kind: "competitor", competitor: "Initech Wiki", sentiment: "negative", ago: 4.4, author: "it_admin_jo", handle: "it_admin_jo", title: "Initech Wiki SSO setup was painful", text: "Took two support tickets to get SAML working. Docs were out of date.", metrics: { likes: 74, comments: 31 } },
  { source: "web", kind: "brand", sentiment: "negative", ago: 4.6, author: "Privacy First Forum", handle: "privacyfirst.example", title: "Does Acme Notes encrypt attachments?", text: "Thread asking whether file attachments are covered by end-to-end encryption. No official answer yet." },
  { source: "tiktok", kind: "keyword", sentiment: "positive", ago: 4.9, author: "notionless", handle: "notionless", text: "3 note taking app habits that changed my semester", metrics: { likes: 9100, comments: 220, shares: 640, views: 130000 } },
  { source: "x", kind: "competitor", competitor: "Globex Docs", sentiment: "negative", ago: 5.1, author: "Marco Silva", handle: "marcosilva", text: "Globex Docs just logged our whole team out mid-sprint. Third time this month.", metrics: { likes: 205, comments: 47, shares: 18, views: 15000 } },
  { source: "reddit", kind: "keyword", sentiment: "positive", ago: 5.3, author: "minimalist_mo", handle: "minimalist_mo", title: "Finally found a note taking app that doesn't do everything", text: "Acme Notes is boring in the best way. Text, links, search. Done.", metrics: { likes: 301, comments: 66 } },
  { source: "news", kind: "brand", sentiment: "positive", ago: 5.6, author: "App Roundup", handle: "approundup.example", title: "Acme Notes named an editor's choice for productivity", text: "Reviewers highlighted the offline mode and the clean export to Markdown." },
  { source: "youtube", kind: "brand", sentiment: "negative", ago: 5.8, author: "Honest App Reviews", handle: "honestappreviews", title: "Acme Notes after 6 months: the good and the annoying", text: "Search is great, collaboration is still weak compared with Globex Docs.", metrics: { likes: 2200, comments: 380, views: 54000 } },
  { source: "web", kind: "competitor", competitor: "Initech Wiki", sentiment: "positive", ago: 6.0, author: "Knowledge Ops Newsletter", handle: "knowledgeops.example", title: "How a 40-person agency runs on Initech Wiki", text: "Case study covering structure, page owners and quarterly clean-ups." },
  { source: "x", kind: "brand", sentiment: "neutral", ago: 6.3, author: "Acme fan account", handle: "acmenotes_tips", text: "Tip: hold Alt while dragging a block in Acme Notes to copy it instead of moving it.", metrics: { likes: 412, comments: 21, shares: 77, views: 28000 } },
  { source: "reddit", kind: "brand", sentiment: "positive", ago: 6.6, author: "dnd_dungeonmaster", handle: "dnd_dungeonmaster", title: "Running my whole campaign in Acme Notes", text: "NPCs, maps and session logs all linked. Players get a shared read-only vault.", metrics: { likes: 1180, comments: 143 } },
  { source: "tiktok", kind: "brand", sentiment: "negative", ago: 6.9, author: "techtruths", handle: "techtruths", text: "the Acme Notes subscription jump nobody is talking about", metrics: { likes: 4300, comments: 610, shares: 220, views: 77000 } },
  { source: "news", kind: "competitor", competitor: "Globex Docs", sentiment: "negative", ago: 7.2, author: "Cloud Outage Report", handle: "outagereport.example", title: "Globex Docs suffers second outage in a week", text: "Users reported sign-in failures for about two hours; the company has published a post-incident note." },
  { source: "x", kind: "keyword", sentiment: "positive", ago: 7.5, author: "Ana Lima", handle: "analima_ux", text: "Designing onboarding for a note taking app is humbling. Empty states matter more than features.", metrics: { likes: 640, comments: 58, views: 41000 } },
  { source: "reddit", kind: "competitor", competitor: "Globex Docs", sentiment: "positive", ago: 7.8, author: "pm_in_progress", handle: "pm_in_progress", title: "Globex Docs comments are still the best for reviews", text: "We tried moving to Acme Notes but stakeholders missed inline review threads.", metrics: { likes: 88, comments: 40 } },
  { source: "youtube", kind: "keyword", sentiment: "neutral", ago: 8.1, author: "Paper vs Pixels", handle: "papervspixels", title: "Handwriting vs note taking app: what the research says", text: "A look at retention studies and when digital notes actually help.", metrics: { likes: 5100, comments: 690, views: 120000 } },
  { source: "web", kind: "brand", sentiment: "positive", ago: 8.4, author: "Remote Work Stack", handle: "remotestack.example", title: "Our async meeting notes template for Acme Notes", text: "Download the template and the checklist we use for weekly reviews." },
  { source: "x", kind: "competitor", competitor: "Initech Wiki", sentiment: "neutral", ago: 8.7, author: "Kai Becker", handle: "kaibecker", text: "Is Initech Wiki worth it for a 5-person startup or is it overkill?", metrics: { likes: 33, comments: 27, views: 3900 } },
  { source: "reddit", kind: "brand", sentiment: "neutral", ago: 9.0, author: "curious_cat_22", handle: "curious_cat_22", title: "Acme Notes vs plain Markdown folders?", text: "What do I actually gain over a folder of .md files and a good editor?", metrics: { likes: 142, comments: 97 } },
  { source: "news", kind: "keyword", sentiment: "positive", ago: 9.4, author: "Education Tech Today", handle: "edtechtoday.example", title: "Universities pilot note taking apps for accessibility", text: "Students using screen readers reported faster review times in the pilot." },
  { source: "tiktok", kind: "competitor", competitor: "Initech Wiki", sentiment: "positive", ago: 9.7, author: "startupdesk", handle: "startupdesk", text: "how we document everything in Initech Wiki (steal this structure)", metrics: { likes: 2700, comments: 95, shares: 180, views: 39000 } },
  { source: "x", kind: "brand", sentiment: "positive", ago: 10.0, author: "Ravi Menon", handle: "ravimenon", text: "Acme Notes export to Markdown is lossless. That's why I trust it with 8 years of notes.", metrics: { likes: 289, comments: 17, views: 19000 } },
  { source: "web", kind: "competitor", competitor: "Globex Docs", sentiment: "negative", ago: 10.4, author: "Admin Corner Forum", handle: "admincorner.example", title: "Globex Docs storage limits hit us hard", text: "Thread on teams hitting the new attachment cap after the plan change." },
  { source: "reddit", kind: "keyword", sentiment: "negative", ago: 10.8, author: "burned_out_dev", handle: "burned_out_dev", title: "Every note taking app eventually becomes a junk drawer", text: "Five apps in five years and the problem was never the app.", metrics: { likes: 2400, comments: 512 } },
  { source: "youtube", kind: "brand", sentiment: "positive", ago: 11.2, author: "Study Sprint", handle: "studysprint", title: "Acme Notes for students: lecture to flashcards in 10 minutes", text: "Using the outline view and the flashcard plugin together.", metrics: { likes: 980, comments: 77, views: 26000 } },
  { source: "x", kind: "competitor", competitor: "Globex Docs", sentiment: "neutral", ago: 11.6, author: "Jules Martin", handle: "julesmartin", text: "Globex Docs roadmap call today: offline mode is \"on the list\". We'll see.", metrics: { likes: 54, comments: 11, views: 4700 } },
  { source: "news", kind: "brand", sentiment: "neutral", ago: 12.0, author: "Startup Wire", handle: "startupwire.example", title: "Acme Notes opens public API beta", text: "Developers can read and write notes through a REST API during the beta period." },
  { source: "reddit", kind: "competitor", competitor: "Initech Wiki", sentiment: "positive", ago: 12.4, author: "support_lead_sam", handle: "support_lead_sam", title: "Initech Wiki macros saved our support team", text: "Linking macros to wiki pages means answers stay in one place.", metrics: { likes: 120, comments: 22 } },
  { source: "web", kind: "keyword", sentiment: "neutral", ago: 12.8, author: "Comparison Hub", handle: "comparisonhub.example", title: "Note taking app comparison: pricing, sync and export", text: "A side-by-side table covering eight apps, updated monthly." },
  { source: "tiktok", kind: "brand", sentiment: "positive", ago: 13.2, author: "aestheticdesk", handle: "aestheticdesk", text: "Acme Notes dark theme + my desk tour 🌙", metrics: { likes: 12800, comments: 410, shares: 520, views: 188000 } },
  { source: "x", kind: "brand", sentiment: "negative", ago: 13.6, author: "Noah Kim", handle: "noahkim", text: "Acme Notes please let me change the default font size on mobile. My eyes.", metrics: { likes: 67, comments: 14, views: 5600 } },
];

const COMPETITORS = [
  { name: "Globex Docs", terms: ["Globex Docs"] },
  { name: "Initech Wiki", terms: ["Initech Wiki"] },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function termFor(entry: DemoMention): string {
  if (entry.kind === "competitor" && entry.competitor) return entry.competitor;
  return entry.kind === "keyword" ? KEYWORD : BRAND;
}

/** Create the demo project once, when the database has no projects at all. */
export async function seedDemoIfEmpty(db: Db): Promise<boolean> {
  const row = await db.select({ total: count() }).from(projects).get();
  if ((row?.total ?? 0) > 0) return false;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const [project] = await db
    .insert(projects)
    .values({
      name: `${BRAND} (demo)`,
      brandTerms: [BRAND],
      keywords: [KEYWORD],
      competitors: COMPETITORS,
      excludeTerms: ["hiring"],
      sources: defaultSourcesConfig(),
      intervalMinutes: 1440,
      monthlyBudgetCredits: 7500,
      paused: false,
      pausedReason: null,
      isDemo: true,
      lastRunAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 14 * DAY_MS).toISOString(),
    })
    .returning({ id: projects.id });

  const rows: NewMentionRow[] = DEMO.map((entry, index) => {
    const at = new Date(now - entry.ago * DAY_MS).toISOString();
    return {
      projectId: project.id,
      source: entry.source,
      platform: entry.source,
      externalId: `demo-${index + 1}`,
      url: `https://example.com/demo/${entry.source}/${index + 1}`,
      title: entry.title ?? null,
      text: entry.text,
      authorName: entry.author,
      authorHandle: entry.handle,
      authorUrl: null,
      authorAvatar: null,
      publishedAt: at,
      collectedAt: at,
      sortAt: at,
      metrics: entry.metrics ?? {},
      matchedTerm: termFor(entry),
      termKind: entry.kind,
      competitorName: entry.kind === "competitor" ? (entry.competitor ?? null) : null,
      // Only the Web source returns sentiment scores today; the demo shows the same thing a real project would.
      sentiment: entry.source === "web" ? entry.sentiment : null,
      starred: index === 1 || index === 7,
      read: entry.ago > 3,
      createdAt: at,
    };
  });
  for (let i = 0; i < rows.length; i += 25) {
    await db.insert(mentions).values(rows.slice(i, i + 25)).onConflictDoNothing();
  }

  // One daily run per day so the dashboard has history and a credit total.
  const runRows = Array.from({ length: 14 }, (_, day) => {
    const startedAt = new Date(now - (13 - day) * DAY_MS - 2 * 60 * 60 * 1000);
    const newMentions = DEMO.filter((entry) => Math.floor(entry.ago) === 13 - day).length;
    return {
      projectId: project.id,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date(startedAt.getTime() + 95_000).toISOString(),
      status: "succeeded" as const,
      creditsUsed: 58 + (day % 4) * 3.2,
      newMentions,
      error: null,
    };
  });
  await db.insert(runs).values(runRows);

  console.log(`[open-social-listening] seeded demo project ${project.id} (${rows.length} mentions) at ${nowIso}`);
  return true;
}

export async function isDemoProject(db: Db, projectId: number): Promise<boolean> {
  const row = await db.select({ isDemo: projects.isDemo }).from(projects).where(eq(projects.id, projectId)).get();
  return Boolean(row?.isDemo);
}
