export type InvestmentRisk = 'conservative' | 'moderate' | 'aggressive';

export function investmentInputs(amount: string, risk: InvestmentRisk | '') {
  const monthlyAmount = Number(amount);
  if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0.01 || monthlyAmount > 1e9 || !['conservative', 'moderate', 'aggressive'].includes(risk)) {
    throw new Error('Enter a monthly amount and choose a risk level.');
  }
  return { monthly_investment_amount: monthlyAmount, risk_tolerance: risk as InvestmentRisk };
}
