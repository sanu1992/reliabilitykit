"""SLO and error-budget calculations."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal
from typing import Any


@dataclass(frozen=True)
class SLOResult:
    """Calculated time-based and event-based error budgets."""

    objective_percent: float
    window_days: float
    allowed_downtime_seconds: float
    allowed_downtime_human: str
    total_events: int | None = None
    bad_events: int | None = None
    allowed_bad_events: float | None = None
    remaining_bad_events: float | None = None
    budget_consumed_percent: float | None = None
    observed_availability_percent: float | None = None
    compliant: bool | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def format_duration(seconds: Decimal) -> str:
    """Return a compact, readable duration without hiding sub-minute budgets."""

    total_seconds = max(Decimal("0"), seconds)
    days, remainder = divmod(total_seconds, Decimal(86400))
    hours, remainder = divmod(remainder, Decimal(3600))
    minutes, remainder = divmod(remainder, Decimal(60))

    parts: list[str] = []
    if days:
        parts.append(f"{int(days)}d")
    if hours:
        parts.append(f"{int(hours)}h")
    if minutes:
        parts.append(f"{int(minutes)}m")
    if remainder or not parts:
        rendered_seconds = f"{remainder.quantize(Decimal('0.01')):f}".rstrip("0").rstrip(".")
        parts.append(f"{rendered_seconds}s")
    return " ".join(parts)


def calculate_slo(
    objective_percent: float,
    window_days: float = 30,
    total_events: int | None = None,
    bad_events: int | None = None,
) -> SLOResult:
    """Calculate an SLO's time and optional event error budgets."""

    objective = Decimal(str(objective_percent))
    window = Decimal(str(window_days))

    if not Decimal("0") < objective <= Decimal("100"):
        raise ValueError("objective_percent must be greater than 0 and at most 100")
    if window <= 0:
        raise ValueError("window_days must be greater than 0")
    if (total_events is None) != (bad_events is None):
        raise ValueError("total_events and bad_events must be provided together")
    if total_events is not None and total_events <= 0:
        raise ValueError("total_events must be greater than 0")
    if bad_events is not None and bad_events < 0:
        raise ValueError("bad_events cannot be negative")
    if total_events is not None and bad_events is not None and bad_events > total_events:
        raise ValueError("bad_events cannot exceed total_events")

    error_rate = (Decimal("100") - objective) / Decimal("100")
    window_seconds = window * Decimal(86400)
    allowed_downtime = window_seconds * error_rate

    event_fields: dict[str, Any] = {}
    if total_events is not None and bad_events is not None:
        total = Decimal(total_events)
        bad = Decimal(bad_events)
        allowed_bad = total * error_rate
        remaining = allowed_bad - bad
        actual_availability = (Decimal("1") - (bad / total)) * Decimal("100")
        if allowed_bad == 0:
            consumed = Decimal("0") if bad == 0 else None
        else:
            consumed = (bad / allowed_bad) * Decimal("100")

        event_fields = {
            "total_events": total_events,
            "bad_events": bad_events,
            "allowed_bad_events": float(allowed_bad),
            "remaining_bad_events": float(remaining),
            "budget_consumed_percent": float(consumed) if consumed is not None else None,
            "observed_availability_percent": float(actual_availability),
            "compliant": bad <= allowed_bad,
        }

    return SLOResult(
        objective_percent=float(objective),
        window_days=float(window),
        allowed_downtime_seconds=float(allowed_downtime),
        allowed_downtime_human=format_duration(allowed_downtime),
        **event_fields,
    )
