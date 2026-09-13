'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Download,
  Gauge,
  Timer,
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
import { Input } from '@/components/ui/input';
import { Progress, ProgressLabel } from '@/components/ui/progress';
import { copyText, downloadText } from '@/lib/downloads';
import { calculateSlo } from '@/lib/slo';

const objectivePresets = [99, 99.9, 99.95, 99.99];

export function SloCalculator() {
  const [objective, setObjective] = useState(99.9);
  const [windowDays, setWindowDays] = useState(30);
  const [totalEvents, setTotalEvents] = useState(1_000_000);
  const [badEvents, setBadEvents] = useState(500);
  const [feedback, setFeedback] = useState('');

  const calculation = useMemo(() => {
    try {
      return {
        result: calculateSlo(objective, windowDays, totalEvents, badEvents),
        error: '',
      };
    } catch (caught) {
      return {
        result: null,
        error:
          caught instanceof Error
            ? caught.message
            : 'The error budget could not be calculated.',
      };
    }
  }, [badEvents, objective, totalEvents, windowDays]);

  const result = calculation.result;
  const consumed = result?.budgetConsumedPercent;
  const status = !result
    ? 'Invalid input'
    : result.compliant
      ? typeof consumed === 'number' && consumed >= 80
        ? 'Budget at risk'
        : 'Within budget'
      : 'Budget exhausted';

  const resultJson = result ? `${JSON.stringify(result, null, 2)}\n` : '';

  const copyCalculation = async () => {
    if (!result) return;
    try {
      await copyText(resultJson);
      setFeedback('Calculation copied.');
    } catch (caught) {
      setFeedback(
        caught instanceof Error
          ? caught.message
          : 'Could not copy the calculation.',
      );
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
      <Card className="border border-slate-200 bg-white/90 ring-0">
        <CardHeader className="border-b border-slate-200/70 pb-4">
          <CardTitle className="text-slate-950">Service objective</CardTitle>
          <CardDescription>
            Define the reliability promise, measurement window, and observed
            events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-1">
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-slate-400">
              Objective preset
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {objectivePresets.map((preset) => (
                <Button
                  aria-pressed={objective === preset}
                  className={
                    objective === preset
                      ? 'border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-cyan-200 hover:bg-cyan-50/50'
                  }
                  key={preset}
                  onClick={() => setObjective(preset)}
                  size="sm"
                  variant="outline"
                >
                  {preset}%
                </Button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <label
              className="space-y-2 text-xs font-medium text-slate-600"
              htmlFor="slo-objective"
            >
              Objective (%)
              <Input
                id="slo-objective"
                aria-invalid={
                  !Number.isFinite(objective) ||
                  objective <= 0 ||
                  objective > 100
                }
                className="h-11 border-slate-300 bg-slate-50/70 font-mono text-slate-950"
                min="0.001"
                max="100"
                step="0.01"
                type="number"
                value={objective}
                onChange={(event) => setObjective(Number(event.target.value))}
              />
            </label>
            <label
              className="space-y-2 text-xs font-medium text-slate-600"
              htmlFor="slo-window"
            >
              Window (days)
              <Input
                id="slo-window"
                className="h-11 border-slate-300 bg-slate-50/70 font-mono text-slate-950"
                min="1"
                type="number"
                value={windowDays}
                onChange={(event) => setWindowDays(Number(event.target.value))}
              />
            </label>
            <label
              className="space-y-2 text-xs font-medium text-slate-600"
              htmlFor="slo-total-events"
            >
              Total events
              <Input
                id="slo-total-events"
                className="h-11 border-slate-300 bg-slate-50/70 font-mono text-slate-950"
                min="1"
                type="number"
                value={totalEvents}
                onChange={(event) => setTotalEvents(Number(event.target.value))}
              />
            </label>
            <label
              className="space-y-2 text-xs font-medium text-slate-600"
              htmlFor="slo-bad-events"
            >
              Bad events
              <Input
                id="slo-bad-events"
                className="h-11 border-slate-300 bg-slate-50/70 font-mono text-slate-950"
                min="0"
                type="number"
                value={badEvents}
                onChange={(event) => setBadEvents(Number(event.target.value))}
              />
            </label>
          </div>

          {calculation.error && (
            <Alert className="border-rose-200 bg-rose-50 text-rose-800">
              <AlertTriangle />
              <AlertTitle>Check the inputs</AlertTitle>
              <AlertDescription className="text-rose-700">
                {calculation.error}
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/45 p-4">
            <p className="text-xs leading-5 text-slate-500">
              Event budgets assume every request or operation has equal weight.
              Use a service-level indicator that represents customer experience.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-cyan-200 bg-white/90 ring-0">
        <CardHeader className="border-b border-slate-200/70 pb-4">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
            <div>
              <CardDescription className="font-mono text-[11px] tracking-[0.14em] text-cyan-700 uppercase">
                Calculated budget
              </CardDescription>
              <CardTitle className="mt-1 text-3xl tracking-[-0.03em] text-slate-950">
                {result?.allowedDowntimeHuman ?? '—'}
              </CardTitle>
              <CardDescription>
                maximum downtime across this window
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                result?.compliant
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }
            >
              {result?.compliant ? <CheckCircle2 /> : <AlertTriangle />}
              {status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-1">
          <Progress
            value={Math.min(100, Math.max(0, consumed ?? 0))}
            className="[&_[data-slot=progress-indicator]]:bg-linear-to-r [&_[data-slot=progress-indicator]]:from-cyan-500 [&_[data-slot=progress-indicator]]:to-indigo-600 [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-slate-200"
          >
            <ProgressLabel className="text-slate-700">
              Error budget consumed
            </ProgressLabel>
            <span className="ml-auto font-mono text-sm text-slate-950">
              {consumed === null || consumed === undefined
                ? '—'
                : `${consumed.toFixed(1)}%`}
            </span>
          </Progress>

          <div className="grid grid-cols-2 gap-3">
            <Metric
              icon={Gauge}
              label="Allowed bad events"
              value={
                result
                  ? Math.floor(result.allowedBadEvents).toLocaleString()
                  : '—'
              }
            />
            <Metric
              icon={Timer}
              label="Budget remaining"
              value={
                result
                  ? Math.floor(result.remainingBadEvents).toLocaleString()
                  : '—'
              }
              valueClass={
                result && result.remainingBadEvents < 0
                  ? 'text-rose-600'
                  : 'text-emerald-600'
              }
            />
            <Metric
              label="Observed availability"
              value={
                result
                  ? `${result.observedAvailabilityPercent.toFixed(5)}%`
                  : '—'
              }
            />
            <Metric
              label="Window"
              value={result ? `${result.windowDays} days` : '—'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-10 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              disabled={!result}
              onClick={() => void copyCalculation()}
            >
              <Clipboard /> Copy JSON
            </Button>
            <Button
              className="h-10 bg-cyan-600 text-white shadow-[0_8px_24px_rgb(8_145_178/16%)] hover:bg-cyan-500"
              disabled={!result}
              onClick={() =>
                downloadText(
                  'reliabilitykit-slo.json',
                  resultJson,
                  'application/json',
                )
              }
            >
              <Download /> Download
            </Button>
          </div>
          <p
            aria-live="polite"
            className="min-h-4 text-center text-xs text-cyan-700"
          >
            {feedback}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  valueClass = 'text-slate-950',
}: {
  icon?: typeof Gauge;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200/70 bg-slate-50/70 p-4">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        {Icon && <Icon className="size-3.5" />} {label}
      </p>
      <p
        className={`mt-1 break-words font-mono text-lg sm:text-xl ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}
