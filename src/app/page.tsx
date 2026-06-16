import Image from 'next/image';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="max-w-3xl rounded-3xl border border-slate-700 bg-slate-950/90 p-10 shadow-2xl shadow-slate-950/30">
        <h1 className="text-4xl font-semibold mb-4">Fast Fold Omaha</h1>
        <p className="text-slate-300 mb-6">
          Next.js + TypeScript + Tailwind CSS project initialized for the Fast Fold Omaha practice app.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <a className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left hover:border-slate-500" href="https://nextjs.org/docs">
            <h2 className="text-xl font-semibold">Documentation</h2>
            <p className="text-slate-400 mt-2">Learn more about Next.js in the docs.</p>
          </a>
          <a className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left hover:border-slate-500" href="https://tailwindcss.com/docs">
            <h2 className="text-xl font-semibold">Tailwind CSS</h2>
            <p className="text-slate-400 mt-2">Use Tailwind utility classes for styling.</p>
          </a>
        </div>
      </div>
    </main>
  );
}
