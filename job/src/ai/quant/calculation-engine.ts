import {
  assertSafeDomainId,
  freezeCalculation,
  type CanonicalSalesContext,
  type QuantitativeObservation,
  type VerifiedCalculation,
} from '../context/canonical-sales-context.ts';
import type { CalculationErrorCode, CalculationRequest } from './quantity-types.ts';

export type CalculationResult =
  | { ok: true; calculation: VerifiedCalculation }
  | { ok: false; code: CalculationErrorCode };

function fail(code: CalculationErrorCode): CalculationResult {
  return { ok: false, code };
}

function observation(context: CanonicalSalesContext, id: string): QuantitativeObservation | null {
  return context.quantitativeObservations.find((item) => item.id === id) ?? null;
}

function requireConfirmed(
  context: CanonicalSalesContext,
  ids: readonly string[],
): { ok: true; observations: QuantitativeObservation[] } | { ok: false; result: CalculationResult } {
  const observations: QuantitativeObservation[] = [];
  for (const id of ids) {
    const item = observation(context, id);
    if (item === null) return { ok: false, result: fail('OBSERVATION_NOT_FOUND') };
    if (item.status !== 'confirmed') return { ok: false, result: fail('UNVERIFIED_INPUT') };
    if (!Number.isFinite(item.value) || item.value < 0) return { ok: false, result: fail('INVALID_VALUE') };
    observations.push(item);
  }
  return { ok: true, observations };
}

function normalized(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000_000_000) / 1_000_000_000_000;
}

function calculation(
  request: CalculationRequest,
  context: CanonicalSalesContext,
  inputObservationIds: readonly string[],
  kind: VerifiedCalculation['kind'],
  expression: string,
  resultValue: number,
  resultUnit: string,
): CalculationResult {
  if (!Number.isFinite(resultValue)) return fail('INVALID_VALUE');
  return {
    ok: true,
    calculation: freezeCalculation({
      id: request.id,
      kind,
      inputObservationIds,
      expression,
      resultValue: normalized(resultValue),
      resultUnit,
      computedBy: 'application',
      basedOnRevision: context.revision,
      status: 'valid',
      invalidatedAtRevision: null,
    }),
  };
}

export function computeVerifiedCalculation(
  context: CanonicalSalesContext,
  request: CalculationRequest,
): CalculationResult {
  if (request.baseRevision !== context.revision) return fail('STALE_REVISION');
  try {
    assertSafeDomainId('calculation.id', request.id);
  } catch {
    return fail('INVALID_REQUEST');
  }

  switch (request.kind) {
    case 'monthly_capacity': {
      const ids = [
        request.peopleObservationId,
        request.minutesPerPersonPerDayObservationId,
        request.workingDaysPerMonthObservationId,
      ] as const;
      const input = requireConfirmed(context, ids);
      if (!input.ok) return input.result;
      const [people, minutesPerDay, workingDays] = input.observations;
      if (people!.unit !== 'person' || people!.period !== null
        || minutesPerDay!.unit !== 'minute' || minutesPerDay!.period !== 'day'
        || workingDays!.unit !== 'day' || workingDays!.period !== 'month') {
        return fail('UNIT_MISMATCH');
      }
      const result = (people!.value * minutesPerDay!.value * workingDays!.value) / 60;
      return calculation(
        request,
        context,
        ids,
        'capacity',
        `${people!.value} person * ${minutesPerDay!.value} minute/person/day * ${workingDays!.value} day/month / 60`,
        result,
        'hour/month',
      );
    }

    case 'monthly_workload': {
      const ids = [request.occurrencesPerMonthObservationId, request.minutesPerOccurrenceObservationId] as const;
      const input = requireConfirmed(context, ids);
      if (!input.ok) return input.result;
      const [occurrences, minutes] = input.observations;
      if (occurrences!.unit !== 'occurrence' || occurrences!.period !== 'month'
        || minutes!.unit !== 'minute' || minutes!.period !== 'event') {
        return fail('UNIT_MISMATCH');
      }
      return calculation(
        request,
        context,
        ids,
        'capacity',
        `${occurrences!.value} occurrence/month * ${minutes!.value} minute/occurrence / 60`,
        (occurrences!.value * minutes!.value) / 60,
        'hour/month',
      );
    }

    case 'monthly_cost': {
      const ids = [request.monthlyHoursObservationId, request.hourlyCostObservationId] as const;
      const input = requireConfirmed(context, ids);
      if (!input.ok) return input.result;
      const [hours, hourlyCost] = input.observations;
      if (hours!.unit !== 'hour' || hours!.period !== 'month'
        || hourlyCost!.unit !== 'currency' || hourlyCost!.period !== 'hour') {
        return fail('UNIT_MISMATCH');
      }
      return calculation(
        request,
        context,
        ids,
        'time_cost',
        `${hours!.value} hour/month * ${hourlyCost!.value} currency/hour`,
        hours!.value * hourlyCost!.value,
        'currency/month',
      );
    }

    case 'rework_volume': {
      const ids = [request.volumeObservationId, request.reworkRateObservationId] as const;
      const input = requireConfirmed(context, ids);
      if (!input.ok) return input.result;
      const [volume, rate] = input.observations;
      if (!['occurrence', 'client', 'document', 'entry'].includes(volume!.unit)
        || rate!.unit !== 'percent' || rate!.period !== null) {
        return fail('UNIT_MISMATCH');
      }
      if (rate!.value > 100) return fail('INVALID_VALUE');
      return calculation(
        request,
        context,
        ids,
        'rework',
        `${volume!.value} ${volume!.unit}/${volume!.period ?? 'event'} * ${rate!.value}%`,
        volume!.value * (rate!.value / 100),
        `${volume!.unit}/${volume!.period ?? 'event'}`,
      );
    }
  }
}
