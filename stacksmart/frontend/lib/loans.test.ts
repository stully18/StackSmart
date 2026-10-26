import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  rowToLoan,
  loanToUpsert,
  loadUserLoans,
  replaceUserLoans,
  addUserLoan,
  removeUserLoan,
  logAppEvent,
} from '@/lib/loans';
import type { AddUserLoanInput, AppEventType, Loan, UserLoanRow } from '@/types';

// ---- Mock the real Supabase client (chainable + thenable) -------------------
// `vi.hoisted` lets us build the mock object before `vi.mock` is hoisted, while
// still keeping the factory free of external references.
const { supabaseMock, setResult, setResults, resetCalls, calls } = vi.hoisted(() => {
  const state = {
    select: [] as any[],
    order: [] as any[],
    delete: [] as any[],
    eq: [] as any[],
    insert: [] as any[],
    rpc: [] as any[],
  };
  let resultQueue: { data?: any; error?: any }[] = [{ data: [], error: null }];

  const builder: any = {
    select: (...args: any[]) => {
      state.select.push(args);
      return builder;
    },
    order: (...args: any[]) => {
      state.order.push(args);
      return builder;
    },
    delete: (...args: any[]) => {
      state.delete.push(args);
      return builder;
    },
    eq: (...args: any[]) => {
      state.eq.push(args);
      return builder;
    },
    insert: (...args: any[]) => {
      state.insert.push(args);
      return builder;
    },
    rpc: (...args: any[]) => {
      state.rpc.push(args);
      return builder;
    },
    // Make the builder awaitable so `await supabase.from(...).select()...` works.
    then: (resolve: (v: any) => void) => resolve(resultQueue.shift() ?? { data: [], error: null }),
  };

  const from = (...args: any[]) => builder;

  // Top-level `rpc` (used by `addUserLoan`/`removeUserLoan`/`logAppEvent`).
  // Records every call so tests can assert on function name + params.
  const rpc = (...args: any[]) => {
    state.rpc.push(args);
    return builder;
  };

  return {
    supabaseMock: { from, rpc },
    setResult: (r: { data?: any; error?: any }) => {
      resultQueue = [r];
    },
    setResults: (r: { data?: any; error?: any }[]) => {
      resultQueue = [...r];
    },
    resetCalls: () => {
      state.select = [];
      state.order = [];
      state.delete = [];
      state.eq = [];
      state.insert = [];
      state.rpc = [];
      resultQueue = [{ data: [], error: null }];
    },
    calls: state,
  };
});

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

beforeEach(() => {
  resetCalls();
});

// ---- Helpers ---------------------------------------------------------------
const makeLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan-1',
  loan_type: 'student_loan',
  loan_name: '  My Loan  ',
  principal: 10000,
  interest_rate: 7.5,
  minimum_payment: 200,
  term_months: 120,
  ...overrides,
});

// ===========================================================================
describe('rowToLoan', () => {
  it('maps a DB row to the UI Loan shape, keeping interest_rate_percent as a UI percent', () => {
    const row: UserLoanRow = {
      id: 'row-1',
      user_id: 'u1',
      loan_type: 'car_loan',
      loan_name: 'Car',
      principal: 5000,
      interest_rate_percent: 9.25,
      minimum_payment: 150,
      term_months: 48,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const loan = rowToLoan(row);
    expect(loan).toEqual({
      id: 'row-1',
      loan_type: 'car_loan',
      loan_name: 'Car',
      principal: 5000,
      interest_rate: 9.25, // preserved as a percentage, not divided
      minimum_payment: 150,
      term_months: 48,
    });
  });

  it('maps a null term_months to undefined', () => {
    const row: UserLoanRow = {
      id: 'row-2',
      user_id: 'u1',
      loan_type: 'credit_card',
      loan_name: 'CC',
      principal: 2000,
      interest_rate_percent: 18,
      minimum_payment: 50,
      term_months: null,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(rowToLoan(row).term_months).toBeUndefined();
  });
});

describe('loanToUpsert', () => {
  it('maps a UI Loan into an upsert payload with sort_order and trimmed name', () => {
    const upsert = loanToUpsert(makeLoan({ loan_name: '  Trim Me  ' }), 'user-9', 3);
    expect(upsert).toEqual({
      id: 'loan-1',
      user_id: 'user-9',
      loan_type: 'student_loan',
      loan_name: 'Trim Me',
      principal: 10000,
      interest_rate_percent: 7.5, // stays as UI percent
      minimum_payment: 200,
      term_months: 120,
      sort_order: 3,
    });
  });

  it('falls back to "Untitled loan" when the name is blank', () => {
    const upsert = loanToUpsert(makeLoan({ loan_name: '   ' }), 'user-9', 0);
    expect(upsert.loan_name).toBe('Untitled loan');
  });

  it('maps term_months undefined to null', () => {
    const upsert = loanToUpsert(makeLoan({ term_months: undefined }), 'user-9', 0);
    expect(upsert.term_months).toBeNull();
  });

  it('maps term_months null to null', () => {
    const upsert = loanToUpsert(makeLoan({ term_months: null as any }), 'user-9', 0);
    expect(upsert.term_months).toBeNull();
  });
});

describe('replaceUserLoans (saving additions)', () => {
  it('deletes existing rows for the user, then inserts mapped rows with sort_order', async () => {
    const loans = [
      makeLoan({ id: 'a', interest_rate: 5, term_months: undefined }),
      makeLoan({ id: 'b', interest_rate: 6.5, term_months: 60 }),
    ];

    await replaceUserLoans('user-42', loans);

    // 1. Delete is scoped to the user.
    expect(calls.delete).toHaveLength(1);
    expect(calls.eq).toEqual([['user_id', 'user-42']]);

    // 2. Insert is called once with both mapped rows.
    expect(calls.insert).toHaveLength(1);
    const inserted = calls.insert[0][0] as any[];
    expect(inserted).toHaveLength(2);

    // 3. sort_order assigned by array index.
    expect(inserted[0].sort_order).toBe(0);
    expect(inserted[1].sort_order).toBe(1);

    // 4. interest_rate stays as UI percent; term_months undefined -> null.
    expect(inserted[0].interest_rate_percent).toBe(5);
    expect(inserted[0].term_months).toBeNull();
    expect(inserted[1].interest_rate_percent).toBe(6.5);
    expect(inserted[1].term_months).toBe(60);
  });

  it('does not insert anything when the loan list is empty (deletion only)', async () => {
    await replaceUserLoans('user-42', []);

    expect(calls.delete).toHaveLength(1);
    expect(calls.eq).toEqual([['user_id', 'user-42']]);
    expect(calls.insert).toHaveLength(0);
  });

  it('throws when the delete fails', async () => {
    setResult({ error: new Error('delete failed') });
    await expect(replaceUserLoans('user-42', [makeLoan()])).rejects.toThrow('delete failed');
    // Insert must not be attempted after a delete error.
    expect(calls.insert).toHaveLength(0);
  });

  it('throws when the insert fails', async () => {
    setResults([
      { data: null, error: null },
      { data: null, error: new Error('insert failed') },
    ]);

    await expect(replaceUserLoans('user-42', [makeLoan()])).rejects.toThrow('insert failed');
    expect(calls.delete).toHaveLength(1);
    expect(calls.insert).toHaveLength(1);
  });
});

describe('loadUserLoans (reading back the saved list)', () => {
  it('selects, orders by sort_order then created_at, and maps rows to Loans', async () => {
    const rows: UserLoanRow[] = [
      {
        id: 'r1',
        user_id: 'u1',
        loan_type: 'student_loan',
        loan_name: 'Loan A',
        principal: 1000,
        interest_rate_percent: 4.5,
        minimum_payment: 25,
        term_months: null,
        sort_order: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'r2',
        user_id: 'u1',
        loan_type: 'car_loan',
        loan_name: 'Loan B',
        principal: 2000,
        interest_rate_percent: 3.2,
        minimum_payment: 60,
        term_months: 36,
        sort_order: 0,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ];
    setResult({ data: rows, error: null });

    const loans = await loadUserLoans();

    expect(calls.select).toHaveLength(1);
    expect(calls.order).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: true }],
    ]);

    expect(loans).toHaveLength(2);
    expect(loans[0]).toMatchObject({ id: 'r1', interest_rate: 4.5, term_months: undefined });
    expect(loans[1]).toMatchObject({ id: 'r2', interest_rate: 3.2, term_months: 36 });
  });

  it('throws when the select fails', async () => {
    setResult({ data: null, error: new Error('select failed') });
    await expect(loadUserLoans()).rejects.toThrow('select failed');
  });
});

// ===========================================================================
describe('addUserLoan (RPC add_user_loan)', () => {
  it('calls rpc("add_user_loan", ...) with the UI percent rate, not a decimal', async () => {
    const row: UserLoanRow = {
      id: 'new-1',
      user_id: 'u1',
      loan_type: 'student_loan',
      loan_name: 'My Loan',
      principal: 12000,
      interest_rate_percent: 7.5,
      minimum_payment: 150,
      term_months: 120,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setResult({ data: row, error: null });

    const input: AddUserLoanInput = {
      loan_type: 'student_loan',
      loan_name: 'My Loan',
      principal: 12000,
      interest_rate: 7.5, // UI percent
      minimum_payment: 150,
      term_months: 120,
    };

    const loan = await addUserLoan(input);

    // The RPC is invoked exactly once with the right function name.
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0][0]).toBe('add_user_loan');

    // interest_rate is forwarded verbatim as p_interest_rate_percent.
    expect(calls.rpc[0][1]).toMatchObject({
      p_loan_type: 'student_loan',
      p_loan_name: 'My Loan',
      p_principal: 12000,
      p_interest_rate_percent: 7.5,
      p_minimum_payment: 150,
      p_term_months: 120,
      p_sort_order: null,
    });

    // The returned DB row is mapped back to the UI Loan shape.
    expect(loan).toEqual({
      id: 'new-1',
      loan_type: 'student_loan',
      loan_name: 'My Loan',
      principal: 12000,
      interest_rate: 7.5,
      minimum_payment: 150,
      term_months: 120,
    });
  });

  it('maps a returned row with null term_months toLoan.term_months undefined', async () => {
    setResult({
      data: {
        id: 'new-2',
        user_id: 'u1',
        loan_type: 'credit_card',
        loan_name: 'CC',
        principal: 2000,
        interest_rate_percent: 18,
        minimum_payment: 50,
        term_months: null,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const loan = await addUserLoan({
      loan_type: 'credit_card',
      loan_name: 'CC',
      principal: 2000,
      interest_rate: 18,
      minimum_payment: 50,
      term_months: undefined,
    });

    expect(calls.rpc[0][1]).toMatchObject({ p_term_months: null });
    expect(loan.term_months).toBeUndefined();
  });

  it('forwards an explicit sort_order when provided', async () => {
    setResult({ data: { id: 'new-3', user_id: 'u1', loan_type: 'car_loan', loan_name: 'Car', principal: 5000, interest_rate_percent: 9.25, minimum_payment: 150, term_months: 48, sort_order: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, error: null });

    await addUserLoan({
      loan_type: 'car_loan',
      loan_name: 'Car',
      principal: 5000,
      interest_rate: 9.25,
      minimum_payment: 150,
      term_months: 48,
      sort_order: 5,
    });

    expect(calls.rpc[0][1]).toMatchObject({ p_sort_order: 5 });
  });

  it('throws when the RPC returns an error', async () => {
    setResult({ data: null, error: new Error('Not authenticated') });
    await expect(
      addUserLoan({
        loan_type: 'other',
        loan_name: 'X',
        principal: 1,
        interest_rate: 1,
        minimum_payment: 1,
      }),
    ).rejects.toThrow('Not authenticated');
  });
});

// ===========================================================================
describe('removeUserLoan (RPC remove_user_loan)', () => {
  it('calls rpc("remove_user_loan", { p_loan_id }) and returns the deleted id', async () => {
    setResult({ data: 'loan-abc', error: null });

    const result = await removeUserLoan('loan-abc');

    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0][0]).toBe('remove_user_loan');
    expect(calls.rpc[0][1]).toEqual({ p_loan_id: 'loan-abc' });
    expect(result).toBe('loan-abc');
  });

  it('throws when the RPC returns an error', async () => {
    setResult({ data: null, error: new Error('Loan not found') });
    await expect(removeUserLoan('missing')).rejects.toThrow('Loan not found');
  });
});

// ===========================================================================
describe('logAppEvent (RPC log_app_event)', () => {
  it('calls rpc("log_app_event", { p_event_type, p_metadata }) and returns the event id', async () => {
    setResult({ data: 'evt-1', error: null });

    const result = await logAppEvent('loan_added', { loan_id: 'l1', source: 'test' });

    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0][0]).toBe('log_app_event');
    expect(calls.rpc[0][1]).toEqual({
      p_event_type: 'loan_added',
      p_metadata: { loan_id: 'l1', source: 'test' },
    });
    expect(result).toBe('evt-1');
  });

  it('defaults metadata to an empty object when omitted', async () => {
    setResult({ data: 'evt-2', error: null });

    await logAppEvent('sign_in');

    expect(calls.rpc[0][1]).toEqual({
      p_event_type: 'sign_in',
      p_metadata: {},
    });
  });

  it('throws when the RPC returns an error', async () => {
    setResult({ data: null, error: new Error('event log failed') });
    await expect(logAppEvent('feedback_submitted')).rejects.toThrow('event log failed');
  });
});
