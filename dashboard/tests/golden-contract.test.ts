import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { auditManifests } from '../lib/kubernetes-audit.ts';
import { generatePostmortem } from '../lib/postmortem.ts';
import { calculateSlo } from '../lib/slo.ts';

type GoldenContract = {
  contract_version: number;
  audit_cases: Array<{
    name: string;
    input_path: string;
    redact_names: boolean;
    expected: {
      resources_scanned: number;
      sensitive_resources_skipped: number;
      score: number;
      grade: string;
      finding_counts: Record<string, number>;
      check_ids: string[];
    };
  }>;
  slo_cases: Array<{
    name: string;
    input: {
      objective_percent: number;
      window_days: number;
      total_events: number;
      bad_events: number;
    };
    expected: Record<string, string | number | boolean | null>;
  }>;
  postmortem_cases: Array<{
    name: string;
    input: {
      title: string;
      incident_id: string;
      severity: string;
      service: string;
      started_at: string;
      ended_at: string;
      summary: string;
      impact: string;
    };
    expected: {
      duration: string;
      started_utc: string;
      ended_utc: string;
      required_sections: string[];
    };
  }>;
};

const rootUrl = new URL('../../', import.meta.url);
const contract = JSON.parse(
  readFileSync(new URL('tests/golden/cases.json', rootUrl), 'utf8'),
) as GoldenContract;

test('golden contract version is supported', () => {
  assert.equal(contract.contract_version, 1);
});

for (const testCase of contract.audit_cases) {
  test(`audit parity: ${testCase.name}`, () => {
    const content = readFileSync(new URL(testCase.input_path, rootUrl), 'utf8');
    const report = auditManifests(
      [{ name: testCase.input_path, content }],
      testCase.redact_names,
    );
    assert.deepEqual(
      {
        resources_scanned: report.resourcesScanned,
        sensitive_resources_skipped: report.sensitiveResourcesSkipped,
        score: report.score,
        grade: report.grade,
        finding_counts: report.findingCounts,
        check_ids: report.findings.map((finding) => finding.checkId),
      },
      testCase.expected,
    );
  });
}

for (const testCase of contract.slo_cases) {
  test(`SLO parity: ${testCase.name}`, () => {
    const input = testCase.input;
    const result = calculateSlo(
      input.objective_percent,
      input.window_days,
      input.total_events,
      input.bad_events,
    );
    const actual: Record<string, string | number | boolean | null> = {
      allowed_downtime_seconds: result.allowedDowntimeSeconds,
      allowed_downtime_human: result.allowedDowntimeHuman,
      allowed_bad_events: result.allowedBadEvents,
      remaining_bad_events: result.remainingBadEvents,
      budget_consumed_percent: result.budgetConsumedPercent,
      observed_availability_percent: result.observedAvailabilityPercent,
      compliant: result.compliant,
    };
    for (const [key, expected] of Object.entries(testCase.expected)) {
      const value = actual[key];
      if (typeof expected === 'number') {
        assert.ok(
          typeof value === 'number' && Math.abs(value - expected) < 1e-9,
          `${key}: expected ${expected}, received ${String(value)}`,
        );
      } else {
        assert.equal(value, expected, key);
      }
    }
  });
}

for (const testCase of contract.postmortem_cases) {
  test(`postmortem parity: ${testCase.name}`, () => {
    const input = testCase.input;
    const report = generatePostmortem({
      title: input.title,
      incidentId: input.incident_id,
      severity: input.severity,
      service: input.service,
      startedAt: input.started_at,
      endedAt: input.ended_at,
      summary: input.summary,
      impact: input.impact,
    });
    assert.match(
      report,
      new RegExp(`\\| Duration \\| ${testCase.expected.duration} \\|`),
    );
    assert.ok(report.includes(testCase.expected.started_utc));
    assert.ok(report.includes(testCase.expected.ended_utc));
    for (const section of testCase.expected.required_sections) {
      assert.ok(report.includes(section), section);
    }
  });
}
