export interface CalculationRequestBase {
  id: string;
  baseRevision: number;
}

export type CalculationRequest =
  | (CalculationRequestBase & {
      kind: 'monthly_capacity';
      peopleObservationId: string;
      minutesPerPersonPerDayObservationId: string;
      workingDaysPerMonthObservationId: string;
    })
  | (CalculationRequestBase & {
      kind: 'monthly_workload';
      occurrencesPerMonthObservationId: string;
      minutesPerOccurrenceObservationId: string;
    })
  | (CalculationRequestBase & {
      kind: 'monthly_cost';
      monthlyHoursObservationId: string;
      hourlyCostObservationId: string;
    })
  | (CalculationRequestBase & {
      kind: 'rework_volume';
      volumeObservationId: string;
      reworkRateObservationId: string;
    });

export type CalculationErrorCode =
  | 'STALE_REVISION'
  | 'INVALID_REQUEST'
  | 'OBSERVATION_NOT_FOUND'
  | 'UNVERIFIED_INPUT'
  | 'UNIT_MISMATCH'
  | 'INVALID_VALUE';
