import React from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Bot,
  CircleDollarSign,
  ClipboardList,
  Eye,
  ShieldCheck,
} from 'lucide-react';

interface PublicDemoProps {
  onExit: () => void;
}

const cases = [
  {
    id: 'CASE RR-001',
    title: 'Backup power for essential equipment',
    detail: 'A fictional household in Riverbend reports flood damage and asks for backup power.',
    status: 'Received · organizer review pending',
    tone: 'amber',
  },
  {
    id: 'CASE RR-002',
    title: 'Infant supplies at a temporary shelter',
    detail: 'A fictional family at a school shelter requests formula, diapers, and warm bedding.',
    status: 'Received · organizer review pending',
    tone: 'sky',
  },
  {
    id: 'CASE RR-003',
    title: 'Pump and safety gear for a volunteer crew',
    detail: 'A fictional response team requests a replacement water pump and safety waders.',
    status: 'Received · organizer review pending',
    tone: 'sky',
  },
];

export const PublicDemo: React.FC<PublicDemoProps> = ({ onExit }) => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-xl">🫶</div>
          <div>
            <div className="font-serif text-xl font-bold">ReliefRail</div>
            <div className="text-xs text-slate-500">Public product walkthrough</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Coordinator access
        </button>
      </div>
    </header>

    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
          <div>
            <p className="text-sm font-bold text-sky-950">Read-only demo · synthetic scenario</p>
            <p className="mt-1 text-xs leading-5 text-sky-900">
              Every case below is fictional. This guest walkthrough has no account, no real recipient data, and no payment actions.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-800">Public guest view</span>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-7 text-white shadow-lg sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Community relief coordination</p>
          <h1 className="mt-4 max-w-3xl font-serif text-3xl font-bold leading-tight sm:text-4xl">
            Make every relief decision easier to follow.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-200">
            ReliefRail brings requests, human-reviewed plans, PayPal Sandbox payments, and an auditable pool ledger into one workflow.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">AI drafts, people decide</span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">Provider-confirmed money states</span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">Synthetic demo data</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <Metric icon={<ClipboardList className="h-4 w-4" />} label="Fictional cases" value="03" />
          <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Real recipient records" value="0" />
          <Metric icon={<CircleDollarSign className="h-4 w-4" />} label="Guest-demo transactions" value="0" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Example intake queue</p>
              <h2 className="mt-1 font-serif text-xl font-bold">Riverbend flood response</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Illustrative only</span>
          </div>
          <div className="divide-y divide-slate-100">
            {cases.map((item) => (
              <article key={item.id} className="px-6 py-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.id}</p>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-600">{item.detail}</p>
                  </div>
                  <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${item.tone === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800'}`}>
                    {item.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-6">
            <div className="flex items-center gap-2 text-violet-900">
              <Bot className="h-5 w-5" />
              <h2 className="text-sm font-bold">AI-assisted draft</h2>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-800">“Consider a portable backup battery and confirm device requirements with the requester.”</p>
            <p className="mt-3 text-xs leading-5 text-slate-600">Example suggestion from fictional text. It does not assess eligibility, detect fraud, or approve spending.</p>
            <span className="mt-4 inline-flex rounded-full border border-violet-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">Human review required</span>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-800">
              <BadgeCheck className="h-5 w-5" />
              <h2 className="text-sm font-bold">Money movement stays accountable</h2>
            </div>
            <ol className="mt-4 space-y-3 text-xs leading-5 text-slate-600">
              <li><b className="text-slate-800">1. PayPal confirms</b> a Sandbox contribution.</li>
              <li><b className="text-slate-800">2. An authorized coordinator</b> reviews and approves a need.</li>
              <li><b className="text-slate-800">3. The ledger records</b> reserves, confirmed payouts, releases, and refunds.</li>
            </ol>
            <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] font-medium text-emerald-900">This guest view does not submit payments or modify the ledger.</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Clear operating boundary</p>
          <h2 className="mt-2 font-serif text-2xl font-bold">A public walkthrough without public admin credentials.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Public visitors can explore the synthetic workflow. Coordinator access uses a private token and remains separate from this read-only page.
          </p>
        </div>
      </section>
    </main>
  </div>
);

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-brand-700">{icon}</span>
    <div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  </div>
);
