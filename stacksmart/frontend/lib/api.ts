import { OptimizationRequest, OptimizationResult } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is not set');
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
    const error = await response.json();
    throw new Error(error.detail || 'Failed to optimize financial path');
  }

  return response.json();
}
