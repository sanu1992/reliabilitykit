'use client';

import {
  Activity,
  Calculator,
  Check,
  FileSearch,
  FileText,
  Fingerprint,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { ManifestAudit } from '@/components/dashboard/manifest-audit';
import { PostmortemBuilder } from '@/components/dashboard/postmortem-builder';
import { SloCalculator } from '@/components/dashboard/slo-calculator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const tools = [
  {
    value: 'audit',
    number: '01',
    title: 'Manifest audit',
    description: 'Find Kubernetes reliability gaps before rollout.',
    icon: FileSearch,
    accent: 'text-indigo-600',
  },
  {
    value: 'slo',
    number: '02',
    title: 'SLO budget',
    description: 'Turn objectives and events into a usable budget.',
    icon: Calculator,
    accent: 'text-cyan-600',
  },
  {
    value: 'postmortem',
    number: '03',
    title: 'Postmortem',
    description: 'Convert incident facts into structured learning.',
    icon: FileText,
    accent: 'text-violet-600',
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="rk-image-background" aria-hidden="true" />
      <div className="rk-aurora" aria-hidden="true" />

      <header className="relative z-40 border-b border-slate-200/80 bg-white/78 shadow-[0_1px_0_rgb(255_255_255/80%)] backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-4 sm:px-7">
          <div className="flex items-center gap-3.5">
            <div className="relative grid size-10 place-items-center overflow-hidden rounded-[14px] border border-indigo-200 bg-linear-to-br from-indigo-50 to-cyan-50 text-indigo-600 shadow-[0_8px_26px_rgb(79_70_229/14%)]">
              <Activity className="relative z-10 size-5" strokeWidth={2.2} />
              <span className="absolute inset-x-1 bottom-0 h-px bg-linear-to-r from-transparent via-cyan-500 to-transparent" />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
                ReliabilityKit
              </p>
              <p className="mt-0.5 font-mono text-[9px] tracking-[0.18em] text-slate-500 uppercase">
                Operator workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 border-r border-slate-200 pr-4 font-mono text-[10px] tracking-[0.14em] text-slate-500 uppercase sm:flex">
              <Radio className="size-3 text-cyan-600" /> v0.1 · browser edition
            </div>
            <Badge
              variant="outline"
              className="h-8 gap-2 rounded-full border-emerald-200 bg-emerald-50/80 px-3.5 text-[11px] text-emerald-700 shadow-sm"
            >
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-35" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              Local processing
            </Badge>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 py-8 sm:px-7 sm:py-10">
        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-indigo-600 uppercase">
              <span className="h-px w-7 bg-linear-to-r from-indigo-600 to-cyan-500" />{' '}
              Reliability control
            </div>
            <h1 className="max-w-3xl text-4xl leading-[1.04] font-semibold tracking-[-0.055em] text-slate-950 sm:text-5xl">
              The SRE workbench for decisions that hold up.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
              Audit delivery risk, quantify service tolerance, and preserve
              incident learning—without moving operational data off your device.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/76 p-4 shadow-[0_18px_55px_rgb(51_65_85/8%),inset_0_1px_rgb(255_255_255/90%)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-cyan-50 to-indigo-50 text-cyan-700 ring-1 ring-cyan-100">
                  <Fingerprint className="size-4.5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-900">
                    Private data path
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    Files and incident details are evaluated inside this tab.
                  </p>
                </div>
              </div>
              <span className="font-mono text-[9px] tracking-[0.14em] text-indigo-600 uppercase">
                Verified
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200/70 pt-3">
              {[
                ['14', 'audit checks'],
                ['0', 'credentials'],
                ['3', 'workflows'],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="font-mono text-sm text-slate-900">{value}</p>
                  <p className="mt-0.5 text-[9px] tracking-[0.08em] text-slate-500 uppercase">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Tabs defaultValue="audit" className="gap-0">
          <TabsList
            variant="line"
            className="rk-tool-tabs grid h-auto w-full grid-cols-1 gap-2 rounded-2xl border border-slate-200/80 bg-white/64 p-2 shadow-[0_18px_55px_rgb(51_65_85/7%)] backdrop-blur-xl group-data-horizontal/tabs:h-auto sm:grid-cols-3"
            aria-label="Reliability tools"
          >
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <TabsTrigger
                  key={tool.value}
                  value={tool.value}
                  className="rk-tool-tab group/tool h-auto min-w-0 items-start justify-start gap-3 rounded-xl border border-transparent px-4 py-3.5 text-left after:hidden hover:border-indigo-100 hover:bg-indigo-50/50 data-active:border-indigo-200 data-active:bg-white data-active:shadow-[0_12px_32px_rgb(79_70_229/10%)]"
                >
                  <span
                    className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200/80 bg-linear-to-br from-white to-slate-50 shadow-sm ${tool.accent}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[9px] tracking-[0.12em] text-slate-400">
                        {tool.number}
                      </span>
                      <span className="text-[13px] font-medium text-slate-700 group-data-active/tool:text-slate-950">
                        {tool.title}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 font-normal whitespace-normal text-slate-500 group-data-active/tool:text-slate-600">
                      {tool.description}
                    </span>
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/55 px-4 py-2.5 text-[10px] tracking-[0.08em] text-slate-500 uppercase backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Check className="size-3" /> Ready
              </span>
              <span>Policy pack RK-K8S/0.1</span>
            </div>
            <span className="flex items-center gap-1.5 normal-case tracking-normal">
              <LockKeyhole className="size-3" /> No backend connection
            </span>
          </div>

          <div className="rk-tool-surface mt-4">
            <TabsContent value="audit">
              <ManifestAudit />
            </TabsContent>
            <TabsContent value="slo">
              <SloCalculator />
            </TabsContent>
            <TabsContent value="postmortem">
              <PostmortemBuilder />
            </TabsContent>
          </div>
        </Tabs>

        <footer className="mt-8 flex flex-col justify-between gap-3 border-t border-slate-200/80 py-6 text-[11px] text-slate-500 sm:flex-row sm:items-center">
          <p>ReliabilityKit · local-first engineering evidence</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-indigo-600" /> Inputs stay
              on device
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-cyan-600" /> Built for
              deliberate review
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
