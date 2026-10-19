import { toIcs, type AddToCalendarResult, type CalendarEventInput } from './types';

export type { CalendarEventInput, AddToCalendarResult } from './types';

/** Web : téléchargement d'un fichier .ics (ouvert par l'agenda du système). */
export async function addToCalendar(e: CalendarEventInput): Promise<AddToCalendarResult> {
  if (typeof document === 'undefined') return 'unavailable';
  const blob = new Blob([toIcs(e)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rendez-vous-depano.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
