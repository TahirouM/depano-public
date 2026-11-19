/** Saisie des dates et heures du planning (masques « JJ/MM/AAAA » et « HH:MM »). */

export const maskDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
};
export const maskTime = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};
export const isoToFr = (iso: string) => iso.split('-').reverse().join('/');
export const validTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Date locale (YYYY-MM-DD) + heure → ISO avec fuseau. */
export function toIso(day: string, time: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y!, m! - 1, d!, h, mi).toISOString();
}

/** ISO → « HH:MM » en heure locale. */
export function isoToTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
