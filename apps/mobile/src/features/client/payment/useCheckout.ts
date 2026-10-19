import type { BookingDetailDto, CreateBookingBody, PaymentSessionDto } from '@depano/schemas';
import { haptic } from '@depano/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { usePaymentSheet } from './usePaymentSheet';

export type CheckoutPhase = 'idle' | 'uploading' | 'creating' | 'paying' | 'confirming';

export function sessionToSheet(p: PaymentSessionDto) {
  return {
    provider: p.provider,
    clientSecret: p.clientSecret,
    setup: !p.paymentIntentId && !!p.setupIntentId,
    customerId: p.customerId,
    ephemeralKey: p.ephemeralKey,
    amountCents: p.amountCents,
  };
}

/**
 * Réservation + empreinte bancaire : création → PaymentSheet (ou simulation) → confirmation.
 * Si le paiement est refusé/annulé, la réservation créée est réutilisée au nouvel essai.
 */
export function useCheckout() {
  const qc = useQueryClient();
  const sheet = usePaymentSheet();
  const [phase, setPhase] = useState<CheckoutPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ bookingId: string; payment: PaymentSessionDto } | null>(null);

  const run = useCallback(
    async (build: () => Promise<CreateBookingBody>): Promise<BookingDetailDto | null> => {
      setError(null);
      try {
        if (!pending.current) {
          setPhase('uploading');
          const body = await build();
          setPhase('creating');
          const res = await api.bookings.create(body);
          pending.current = { bookingId: res.booking.id, payment: res.payment };
        }
        const { bookingId, payment } = pending.current;
        setPhase('paying');
        const r = await sheet.present(sessionToSheet(payment));
        if (r.status === 'cancelled') {
          setPhase('idle');
          return null;
        }
        if (r.status === 'failed') {
          setError(r.message);
          setPhase('idle');
          haptic('error');
          return null;
        }
        setPhase('confirming');
        const booking = await api.bookings.confirmPayment(bookingId);
        pending.current = null;
        qc.setQueryData(qk.bookings.detail(booking.id), booking);
        void qc.invalidateQueries({ queryKey: qk.bookings.lists });
        void qc.invalidateQueries({ queryKey: qk.badges });
        void qc.invalidateQueries({ queryKey: qk.addresses });
        haptic('success');
        setPhase('idle');
        return booking;
      } catch (e) {
        setError(errorMessage(e, 'Le paiement a échoué. Réessayez.'));
        setPhase('idle');
        haptic('error');
        return null;
      }
    },
    [qc, sheet],
  );

  /** Abandon : la réservation en attente de paiement est annulée (gratuit). */
  const abandon = useCallback(async () => {
    const p = pending.current;
    pending.current = null;
    if (p) await api.bookings.cancel(p.bookingId, { reason: 'Paiement abandonné' }).catch(() => undefined);
  }, []);

  return { run, phase, busy: phase !== 'idle', error, clearError: () => setError(null), abandon };
}

export const PHASE_LABEL: Record<CheckoutPhase, string> = {
  idle: '',
  uploading: 'Envoi des photos…',
  creating: 'Création de la demande…',
  paying: 'Validation du paiement…',
  confirming: 'Confirmation…',
};
