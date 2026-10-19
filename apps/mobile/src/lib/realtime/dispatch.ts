import type { BookingDetailDto } from '@depano/schemas';

export type DispatchProgress = NonNullable<BookingDetailDto['dispatch']>;

/**
 * Progression du dispatch : monotone (vague puis nombre d'artisans contactés). On garde toujours la plus avancée
 * entre le détail serveur (refetch) et le dernier événement `booking.dispatch`, quel que soit l'ordre d'arrivée :
 * un refetch parti avant l'événement ne peut plus écraser le compteur.
 */
export function mergeDispatch(
  a: DispatchProgress | null | undefined,
  b: DispatchProgress | null | undefined,
): DispatchProgress | null {
  if (!a) return b ?? null;
  if (!b) return a;
  if (a.wave !== b.wave) return a.wave > b.wave ? a : b;
  return a.contacted >= b.contacted ? a : b;
}
