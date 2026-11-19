import type { ArtisanServiceDto } from '@depano/schemas';
import { parseEuros } from '../format';

export type ServiceKind = ArtisanServiceDto['kind'];

export const SERVICE_KIND_LABELS: Record<ServiceKind, string> = {
  maintenance: 'Entretien',
  repair: 'Dépannage',
  both: 'Les deux',
};

/** « 45 min », « 1 h », « 1 h 30 ». */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Saisie du formulaire « Ajouter un motif » (texte brut des champs). */
export interface CustomServiceDraft {
  name: string;
  kind: ServiceKind;
  /** Prix TTC en euros (« 120 », « 89,90 »). */
  price: string;
  /** Durée en minutes. */
  duration: string;
}

/** Bornes de `CustomServiceBody` (packages/schemas). */
const NAME = { min: 3, max: 120 };
const DURATION = { min: 15, max: 600 };
const PRICE = { min: 100, max: 1_000_000 };

/** Erreurs de validation (en français) par champ ; objet vide si le motif peut être envoyé. */
export function customServiceErrors(
  d: CustomServiceDraft,
  existingNames: string[] = [],
): Partial<Record<'name' | 'price' | 'duration', string>> {
  const e: Partial<Record<'name' | 'price' | 'duration', string>> = {};
  const name = d.name.trim();
  const norm = (s: string) =>
    s.trim().toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!name) e.name = 'Indiquez le nom du motif.';
  else if (name.length < NAME.min) e.name = `Le nom doit faire au moins ${NAME.min} caractères.`;
  else if (name.length > NAME.max) e.name = `${NAME.max} caractères maximum.`;
  else if (existingNames.some((n) => norm(n) === norm(name)))
    e.name = 'Ce motif existe déjà dans ce métier.';

  const cents = d.price.trim() ? parseEuros(d.price) : null;
  if (!d.price.trim()) e.price = 'Indiquez un prix.';
  else if (cents == null) e.price = 'Prix invalide (ex. 120 ou 89,90).';
  else if (cents < PRICE.min) e.price = 'Le prix doit être d’au moins 1 €.';
  else if (cents > PRICE.max) e.price = 'Le prix ne peut pas dépasser 10 000 €.';

  const minutes = Number(d.duration.trim());
  if (!d.duration.trim() || !Number.isInteger(minutes))
    e.duration = 'Indiquez une durée en minutes.';
  else if (minutes < DURATION.min || minutes > DURATION.max)
    e.duration = `Entre ${DURATION.min} et ${DURATION.max} minutes.`;
  return e;
}
