/** Textes et petites règles de l'accueil (purs, testés). */

/** « 1 résultat », « 10 résultats », « 10+ résultats » (page suivante disponible). */
export function resultsLabel(count: number, hasMore: boolean): string {
  if (hasMore) return `${count}+ résultats`;
  return `${count} résultat${count > 1 ? 's' : ''}`;
}

/** Invitation à partager sa position : seulement en repli (Marseille par défaut) et jamais après un refus. */
export function shouldSuggestLocation(o: { source: 'place' | 'gps' | 'address' | 'fallback' }, alreadyAsked: boolean): boolean {
  return o.source === 'fallback' && !alreadyAsked;
}
