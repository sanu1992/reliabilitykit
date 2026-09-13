'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Clipboard,
  Download,
  FileCheck2,
  FileText,
  RotateCcw,
  WandSparkles,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { copyText, downloadText } from '@/lib/downloads';
import {
  generatePostmortem,
  slugify,
  type PostmortemInput,
} from '@/lib/postmortem';

const example: PostmortemInput = {
  title: 'Checkout latency incident',
  incidentId: 'INC-2026-001',
  severity: 'SEV-2',
  service: 'checkout-api',
  startedAt: '2026-09-13T10:00',
  endedAt: '2026-09-13T11:30',
  summary:
    'Checkout requests experienced elevated latency during a regional dependency degradation.',
  impact:
    'Ten percent of checkout requests exceeded the latency SLO. No orders were lost.',
};

const empty: PostmortemInput = {
  title: '',
  incidentId: '',
  severity: 'SEV-2',
  service: '',
  startedAt: '',
  endedAt: '',
  summary: '',
  impact: '',
};

export function PostmortemBuilder() {
  const [input, setInput] = useState<PostmortemInput>(example);
  const [markdown, setMarkdown] = useState(() => generatePostmortem(example));
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const update = (field: keyof PostmortemInput, value: string) => {
    setInput((current) => ({ ...current, [field]: value }));
    setFeedback('');
  };

  const generate = () => {
    setError('');
    setFeedback('');
    try {
      setMarkdown(generatePostmortem(input));
      setFeedback('Draft regenerated from the incident details.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The postmortem could not be generated.',
      );
    }
  };

  const copy = async () => {
    try {
      await copyText(markdown);
      setFeedback('Markdown copied.');
    } catch (caught) {
      setFeedback(
        caught instanceof Error
          ? caught.message
          : 'Could not copy the Markdown.',
      );
    }
  };

  const reset = () => {
    setInput(empty);
    setMarkdown('');
    setError('');
    setFeedback('');
  };

  const filename = `${slugify(input.incidentId || input.title) || 'incident-postmortem'}.md`;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
      <Card className="border border-slate-200 bg-white/90 ring-0">
        <CardHeader className="border-b border-slate-200/70 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-slate-950">Incident context</CardTitle>
              <CardDescription className="mt-1">
                Capture facts first. The generated structure guides the deeper
                review.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="border-violet-200 bg-violet-50 text-violet-700"
            >
              Blameless
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Incident title" className="sm:col-span-2">
              <Input
                className="h-10 border-slate-300 bg-slate-50/70 text-slate-950"
                value={input.title}
                onChange={(event) => update('title', event.target.value)}
              />
            </Field>
            <Field label="Incident ID">
              <Input
                className="h-10 border-slate-300 bg-slate-50/70 font-mono text-slate-950"
                value={input.incidentId}
                onChange={(event) => update('incidentId', event.target.value)}
              />
            </Field>
            <Field label="Severity">
              <Select
                value={input.severity}
                onValueChange={(value) => update('severity', String(value))}
              >
                <SelectTrigger className="h-10 w-full border-slate-300 bg-slate-50/70 text-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4'].map((severity) => (
                    <SelectItem key={severity} value={severity}>
                      {severity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Affected service" className="sm:col-span-2">
              <Input
                className="h-10 border-slate-300 bg-slate-50/70 text-slate-950"
                value={input.service}
                onChange={(event) => update('service', event.target.value)}
              />
            </Field>
            <Field label="Started">
              <Input
                className="h-10 border-slate-300 bg-slate-50/70 font-mono text-slate-950 [color-scheme:light]"
                type="datetime-local"
                value={input.startedAt}
                onChange={(event) => update('startedAt', event.target.value)}
              />
            </Field>
            <Field label="Impact ended">
              <Input
                className="h-10 border-slate-300 bg-slate-50/70 font-mono text-slate-950 [color-scheme:light]"
                type="datetime-local"
                value={input.endedAt}
                onChange={(event) => update('endedAt', event.target.value)}
              />
            </Field>
            <Field label="Executive summary" className="sm:col-span-2">
              <Textarea
                className="min-h-24 border-slate-300 bg-slate-50/70 leading-6 text-slate-950"
                value={input.summary}
                onChange={(event) => update('summary', event.target.value)}
              />
            </Field>
            <Field
              label="Customer and business impact"
              className="sm:col-span-2"
            >
              <Textarea
                className="min-h-24 border-slate-300 bg-slate-50/70 leading-6 text-slate-950"
                value={input.impact}
                onChange={(event) => update('impact', event.target.value)}
              />
            </Field>
          </div>

          {error && (
            <Alert className="border-rose-200 bg-rose-50 text-rose-800">
              <AlertTriangle />
              <AlertTitle>Draft not generated</AlertTitle>
              <AlertDescription className="text-rose-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-[auto_1fr] gap-3">
            <Button
              variant="outline"
              className="h-10 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={reset}
              aria-label="Clear incident form"
            >
              <RotateCcw />
            </Button>
            <Button
              className="h-10 bg-violet-600 text-white shadow-[0_8px_24px_rgb(124_58_237/16%)] hover:bg-violet-500"
              onClick={generate}
            >
              <WandSparkles /> Generate draft
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-[640px] border border-slate-200 bg-white/90 ring-0">
        <CardHeader className="border-b border-slate-200/70 pb-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-950">
                <FileCheck2 className="size-4 text-violet-600" /> Markdown draft
              </CardTitle>
              <CardDescription className="mt-1">
                Review before sharing. Placeholder sections remain explicit.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                disabled={!markdown}
                onClick={() => void copy()}
              >
                <Clipboard /> Copy
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 text-white hover:bg-violet-500"
                disabled={!markdown}
                onClick={() =>
                  downloadText(filename, markdown, 'text/markdown')
                }
              >
                <Download /> Download
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col pt-1">
          {markdown ? (
            <pre className="max-h-[610px] min-h-[520px] overflow-auto rounded-xl border border-slate-200 bg-slate-50/85 p-5 font-mono text-xs leading-6 whitespace-pre-wrap text-slate-700 shadow-inner">
              {markdown}
            </pre>
          ) : (
            <div className="grid min-h-[520px] place-items-center text-center">
              <div className="max-w-sm">
                <FileText className="mx-auto mb-3 size-8 text-slate-600" />
                <p className="font-medium text-slate-950">No draft generated</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Complete the incident context and generate a structured
                  review.
                </p>
              </div>
            </div>
          )}
          <p
            aria-live="polite"
            className="mt-3 min-h-4 text-center text-xs text-violet-700"
          >
            {feedback}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`space-y-2 text-xs font-medium text-slate-600 ${className}`}
    >
      {label}
      {children}
    </label>
  );
}
