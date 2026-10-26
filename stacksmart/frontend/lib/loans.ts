import { supabase } from './supabase';
import type { AddUserLoanInput, AppEventType, Loan, UserLoanRow, UserLoanUpsert } from '@/types';

// Convert a DB row into the UI `Loan` shape.
// `interest_rate_percent` is stored as the UI percentage and maps directly to
// `Loan.interest_rate` (the optimizer divides by 100 when building its request).
export function rowToLoan(row: UserLoanRow): Loan {
  return {
    id: row.id,
    loan_type: row.loan_type,
    loan_name: row.loan_name,
    principal: Number(row.principal),
    interest_rate: Number(row.interest_rate_percent),
    minimum_payment: Number(row.minimum_payment),
    term_months: row.term_months ?? undefined,
  };
}

// Convert a UI `Loan` into an upsert payload for the `user_loans` table.
export function loanToUpsert(loan: Loan, userId: string, sortOrder: number): UserLoanUpsert {
  return {
    id: loan.id,
    user_id: userId,
    loan_type: loan.loan_type,
    loan_name: loan.loan_name.trim() || 'Untitled loan',
    principal: loan.principal,
    interest_rate_percent: loan.interest_rate,
    minimum_payment: loan.minimum_payment,
    term_months: loan.term_months ?? null,
    sort_order: sortOrder,
  };
}

// Load the signed-in user's saved loans, ordered for display.
export async function loadUserLoans(): Promise<Loan[]> {
  const { data, error } = await supabase
    .from('user_loans')
    .select('id,user_id,loan_type,loan_name,principal,interest_rate_percent,minimum_payment,term_months,sort_order,created_at,updated_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as unknown as UserLoanRow[];
  return rows.map((row) => rowToLoan(row));
}

// Replace the signed-in user's entire loan list.
// Deletes existing rows for the user, then inserts the current set.
export async function replaceUserLoans(userId: string, loans: Loan[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('user_loans')
    .delete()
    .eq('user_id', userId);

  if (deleteError) throw deleteError;

  if (loans.length === 0) return;

  const rows = loans.map((loan, index) => loanToUpsert(loan, userId, index));
  const { error: insertError } = await supabase
    .from('user_loans')
    .insert(rows);

  if (insertError) throw insertError;
}

// Add a single loan for the signed-in user by calling the `add_user_loan` RPC.
// `interest_rate` is passed through as the UI percentage (`p_interest_rate_percent`).
export async function addUserLoan(input: AddUserLoanInput): Promise<Loan> {
  const { data, error } = await supabase.rpc('add_user_loan', {
    p_loan_type: input.loan_type,
    p_loan_name: input.loan_name,
    p_principal: input.principal,
    p_interest_rate_percent: input.interest_rate,
    p_minimum_payment: input.minimum_payment,
    p_term_months: input.term_months ?? null,
    p_sort_order: input.sort_order ?? null,
  });

  if (error) throw error;
  return rowToLoan(data as UserLoanRow);
}

// Remove a single loan by id via the `remove_user_loan` RPC. Returns the
// deleted loan's id, or throws if the RPC reports an error.
export async function removeUserLoan(loanId: string): Promise<string> {
  const { data, error } = await supabase.rpc('remove_user_loan', {
    p_loan_id: loanId,
  });

  if (error) throw error;
  return data as string;
}

// Append an app event to `public.app_events` via the `log_app_event` RPC.
// Returns the new event's id; throws if the RPC reports an error.
export async function logAppEvent(
  eventType: AppEventType,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await supabase.rpc('log_app_event', {
    p_event_type: eventType,
    p_metadata: metadata,
  });

  if (error) throw error;
  return data as string;
}
