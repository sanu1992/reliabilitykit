export type SloResult = {
  objectivePercent: number;
  windowDays: number;
  allowedDowntimeSeconds: number;
  allowedDowntimeHuman: string;
  totalEvents: number;
  badEvents: number;
  allowedBadEvents: number;
  remainingBadEvents: number;
  budgetConsumedPercent: number | null;
  observedAvailabilityPercent: number;
  compliant: boolean;
};

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const days = Math.floor(safeSeconds / 86_400);
  const hours = Math.floor((safeSeconds % 86_400) / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const seconds = safeSeconds % 60;
  const parts = [
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    minutes ? `${minutes}m` : '',
    seconds || (!days && !hours && !minutes)
      ? `${Number(seconds.toFixed(2))}s`
      : '',
  ];
  return parts.filter(Boolean).join(' ');
}

export function calculateSlo(
  objectivePercent: number,
  windowDays: number,
  totalEvents: number,
  badEvents: number,
): SloResult {
  if (
    !Number.isFinite(objectivePercent) ||
    objectivePercent <= 0 ||
    objectivePercent > 100
  ) {
    throw new Error('Objective must be greater than 0 and at most 100%.');
  }
  if (!Number.isFinite(windowDays) || windowDays <= 0) {
    throw new Error('Window must be greater than zero days.');
  }
  if (!Number.isFinite(totalEvents) || totalEvents <= 0) {
    throw new Error('Total events must be greater than zero.');
  }
  if (!Number.isFinite(badEvents) || badEvents < 0 || badEvents > totalEvents) {
    throw new Error('Bad events must be between zero and total events.');
  }

  const errorRate = (100 - objectivePercent) / 100;
  const allowedDowntimeSeconds = windowDays * 86_400 * errorRate;
  const allowedBadEvents = totalEvents * errorRate;
  const remainingBadEvents = allowedBadEvents - badEvents;
  const budgetConsumedPercent =
    allowedBadEvents === 0
      ? badEvents === 0
        ? 0
        : null
      : (badEvents / allowedBadEvents) * 100;

  return {
    objectivePercent,
    windowDays,
    allowedDowntimeSeconds,
    allowedDowntimeHuman: formatDuration(allowedDowntimeSeconds),
    totalEvents,
    badEvents,
    allowedBadEvents,
    remainingBadEvents,
    budgetConsumedPercent,
    observedAvailabilityPercent: (1 - badEvents / totalEvents) * 100,
    compliant: badEvents <= allowedBadEvents,
  };
}
