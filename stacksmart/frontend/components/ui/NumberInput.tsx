'use client';

import React, { forwardRef, useId, useRef, useState, type InputHTMLAttributes } from 'react';

export interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
  stepperLabel?: string;
}

/** Keeps the browser's number validation and keyboard behavior, with themed steppers. */
const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { wrapperClassName = '', className = '', stepperLabel, id, disabled, readOnly, ...props }, forwardedRef,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(props.defaultValue ?? '');
  const label = stepperLabel ?? props['aria-label'] ?? props.name ?? 'value';
  const currentValue = props.value ?? uncontrolledValue;
  const numericValue = currentValue === '' ? NaN : Number(currentValue);
  const blocked = Boolean(disabled || readOnly);
  const atMinimum = props.min !== undefined && Number.isFinite(numericValue) && numericValue <= Number(props.min);
  const atMaximum = props.max !== undefined && Number.isFinite(numericValue) && numericValue >= Number(props.max);

  function adjust(direction: number) {
    const input = inputRef.current;
    // :disabled also respects a disabled parent fieldset.
    if (!input || input.matches(':disabled') || input.readOnly) return;
    const probe = input.cloneNode() as HTMLInputElement;
    probe.value = input.value;
    try {
      // With no step grid, preserve arbitrary decimals while moving by one.
      if (probe.step === 'any') {
        let next = Number((Number(probe.value || '0') + direction).toPrecision(15));
        if (probe.min !== '') next = Math.max(Number(probe.min), next);
        if (probe.max !== '') next = Math.min(Number(probe.max), next);
        if (!Number.isFinite(next)) return;
        probe.value = String(next);
      } else {
        direction > 0 ? probe.stepUp() : probe.stepDown();
      }
    } catch {
      return;
    }
    if (probe.value === input.value) return;
    // Use the native setter so React observes the input event for controlled fields.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, probe.value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  return (
    <div className={`number-input ${wrapperClassName}`}>
      <input {...props} id={inputId} type="number" disabled={disabled} readOnly={readOnly}
        className={className}
        onChange={event => { setUncontrolledValue(event.target.value); props.onChange?.(event); }}
        ref={element => {
          inputRef.current = element;
          if (typeof forwardedRef === 'function') forwardedRef(element);
          else if (forwardedRef) forwardedRef.current = element;
        }} />
      <div className="number-input__steppers">
        <button type="button" aria-label={`Decrease ${label}`} aria-controls={inputId}
          disabled={blocked || atMinimum} onClick={() => adjust(-1)}><span aria-hidden="true">−</span></button>
        <button type="button" aria-label={`Increase ${label}`} aria-controls={inputId}
          disabled={blocked || atMaximum} onClick={() => adjust(1)}><span aria-hidden="true">+</span></button>
      </div>
    </div>
  );
});

export default NumberInput;
