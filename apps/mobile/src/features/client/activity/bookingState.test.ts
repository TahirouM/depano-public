import type { BookingDetailDto, BookingSummaryDto } from '@depano/schemas';
import { describe, expect, it } from 'vitest';
import { awaitingPrice, requestDeadline, chatOpenFor, doneAt, finalAmountCents, formatDoneAt, isHistoryItem, kindDomainLabel, proposalOf } from './bookingState';

const s = (over: Partial<BookingSummaryDto>): BookingSummaryDto =>
  ({ id: 'b', kind: 'scheduled', status: 'accepted', domain: 'plomberie', priceOnRequest: false, artisanAccepted: true, rescheduledFromId: null, counterpart: null, ...over }) as BookingSummaryDto;

describe('propositions et messagerie', () => {
  it('prix proposé : demande « Autre » chiffrée en attente de paiement', () => {
    expect(proposalOf(s({ status: 'pending_payment', priceOnRequest: true, artisanAccepted: true }))).toBe('price');
    expect(proposalOf(s({ status: 'pending_payment', priceOnRequest: true, artisanAccepted: false }))).toBeNull();
    expect(proposalOf(s({ status: 'requested', priceOnRequest: true, artisanAccepted: false }))).toBeNull();
  });
  it('report proposé par l’artisan', () => {
    expect(proposalOf(s({ status: 'pending_payment', rescheduledFromId: 'old' }))).toBe('reschedule');
    expect(proposalOf(s({ status: 'accepted', rescheduledFromId: 'old' }))).toBeNull();
  });
  it('messagerie fermée tant que l’artisan n’a pas accepté', () => {
    expect(chatOpenFor(s({ status: 'requested', artisanAccepted: false }))).toBe(false);
    expect(chatOpenFor(s({ status: 'pending_payment', artisanAccepted: false }))).toBe(false);
    expect(chatOpenFor(s({ status: 'pending_payment', artisanAccepted: true }))).toBe(true);
    expect(chatOpenFor(s({ status: 'accepted' }))).toBe(true);
    expect(chatOpenFor(s({ kind: 'urgent', status: 'searching', artisanAccepted: false }))).toBe(false);
  });
  it('prix sur devis tant que l’artisan n’a pas chiffré', () => {
    expect(awaitingPrice(s({ status: 'requested', priceOnRequest: true, artisanAccepted: false }))).toBe(true);
    expect(awaitingPrice(s({ status: 'pending_payment', priceOnRequest: true, artisanAccepted: true }))).toBe(false);
  });
});

describe('échéance de la demande', () => {
  it('détail fourni par l’API, sinon 24 h ou heure du RDV', () => {
    expect(requestDeadline({ createdAt: '2026-10-19T10:00:00.000Z', scheduledAt: null, requestExpiresAt: '2026-10-19T12:00:00.000Z' })).toBe('2026-10-19T12:00:00.000Z');
    expect(requestDeadline({ createdAt: '2026-10-19T10:00:00.000Z', scheduledAt: '2026-10-25T10:00:00.000Z' })).toBe('2026-10-20T10:00:00.000Z');
    expect(requestDeadline({ createdAt: '2026-10-19T10:00:00.000Z', scheduledAt: '2026-10-19T18:00:00.000Z' })).toBe('2026-10-19T18:00:00.000Z');
  });
});

describe('listes', () => {
  it('historique : terminées et annulations après prise en charge', () => {
    const artisan = { id: 'x', name: 'Gérard', avatarUrl: null };
    expect(isHistoryItem(s({ status: 'closed' }))).toBe(true);
    expect(isHistoryItem(s({ status: 'cancelled_by_client', counterpart: artisan }))).toBe(true);
    expect(isHistoryItem(s({ status: 'cancelled_by_client', counterpart: null }))).toBe(false);
    expect(isHistoryItem(s({ status: 'expired' }))).toBe(false);
  });
  it('libellés', () => {
    expect(kindDomainLabel(s({ kind: 'urgent' }))).toBe('Urgence Plomberie');
    expect(kindDomainLabel(s({ domain: 'electricite' }))).toBe('Électricité');
  });
});

describe('intervention réalisée', () => {
  it('« Fait le 15 février 2026 à 14h45 » à l’heure de Paris', () => {
    expect(formatDoneAt('2026-02-15T13:45:00Z')).toBe('15 février 2026 à 14h45');
  });
  it('date de clôture et montant final', () => {
    const d = {
      status: 'closed',
      scheduledAt: '2026-02-15T13:00:00Z',
      createdAt: '2026-02-10T09:00:00Z',
      events: [{ toStatus: 'accepted', createdAt: '2026-02-10T09:05:00Z' }, { toStatus: 'closed', createdAt: '2026-02-15T13:45:00Z' }],
      capturedCents: null,
      quote: { status: 'accepted', totalCents: 21000 },
      totalCents: 15000,
      cancellationFeeCents: 0,
    } as unknown as BookingDetailDto;
    expect(doneAt(d)).toBe('2026-02-15T13:45:00Z');
    expect(finalAmountCents(d)).toBe(21000);
    expect(finalAmountCents({ ...d, capturedCents: 20500 })).toBe(20500);
    expect(finalAmountCents({ ...d, status: 'cancelled_by_client', cancellationFeeCents: 4000 })).toBe(4000);
  });
});
