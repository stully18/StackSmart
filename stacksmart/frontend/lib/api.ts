import { OptimizationRequest, OptimizationResult } from '@/types';

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
if (!configuredApiBaseUrl) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is not set');
}

const API_BASE_URL = configuredApiBaseUrl;

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function getApiErrorMessage(
  response: Response,
  fallback = 'Something went wrong. Please try again.'
): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string') return data.detail;
    if (typeof data?.message === 'string') return data.message;
  } catch {
    // Some platform errors return plain text or an empty body.
  }

  if (response.status >= 500) {
    return 'The StackSmart API is having trouble right now. Please try again in a few minutes.';
  }

  if (response.status === 404) {
    return 'That StackSmart API route was not found. Please refresh and try again.';
  }

  return fallback;
}

export async function optimizeFinancialPath(
  request: OptimizationRequest
): Promise<OptimizationResult> {
  const response = await fetch(`${API_BASE_URL}/api/optimize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, 'Failed to optimize financial path'));
  }

  return response.json();
}
