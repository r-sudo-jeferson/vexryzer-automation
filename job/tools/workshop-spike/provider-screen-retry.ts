import { classifyProviderFailure } from './provider-evidence.ts';

export const PROVIDER_SCREEN_CAPACITY_RETRY_LIMIT = 1;

export function shouldRetryProviderScreenStatus(status: number, retriesUsed: number): boolean {
  if (!Number.isInteger(status) || !Number.isInteger(retriesUsed) || retriesUsed < 0) return false;
  return retriesUsed < PROVIDER_SCREEN_CAPACITY_RETRY_LIMIT
    && classifyProviderFailure(status) === 'CAPACITY';
}
