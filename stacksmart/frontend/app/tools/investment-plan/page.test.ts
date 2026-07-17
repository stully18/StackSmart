import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('InvestmentPlanPage auto-generation behavior', () => {
  const source = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');

  it('does not auto-generate a plan when the page mounts', () => {
    expect(source).not.toContain('autoGenerate');
    expect(source).not.toContain('Auto-generate plan on first load');

    const mountEffects = Array.from(
      source.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n\s*\}, \[[^\]]*\]\);/g),
      match => match[1]
    );

    expect(mountEffects.some(effectBody => effectBody.includes('handleSubmit('))).toBe(false);
    expect(mountEffects.some(effectBody => effectBody.includes('/api/plan/generate'))).toBe(false);
  });
});
