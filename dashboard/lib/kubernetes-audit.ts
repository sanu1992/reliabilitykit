import { parseAllDocuments } from 'yaml';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ManifestInput = {
  name: string;
  content: string;
};

export type AuditFinding = {
  checkId: string;
  severity: Severity;
  resource: string;
  message: string;
  remediation: string;
};

export type AuditReport = {
  schemaVersion: 'reliabilitykit.io/audit/v1';
  generatedAt: string;
  filesScanned: number;
  resourcesScanned: number;
  sensitiveResourcesSkipped: number;
  score: number;
  grade: string;
  findingCounts: Record<Severity, number>;
  findings: AuditFinding[];
};

type KubeObject = Record<string, unknown>;

const WORKLOAD_KINDS = new Set([
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'Job',
  'CronJob',
  'Pod',
]);

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function isRecord(value: unknown): value is KubeObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordAt(value: unknown, key: string): KubeObject | undefined {
  if (!isRecord(value)) return undefined;
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

function scalarText(value: unknown, fallback: string) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
}

function nameOf(object: KubeObject) {
  return scalarText(recordAt(object, 'metadata')?.name, 'unnamed');
}

function namespaceOf(object: KubeObject) {
  return scalarText(recordAt(object, 'metadata')?.namespace, 'default');
}

function kindOf(object: KubeObject) {
  return scalarText(object.kind, 'Unknown');
}

function podSpecOf(object: KubeObject): KubeObject | undefined {
  const spec = recordAt(object, 'spec');
  if (!spec) return undefined;
  const kind = kindOf(object);
  if (kind === 'Pod') return spec;
  if (kind === 'CronJob') {
    return recordAt(
      recordAt(recordAt(recordAt(spec, 'jobTemplate'), 'spec'), 'template'),
      'spec',
    );
  }
  if (['Deployment', 'StatefulSet', 'DaemonSet', 'Job'].includes(kind)) {
    return recordAt(recordAt(spec, 'template'), 'spec');
  }
  return undefined;
}

function podLabelsOf(object: KubeObject) {
  const labels = recordAt(
    recordAt(recordAt(object, 'spec'), 'template'),
    'metadata',
  )?.labels;
  return isRecord(labels) ? labels : {};
}

function matchingPdbExists(workload: KubeObject, pdbs: KubeObject[]) {
  const labels = podLabelsOf(workload);
  if (Object.keys(labels).length === 0) return false;
  return pdbs.some((pdb) => {
    if (namespaceOf(pdb) !== namespaceOf(workload)) return false;
    const matchLabels = recordAt(
      recordAt(recordAt(pdb, 'spec'), 'selector'),
      'matchLabels',
    );
    return (
      !!matchLabels &&
      Object.entries(matchLabels).every(([key, value]) => labels[key] === value)
    );
  });
}

function hpaMinimum(workload: KubeObject, hpas: KubeObject[]) {
  const hpa = hpas.find((candidate) => {
    if (namespaceOf(candidate) !== namespaceOf(workload)) return false;
    const target = recordAt(recordAt(candidate, 'spec'), 'scaleTargetRef');
    return (
      target?.kind === kindOf(workload) && target?.name === nameOf(workload)
    );
  });
  const minReplicas = recordAt(hpa, 'spec')?.minReplicas;
  return typeof minReplicas === 'number' ? minReplicas : hpa ? 1 : 0;
}

function grade(score: number) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function makeRedactor(enabled: boolean) {
  const namespaces = new Map<string, string>();
  const resources = new Map<string, string>();
  return {
    resource(object: KubeObject) {
      const kind = kindOf(object);
      const namespace = namespaceOf(object);
      const name = nameOf(object);
      if (!enabled) return `${kind}/${namespace}/${name}`;
      if (!namespaces.has(namespace)) {
        namespaces.set(namespace, `namespace-${namespaces.size + 1}`);
      }
      const key = `${namespace}/${name}`;
      if (!resources.has(key))
        resources.set(key, `resource-${resources.size + 1}`);
      return `${kind}/${namespaces.get(namespace)}/${resources.get(key)}`;
    },
    container(name: string, index: number) {
      return enabled
        ? `container-${index + 1}`
        : name || `container-${index + 1}`;
    },
  };
}

function parseInputs(inputs: ManifestInput[]) {
  const objects: KubeObject[] = [];
  let sensitiveResourcesSkipped = 0;

  for (const input of inputs) {
    const documents = parseAllDocuments(input.content, {
      prettyErrors: true,
      strict: true,
      uniqueKeys: true,
    });
    for (const document of documents) {
      if (document.errors.length > 0) {
        throw new Error(`${input.name}: ${document.errors[0].message}`);
      }
      const parsed = document.toJS({ maxAliasCount: 100 }) as unknown;
      if (!isRecord(parsed)) continue;
      const expanded =
        parsed.kind === 'List' && Array.isArray(parsed.items)
          ? parsed.items.filter(isRecord)
          : [parsed];
      for (const object of expanded) {
        if (object.kind === 'Secret') {
          sensitiveResourcesSkipped += 1;
          continue;
        }
        objects.push(object);
      }
    }
  }
  return { objects, sensitiveResourcesSkipped };
}

export function auditManifests(
  inputs: ManifestInput[],
  redactNames = true,
): AuditReport {
  if (inputs.length === 0)
    throw new Error('Select at least one YAML or JSON manifest.');
  const { objects, sensitiveResourcesSkipped } = parseInputs(inputs);
  const pdbs = objects.filter(
    (object) => object.kind === 'PodDisruptionBudget',
  );
  const hpas = objects.filter(
    (object) => object.kind === 'HorizontalPodAutoscaler',
  );
  const findings: AuditFinding[] = [];
  const redactor = makeRedactor(redactNames);

  const addFinding = (
    object: KubeObject,
    checkId: string,
    severity: Severity,
    message: string,
    remediation: string,
  ) => {
    findings.push({
      checkId,
      severity,
      resource: redactor.resource(object),
      message,
      remediation,
    });
  };

  for (const object of objects) {
    const kind = kindOf(object);
    if (!WORKLOAD_KINDS.has(kind)) continue;
    const spec = recordAt(object, 'spec') ?? {};
    const podSpec = podSpecOf(object);

    if (kind === 'Pod') {
      addFinding(
        object,
        'RK-K8S-001',
        'high',
        'A bare Pod has no workload controller to recreate it after failure.',
        'Use a Deployment, StatefulSet, Job, or another appropriate controller.',
      );
    }

    if (kind === 'Deployment' || kind === 'StatefulSet') {
      const declaredReplicas =
        typeof spec.replicas === 'number' ? spec.replicas : 1;
      const effectiveReplicas = Math.max(
        declaredReplicas,
        hpaMinimum(object, hpas),
      );
      if (effectiveReplicas < 2) {
        addFinding(
          object,
          'RK-K8S-002',
          'high',
          'The workload can run with a single replica.',
          'Use at least two replicas or an HPA with minReplicas of at least two when availability requires it.',
        );
      }
      if (effectiveReplicas >= 2 && !matchingPdbExists(object, pdbs)) {
        addFinding(
          object,
          'RK-K8S-003',
          'medium',
          'No matching PodDisruptionBudget was found.',
          'Add a PodDisruptionBudget whose selector matches the workload labels.',
        );
      }
      const affinity = recordAt(podSpec, 'affinity');
      const antiAffinity = recordAt(affinity, 'podAntiAffinity');
      const topologySpread = podSpec?.topologySpreadConstraints;
      if (
        effectiveReplicas >= 2 &&
        !antiAffinity &&
        (!Array.isArray(topologySpread) || topologySpread.length === 0)
      ) {
        addFinding(
          object,
          'RK-K8S-004',
          'medium',
          'Replicas have no explicit topology spread or pod anti-affinity policy.',
          'Spread replicas across hostname or zone failure domains.',
        );
      }
    }

    if (kind === 'Deployment') {
      const strategy = recordAt(spec, 'strategy');
      if ((strategy?.type ?? 'RollingUpdate') === 'Recreate') {
        addFinding(
          object,
          'RK-K8S-005',
          'high',
          'The Deployment uses the Recreate strategy, which can cause downtime.',
          'Use RollingUpdate unless application constraints require a deliberate outage.',
        );
      }
    }

    if (kind === 'CronJob' && (spec.concurrencyPolicy ?? 'Allow') === 'Allow') {
      addFinding(
        object,
        'RK-K8S-006',
        'low',
        'The CronJob allows overlapping executions.',
        'Choose Forbid or Replace if concurrent executions are unsafe or expensive.',
      );
    }

    if (!podSpec) {
      addFinding(
        object,
        'RK-K8S-007',
        'high',
        'The workload does not contain a readable Pod specification.',
        'Validate the manifest structure and apiVersion for this workload kind.',
      );
      continue;
    }

    const containers = Array.isArray(podSpec.containers)
      ? podSpec.containers
      : [];
    if (containers.length === 0) {
      addFinding(
        object,
        'RK-K8S-008',
        'critical',
        'The Pod specification has no containers.',
        'Add at least one valid application container.',
      );
      continue;
    }

    containers.forEach((value, index) => {
      if (!isRecord(value)) return;
      const containerName = redactor.container(
        scalarText(value.name, ''),
        index,
      );
      if (!value.readinessProbe) {
        addFinding(
          object,
          'RK-K8S-009',
          'high',
          `Container '${containerName}' has no readiness probe.`,
          'Add a readiness probe that reflects whether the container can safely receive traffic or work.',
        );
      }
      if (!value.livenessProbe) {
        addFinding(
          object,
          'RK-K8S-010',
          'medium',
          `Container '${containerName}' has no liveness probe.`,
          'Add a conservative liveness probe when Kubernetes can safely recover a stuck process.',
        );
      }

      const resources = recordAt(value, 'resources');
      const requests = recordAt(resources, 'requests');
      const limits = recordAt(resources, 'limits');
      if (!requests?.cpu) {
        addFinding(
          object,
          'RK-K8S-011',
          'medium',
          `Container '${containerName}' has no CPU request.`,
          'Set a measured CPU request so scheduling and autoscaling have a reliable baseline.',
        );
      }
      if (!requests?.memory) {
        addFinding(
          object,
          'RK-K8S-012',
          'medium',
          `Container '${containerName}' has no memory request.`,
          'Set a measured memory request to reduce node pressure and scheduling risk.',
        );
      }
      if (!limits?.memory) {
        addFinding(
          object,
          'RK-K8S-013',
          'medium',
          `Container '${containerName}' has no memory limit.`,
          'Set a tested memory limit or document an equivalent external protection.',
        );
      }

      const image = scalarText(value.image, '');
      const imageWithoutDigest = image.split('@', 1)[0];
      const lastSegment = imageWithoutDigest.split('/').at(-1) ?? '';
      const mutable =
        !image ||
        (!image.includes('@') &&
          (!lastSegment.includes(':') || lastSegment.endsWith(':latest')));
      if (mutable) {
        addFinding(
          object,
          'RK-K8S-014',
          'medium',
          `Container '${containerName}' uses an unpinned or latest image reference.`,
          'Use an immutable image digest or a controlled, non-latest version tag.',
        );
      }
    });
  }

  findings.sort(
    (left, right) =>
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
      left.resource.localeCompare(right.resource) ||
      left.checkId.localeCompare(right.checkId),
  );
  const penalty = findings.reduce(
    (total, finding) => total + SEVERITY_WEIGHT[finding.severity],
    0,
  );
  const score = Math.max(0, 100 - penalty);
  const findingCounts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  findings.forEach((finding) => {
    findingCounts[finding.severity] += 1;
  });

  return {
    schemaVersion: 'reliabilitykit.io/audit/v1',
    generatedAt: new Date().toISOString(),
    filesScanned: inputs.length,
    resourcesScanned: objects.length,
    sensitiveResourcesSkipped,
    score,
    grade: grade(score),
    findingCounts,
    findings,
  };
}

export const SAMPLE_MANIFEST = `apiVersion: v1
kind: Secret
metadata:
  name: payment-credentials
  namespace: storefront
stringData:
  password: this-value-is-never-reported
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-api
  namespace: storefront
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: payment-api
  template:
    metadata:
      labels:
        app: payment-api
    spec:
      containers:
        - name: api
          image: registry.example.com/payment-api:latest
`;
