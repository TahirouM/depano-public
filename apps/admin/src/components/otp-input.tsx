'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** Champ OTP à N cases : saisie, retour arrière, flèches et collage pris en charge. */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  invalid,
  labelId,
  onComplete,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  labelId?: string;
  onComplete?: (v: string) => void;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  // Après une erreur (champ vidé puis réactivé), on replace le focus sur la 1re case.
  useEffect(() => {
    if (!disabled && value === '') refs.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function set(next: string, focusIndex?: number) {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (focusIndex !== undefined) refs.current[Math.min(focusIndex, length - 1)]?.focus();
    if (clean.length === length) onComplete?.(clean);
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="\d*"
          maxLength={length}
          aria-label={`Chiffre ${i + 1} sur ${length}`}
          aria-invalid={invalid || undefined}
          className={cn(
            'h-12 w-11 rounded-lg border border-input bg-background text-center text-lg font-semibold tabular-nums shadow-xs outline-none transition-[box-shadow,border-color]',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
            invalid && 'border-urgent',
          )}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) return;
            if (v.length > 1) {
              // Collage ou autocomplétion SMS
              set(value.slice(0, i) + v, i + v.length);
              return;
            }
            const arr = digits.slice();
            arr[i] = v;
            set(arr.join(''), i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              // On tronque à partir de la case effacée : la valeur reste contiguë.
              if (digits[i]) {
                onChange(value.slice(0, i));
              } else if (i > 0) {
                onChange(value.slice(0, i - 1));
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
