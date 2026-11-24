/**
 * Runs once when the Next.js server starts. On the Node.js runtime it starts the
 * in-process scheduler unless OSL_DISABLE_SCHEDULER=1.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.OSL_DISABLE_SCHEDULER !== "1") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
