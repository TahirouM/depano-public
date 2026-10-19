import type { AddressSuggestion, BookingDetailDto, CreateBookingBody } from '@depano/schemas';
import { DRAFT_KEYS, useDraftsStore, type ScheduledDraft, type UrgentDraft } from '@/stores/drafts';
import { uploadFile } from '@/lib/upload';

/** Champs complémentaires des brouillons client (accès, médias locaux non encore envoyés). */
export interface ProblemMedia {
  photoTypes?: string[];
  voiceUri?: string | null;
  /** Motif saisi librement (« Autre problème »). */
  customReason?: boolean;
}

export type UrgentFlowDraft = UrgentDraft & ProblemMedia;
export type ScheduledFlowDraft = ScheduledDraft & ProblemMedia;

export type InlineAddress = NonNullable<CreateBookingBody['address']>;

export function suggestionToAddress(s: AddressSuggestion, extra: Partial<InlineAddress> = {}): InlineAddress {
  return { line1: s.line1, postalCode: s.postalCode, city: s.city, lat: s.lat, lng: s.lng, floor: null, doorCode: null, accessNotes: null, ...extra };
}

export function addressLabel(a: { line1?: string | null; postalCode: string; city: string } | null | undefined): string {
  if (!a) return '';
  return [a.line1, `${a.postalCode} ${a.city}`].filter(Boolean).join(', ');
}

/**
 * Téléverse les photos et le vocal du brouillon (compte requis) et renvoie les identifiants.
 * Les fichiers déjà envoyés (problemFileIds) sont conservés.
 */
export async function uploadDraftMedia(d: UrgentFlowDraft | ScheduledFlowDraft): Promise<string[]> {
  const ids = [...(d.problemFileIds ?? [])];
  if (ids.length) return ids;
  const uris = d.problemPhotoUris ?? [];
  for (let i = 0; i < uris.length; i++) {
    const up = await uploadFile({ uri: uris[i]!, contentType: d.photoTypes?.[i] ?? 'image/jpeg' }, 'problem_photo');
    ids.push(up.fileId);
  }
  if (d.voiceUri) {
    const up = await uploadFile({ uri: d.voiceUri, contentType: 'audio/m4a' }, 'problem_voice');
    ids.push(up.fileId);
  }
  return ids.slice(0, 6);
}

/** Reprend les informations d'une intervention (relance après expiration ou annulation artisan). */
export function draftFromBooking(b: BookingDetailDto): UrgentFlowDraft {
  const a = b.address;
  const address: InlineAddress | undefined =
    a.line1 && a.lat != null && a.lng != null
      ? { line1: a.line1, postalCode: a.postalCode, city: a.city, lat: a.lat, lng: a.lng, floor: a.floor, doorCode: a.doorCode, accessNotes: a.accessNotes }
      : undefined;
  return {
    domain: b.domain,
    problemReason: b.problemReason,
    problemDescription: b.problemDescription ?? undefined,
    customReason: !b.serviceName,
    address,
    addressId: undefined,
    problemFileIds: [],
    problemPhotoUris: [],
  };
}

export function prefillUrgentDraft(b: BookingDetailDto) {
  useDraftsStore.getState().reset(DRAFT_KEYS.urgent);
  useDraftsStore.getState().patch(DRAFT_KEYS.urgent, draftFromBooking(b) as Record<string, unknown>);
}

export function prefillScheduledDraft(artisanId: string, b: BookingDetailDto) {
  const { domain, problemReason, problemDescription, address } = draftFromBooking(b);
  useDraftsStore.getState().patch(DRAFT_KEYS.scheduled(artisanId), { artisanId, domain, problemReason, problemDescription, address, customReason: true, scheduledType: 'repair' });
}
