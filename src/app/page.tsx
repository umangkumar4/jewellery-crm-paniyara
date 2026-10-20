"use client";

import { useEffect, useState } from "react";

type HealthStatus = { status: string; db: string } | { error: string };

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch((err) => setHealth({ error: String(err) }));
  }, []);

  const dbStatus = health && "db" in health ? health.db : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Jewellery CRM & POS
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Next.js project scaffold - no feature pages built yet.
        </p>

        <div className="mt-6 flex items-center justify-between rounded-lg bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-900">
          <span className="text-zinc-600 dark:text-zinc-400">MongoDB connection</span>
          <span
            className={
              dbStatus === "connected"
                ? "font-medium text-emerald-600 dark:text-emerald-400"
                : health
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "text-zinc-400"
            }
          >
            {dbStatus ?? (health ? "error" : "checking…")}
          </span>
        </div>

        <p className="mt-6 text-xs text-zinc-400">
          See <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">docs/PROGRESS.md</code> for the
          endpoint-by-endpoint build checklist.
        </p>
      </div>
    </div>
  );
}
