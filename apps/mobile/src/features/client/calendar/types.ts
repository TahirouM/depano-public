export interface CalendarEventInput {
  title: string;
  start: Date;
  end: Date;
  location?: string;
  notes?: string;
}

export type AddToCalendarResult = 'saved' | 'cancelled' | 'unavailable';

/** Fichier iCalendar (.ics) minimal : repli web et export universel. */
export function toIcs(e: CalendarEventInput): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DEPANO//FR',
    'BEGIN:VEVENT',
    `UID:${fmt(e.start)}-${Math.random().toString(36).slice(2)}@depano.fr`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(e.start)}`,
    `DTEND:${fmt(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    e.location ? `LOCATION:${esc(e.location)}` : null,
    e.notes ? `DESCRIPTION:${esc(e.notes)}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(e.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}
