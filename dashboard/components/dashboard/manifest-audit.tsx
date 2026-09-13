'use client';

import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  FileSearch,
  Play,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { downloadText } from '@/lib/downloads';
import {
  auditManifests,
  SAMPLE_MANIFEST,
  type AuditReport,
  type ManifestInput,
  type Severity,
} from '@/lib/kubernetes-audit';

const severityStyles: Record<Severity, string> = {
  critical: 'border-rose-200 bg-rose-50 text-rose-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-blue-200 bg-blue-50 text-blue-700',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

export function ManifestAudit() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputs, setInputs] = useState<ManifestInput[]>([]);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [redactNames, setRedactNames] = useState(true);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const loadFiles = async (files: File[]) => {
    setError('');
    const accepted = files.filter((file) => /\.(ya?ml|json)$/i.test(file.name));
    if (accepted.length !== files.length) {
      setError('Only .yaml, .yml, and .json files are supported.');
      return;
    }
    if (accepted.length === 0) {
      setError('Select at least one Kubernetes manifest.');
      return;
    }
    if (accepted.length > 20) {
      setError('Select no more than 20 files in one local assessment.');
      return;
    }
    if (accepted.some((file) => file.size > MAX_FILE_BYTES)) {
      setError('Each manifest must be 2 MB or smaller.');
      return;
    }
    if (
      accepted.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES
    ) {
      setError('The combined manifest size must be 10 MB or smaller.');
      return;
    }
    const loaded = await Promise.all(
      accepted.map(async (file) => ({
        name: file.name,
        content: await file.text(),
      })),
    );
    setInputs(loaded);
    setReport(null);
  };

  const runAudit = () => {
    setError('');
    try {
      setReport(auditManifests(inputs, redactNames));
    } catch (caught) {
      setReport(null);
      setError(
        caught instanceof Error
          ? caught.message
          : 'The manifests could not be assessed.',
      );
    }
  };

  const loadSample = () => {
    setInputs([
      { name: 'sample-risky-deployment.yaml', content: SAMPLE_MANIFEST },
    ]);
    setError('');
    setReport(null);
  };

  const reset = () => {
    setInputs([]);
    setReport(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const exportReport = () => {
    if (!report) return;
    downloadText(
      'reliabilitykit-audit.json',
      `${JSON.stringify(report, null, 2)}\n`,
      'application/json',
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]">
        <Card className="border border-slate-200 bg-white/90 ring-0">
          <CardHeader className="border-b border-slate-200/70 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-slate-950">
                  Manifest intake
                </CardTitle>
                <CardDescription className="mt-1">
                  Select local Kubernetes YAML or JSON. Nothing is uploaded.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                Offline
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <div
              className={`rounded-2xl border border-dashed p-6 text-center transition-colors ${
                dragging
                  ? 'border-indigo-400 bg-indigo-50/70'
                  : 'border-slate-300 bg-slate-50/70 hover:border-indigo-300 hover:bg-indigo-50/35'
              }`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void loadFiles(Array.from(event.dataTransfer.files));
              }}
            >
              <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-cyan-50 text-indigo-600 shadow-sm">
                <Upload className="size-5" />
              </div>
              <p className="font-medium text-slate-950">Drop manifests here</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Up to 20 files · 2 MB each · Secret objects skipped
              </p>
              <input
                ref={inputRef}
                className="sr-only"
                id="manifest-files"
                type="file"
                accept=".yaml,.yml,.json"
                multiple
                onChange={(event) =>
                  void loadFiles(Array.from(event.target.files ?? []))
                }
              />
              <Button
                className="mt-4 border-slate-200 bg-white text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50"
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                Browse files
              </Button>
            </div>

            {inputs.length > 0 && (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-700">
                    {inputs.length} file{inputs.length === 1 ? '' : 's'} ready
                  </p>
                  <button
                    className="text-xs text-slate-500 hover:text-indigo-700"
                    onClick={reset}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-28 space-y-1 overflow-y-auto">
                  {inputs.map((input) => (
                    <div
                      className="flex items-center gap-2 text-xs text-slate-500"
                      key={input.name}
                    >
                      <FileJson className="size-3.5 text-indigo-500" />
                      <span className="truncate">{input.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              aria-pressed={redactNames}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
                redactNames
                  ? 'border-indigo-200 bg-indigo-50/60'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
              onClick={() => setRedactNames((value) => !value)}
              type="button"
            >
              <span className="flex items-center gap-3">
                <ShieldCheck className="size-4 text-indigo-600" />
                <span>
                  <span className="block text-xs font-medium text-slate-800">
                    Redact identifiers
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Replace names with stable local aliases
                  </span>
                </span>
              </span>
              <span
                className={`h-5 w-9 rounded-full p-0.5 transition-colors ${redactNames ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span
                  className={`block size-4 rounded-full bg-white shadow-sm transition-transform ${redactNames ? 'translate-x-4' : ''}`}
                />
              </span>
            </button>

            {error && (
              <Alert className="border-rose-200 bg-rose-50 text-rose-800">
                <AlertTriangle />
                <AlertTitle>Assessment stopped</AlertTitle>
                <AlertDescription className="text-rose-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-10 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={loadSample}
              >
                <FileSearch /> Try sample
              </Button>
              <Button
                className="h-10 bg-indigo-600 text-white shadow-[0_8px_24px_rgb(79_70_229/18%)] hover:bg-indigo-500"
                disabled={inputs.length === 0}
                onClick={runAudit}
              >
                <Play /> Run audit
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[560px] border border-slate-200 bg-white/90 ring-0">
          {!report ? (
            <CardContent className="grid flex-1 place-items-center text-center">
              <div className="max-w-md px-6">
                <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-slate-200 bg-linear-to-br from-indigo-50 to-cyan-50 text-indigo-400">
                  <FileSearch className="size-7" />
                </div>
                <h2 className="text-lg font-semibold text-slate-950">
                  No assessment yet
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Add manifests or load the sample. Findings will appear here
                  with severity, evidence, and remediation guidance.
                </p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b border-slate-200/70 pb-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="grid size-16 place-items-center rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-cyan-50">
                      <div className="text-center">
                        <p className="font-mono text-2xl font-semibold text-slate-950">
                          {report.score}
                        </p>
                        <p className="text-[9px] tracking-wider text-indigo-600 uppercase">
                          Grade {report.grade}
                        </p>
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-slate-950">
                        Readiness assessment
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {report.resourcesScanned} resources ·{' '}
                        {report.filesScanned} files ·{' '}
                        {report.sensitiveResourcesSkipped} Secrets skipped
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      onClick={reset}
                    >
                      <RotateCcw /> Reset
                    </Button>
                    <Button
                      size="sm"
                      className="bg-indigo-600 text-white hover:bg-indigo-500"
                      onClick={exportReport}
                    >
                      <Download /> JSON
                    </Button>
                  </div>
                </div>
                <Progress
                  value={report.score}
                  className="mt-3 [&_[data-slot=progress-indicator]]:bg-linear-to-r [&_[data-slot=progress-indicator]]:from-indigo-600 [&_[data-slot=progress-indicator]]:to-cyan-500 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-slate-200"
                />
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <div className="grid grid-cols-4 gap-2">
                  {(['critical', 'high', 'medium', 'low'] as Severity[]).map(
                    (severity) => (
                      <div
                        className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 text-center"
                        key={severity}
                      >
                        <p className="font-mono text-lg text-slate-950">
                          {report.findingCounts[severity]}
                        </p>
                        <p className="text-[10px] tracking-wider text-slate-600 uppercase">
                          {severity}
                        </p>
                      </div>
                    ),
                  )}
                </div>

                {report.findings.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                    <CheckCircle2 className="mx-auto mb-3 size-7 text-emerald-600" />
                    <p className="font-medium text-emerald-800">
                      No findings from the current rule set
                    </p>
                    <p className="mt-1 text-xs text-emerald-700/70">
                      Runtime behavior and business context still require human
                      review.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[350px] space-y-2 overflow-y-auto pr-1">
                    {report.findings.map((finding, index) => (
                      <article
                        className="rounded-xl border border-slate-200/70 bg-slate-50/65 p-4 transition-colors hover:border-indigo-200 hover:bg-white"
                        key={`${finding.resource}-${finding.checkId}-${index}`}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={severityStyles[finding.severity]}
                          >
                            {finding.severity}
                          </Badge>
                          <code className="text-[11px] text-slate-500">
                            {finding.checkId}
                          </code>
                          <span className="min-w-0 truncate font-mono text-[11px] text-slate-600">
                            {finding.resource}
                          </span>
                        </div>
                        <p className="text-sm leading-5 text-slate-800">
                          {finding.message}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          <span className="font-medium text-indigo-600">
                            Remediation:
                          </span>{' '}
                          {finding.remediation}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
