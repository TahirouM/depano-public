import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import type { AddToCalendarResult, CalendarEventInput } from './types';

export type { CalendarEventInput, AddToCalendarResult } from './types';

/** Natif : formulaire système de création d'événement (aucune permission large demandée). */
export async function addToCalendar(e: CalendarEventInput): Promise<AddToCalendarResult> {
  try {
    const r = await createEventInCalendarAsync({
      title: e.title,
      startDate: e.start,
      endDate: e.end,
      location: e.location,
      notes: e.notes,
      alarms: [{ relativeOffset: -60 }],
    });
    return r.action === 'saved' || r.action === 'done' ? 'saved' : 'cancelled';
  } catch {
    return 'unavailable';
  }
}
