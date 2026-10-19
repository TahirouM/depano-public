import type { BookingDetailDto, BookingStatus, ReportBody } from '@depano/schemas';
import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { uploadFile } from '@/lib/upload';

/**
 * Mutations artisan rejouables après redémarrage (file hors ligne persistée) :
 * changement de statut et compte rendu. Les callbacks vivent dans setMutationDefaults,
 * pas dans les composants (qui n'existent plus après un kill de l'app).
 */
export const artisanMk = {
  transition: ['artisan', 'transition'] as const,
  report: ['artisan', 'report'] as const,
} as const;

export interface TransitionVars {
  bookingId: string;
  to: BookingStatus;
  lat?: number;
  lng?: number;
  note?: string;
}

/** Photo du compte rendu : déjà téléversée (fileId) ou encore locale (hors ligne). */
export interface ReportPhoto {
  uri: string;
  contentType: string;
  fileId?: string;
}

export interface ReportVars extends Omit<
  ReportBody,
  'beforeFileIds' | 'afterFileIds' | 'voiceFileId' | 'followUpNeeded' | 'travelOnly'
> {
  bookingId: string;
  followUpNeeded: boolean;
  travelOnly: boolean;
  before: ReportPhoto[];
  after: ReportPhoto[];
  voice?: ReportPhoto | null;
}

function afterBookingChange(qc: QueryClient, b: BookingDetailDto) {
  qc.setQueryData(qk.bookings.detail(b.id), b);
  void qc.invalidateQueries({ queryKey: qk.bookings.lists });
  void qc.invalidateQueries({ queryKey: qk.artisan.dashboard });
  void qc.invalidateQueries({ queryKey: qk.badges });
}

async function ensureUploaded(
  p: ReportPhoto,
  purpose: 'report_before' | 'report_after' | 'problem_voice',
): Promise<string> {
  if (p.fileId) return p.fileId;
  const up = await uploadFile({ uri: p.uri, contentType: p.contentType }, purpose);
  return up.fileId;
}

export function registerArtisanMutationDefaults(qc: QueryClient) {
  qc.setMutationDefaults(artisanMk.transition, {
    mutationFn: (v: TransitionVars) =>
      api.bookings.transition(v.bookingId, { to: v.to, lat: v.lat, lng: v.lng, note: v.note }),
    // Optimistic : le statut change tout de suite, rollback si le serveur refuse.
    onMutate: async (v: TransitionVars) => {
      const key = qk.bookings.detail(v.bookingId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BookingDetailDto>(key);
      if (previous)
        qc.setQueryData<BookingDetailDto>(key, {
          ...previous,
          status: v.to,
          allowedTransitions: [],
        });
      return { previous };
    },
    onError: (_e: unknown, v: TransitionVars, ctx: { previous?: BookingDetailDto } | undefined) => {
      if (ctx?.previous) qc.setQueryData(qk.bookings.detail(v.bookingId), ctx.previous);
    },
    onSuccess: (b: unknown) => afterBookingChange(qc, b as BookingDetailDto),
    onSettled: (_d: unknown, _e: unknown, v: TransitionVars) => {
      void qc.invalidateQueries({ queryKey: qk.bookings.detail(v.bookingId) });
    },
  });

  qc.setMutationDefaults(artisanMk.report, {
    mutationFn: async (v: ReportVars): Promise<BookingDetailDto> => {
      const beforeFileIds = await Promise.all(
        v.before.map((p) => ensureUploaded(p, 'report_before')),
      );
      const afterFileIds = await Promise.all(v.after.map((p) => ensureUploaded(p, 'report_after')));
      const voiceFileId = v.voice ? await ensureUploaded(v.voice, 'problem_voice') : undefined;
      return api.bookings.submitReport(v.bookingId, {
        feasible: v.feasible,
        materials: v.materials || undefined,
        notes: v.notes || undefined,
        followUpNeeded: v.followUpNeeded,
        travelOnly: v.travelOnly,
        beforeFileIds,
        afterFileIds,
        voiceFileId,
      });
    },
    onSuccess: (b: unknown) => afterBookingChange(qc, b as BookingDetailDto),
  });
}
