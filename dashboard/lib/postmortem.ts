export type PostmortemInput = {
  title: string;
  incidentId: string;
  severity: string;
  service: string;
  startedAt: string;
  endedAt: string;
  summary: string;
  impact: string;
};

function tableValue(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function parseDate(value: string, label: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date and time.`);
  }
  return parsed;
}

function formatElapsed(startedAt: Date, endedAt: Date) {
  const milliseconds = endedAt.getTime() - startedAt.getTime();
  if (milliseconds < 0) {
    throw new Error('End time cannot be earlier than start time.');
  }
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours ? `${hours}h` : '',
    minutes ? `${minutes}m` : '',
    seconds || (!hours && !minutes) ? `${seconds}s` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function generatePostmortem(input: PostmortemInput) {
  for (const [label, value] of Object.entries(input)) {
    if (!value.trim()) {
      throw new Error(`${label} is required.`);
    }
  }

  const startedAt = parseDate(input.startedAt, 'Start time');
  const endedAt = parseDate(input.endedAt, 'End time');
  const started = startedAt.toISOString().replace('.000Z', 'Z');
  const ended = endedAt.toISOString().replace('.000Z', 'Z');
  const duration = formatElapsed(startedAt, endedAt);

  return `# ${input.title}

> This document is blameless. It focuses on system conditions, safeguards, and learning rather than individual fault.

## Incident metadata

| Field | Value |
|---|---|
| Incident ID | ${tableValue(input.incidentId)} |
| Severity | ${tableValue(input.severity)} |
| Service | ${tableValue(input.service)} |
| Status | Draft |
| Started (UTC) | ${started} |
| Ended (UTC) | ${ended} |
| Duration | ${duration} |

## Executive summary

${input.summary}

## Customer and business impact

${input.impact}

## Detection

- How was the incident first detected?
- Which signal or alert fired?
- How could detection be made earlier or more precise?

## Timeline

| Time (UTC) | Event |
|---|---|
| ${started} | Incident began. |
| TODO | Detection and initial triage. |
| TODO | Mitigation started. |
| ${ended} | Customer impact ended. |

## Response and recovery

- What actions limited the impact?
- What restored the service?
- Which actions were manual, delayed, or risky?

## Contributing factors

- Technical factors:
- Process factors:
- Detection or observability gaps:
- Conditions that increased the blast radius:

## Five whys

1. Why did the customer-visible impact occur?
2. Why was that condition possible?
3. Why did safeguards not prevent it?
4. Why was it not detected or mitigated sooner?
5. What systemic improvement will reduce recurrence?

## What went well

- TODO

## What did not go well

- TODO

## Where we got lucky

- TODO

## Corrective actions

| Priority | Action | Owner | Due date | Verification | Status |
|---|---|---|---|---|---|
| P0 | TODO | TODO | YYYY-MM-DD | Test or measurable signal | Open |
| P1 | TODO | TODO | YYYY-MM-DD | Test or measurable signal | Open |

## SLO and error-budget impact

- SLO affected:
- Bad events or downtime:
- Error budget consumed:
- Policy consequence:

## Follow-up review

- Review date:
- Reviewers:
- Evidence that corrective actions worked:
`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
