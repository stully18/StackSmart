import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import NumberInput from './NumberInput';

describe('NumberInput semantics', () => {
  it('preserves native validation and accessible descriptions', () => {
    const html = renderToStaticMarkup(<NumberInput id="budget" name="budget" value="0.25" onChange={() => {}}
      min="0.25" max="10" step="0.25" required aria-describedby="budget-help" stepperLabel="monthly budget" />);
    expect(html).toContain('type="number"');
    expect(html).toContain('min="0.25"');
    expect(html).toContain('max="10"');
    expect(html).toContain('step="0.25"');
    expect(html).toContain('aria-describedby="budget-help"');
    expect(html).toContain('aria-label="Decrease monthly budget" aria-controls="budget" disabled');
    expect(html).toContain('aria-label="Increase monthly budget" aria-controls="budget"');
    expect(html.match(/type="button"/g)).toHaveLength(2);
  });

  it('does not offer editing controls for read-only fields', () => {
    const html = renderToStaticMarkup(<NumberInput value="5" readOnly />);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain('readonly=""');
  });

  it('supports uncontrolled defaults and their initial boundary', () => {
    const html = renderToStaticMarkup(<NumberInput defaultValue="10" max="10" />);
    expect(html).toContain('value="10"');
    expect(html).toMatch(/aria-label="Increase value"[^>]*disabled/);
    expect(html).not.toMatch(/aria-label="Decrease value"[^>]*disabled/);
  });
});
