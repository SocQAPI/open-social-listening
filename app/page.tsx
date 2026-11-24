export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 px-6">
      <h1 className="text-2xl font-semibold">Open Social Listening</h1>
      <p className="text-neutral-600">
        The interface is on its way. The API is already live under <code>/api</code> — try{" "}
        <a className="underline" href="/api/projects">
          /api/projects
        </a>
        .
      </p>
    </main>
  );
}
