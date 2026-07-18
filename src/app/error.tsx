"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-slate-100"><div><h1 className="text-2xl font-semibold">Something went wrong</h1><p className="mt-2 text-slate-400">Please try again. Your progress has not been changed.</p><button className="mt-6 rounded-lg bg-cyan-300 px-4 py-2 font-medium text-slate-950" onClick={reset}>Try again</button></div></main>;
}
