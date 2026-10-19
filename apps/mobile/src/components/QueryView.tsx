import { EmptyState, ErrorState, SkeletonList, type EmptyStateProps } from '@depano/ui';
import type { UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { errorMessage, isNetworkError } from '@/lib/api';
import { useIsOnline } from '@/lib/online';

type AnyQuery<T> = Pick<UseQueryResult<T> | UseInfiniteQueryResult<T>, 'data' | 'error' | 'isError' | 'isPending' | 'fetchStatus' | 'refetch'>;

export interface QueryViewProps<T> {
  query: AnyQuery<T>;
  children: (data: T) => ReactNode;
  /** Squelette de chargement (défaut : 4 cartes). */
  loading?: ReactNode;
  /** État vide : prédicat + contenu. */
  isEmpty?: (data: T) => boolean;
  empty?: EmptyStateProps | ReactNode;
}

/**
 * États systématiques d'un écran : chargement (skeleton), erreur (message humain + Réessayer),
 * hors ligne sans cache, vide (illustration + CTA). Le cache persisté s'affiche hors ligne.
 */
export function QueryView<T>({ query, children, loading, isEmpty, empty }: QueryViewProps<T>) {
  const online = useIsOnline();
  if (query.data !== undefined) {
    if (isEmpty?.(query.data)) {
      if (empty && typeof empty === 'object' && 'title' in (empty as object)) return <EmptyState fill {...(empty as EmptyStateProps)} />;
      return <>{empty ?? <EmptyState fill title="Rien à afficher pour l'instant" />}</>;
    }
    return <>{children(query.data)}</>;
  }
  if (query.isError) {
    return (
      <ErrorState
        offline={isNetworkError(query.error) || !online}
        message={isNetworkError(query.error) ? undefined : errorMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.fetchStatus === 'paused' || (!online && query.isPending)) {
    return <ErrorState offline onRetry={() => void query.refetch()} />;
  }
  return <>{loading ?? <SkeletonList />}</>;
}
