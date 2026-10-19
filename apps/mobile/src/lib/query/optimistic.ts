import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Helper d'Optimistic UI : met à jour le cache tout de suite, annule en cas d'erreur,
 * puis resynchronise avec le serveur.
 *
 * ```ts
 * useMutation({
 *   mutationFn: (id: string) => api.auth.revokeSession(id),
 *   ...optimistic<SessionDto[], string>(queryClient, {
 *     queryKey: () => qk.sessions,
 *     update: (old, id) => old?.filter((s) => s.id !== id),
 *   }),
 * });
 * ```
 */
export function optimistic<TData, TVars, TResult = unknown>(
  qc: QueryClient,
  opts: {
    queryKey: (vars: TVars) => QueryKey;
    update: (old: TData | undefined, vars: TVars) => TData | undefined;
    /** Clés à invalider après coup (en plus de queryKey). */
    invalidate?: (vars: TVars) => QueryKey[];
    onError?: (err: unknown, vars: TVars) => void;
  },
) {
  return {
    onMutate: async (vars: TVars) => {
      const key = opts.queryKey(vars);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TData>(key);
      qc.setQueryData<TData>(key, (old) => opts.update(old, vars));
      return { previous, key };
    },
    onError: (err: unknown, vars: TVars, ctx: { previous: TData | undefined; key: QueryKey } | undefined) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.previous);
      opts.onError?.(err, vars);
    },
    onSettled: (_data: TResult | undefined, _err: unknown, vars: TVars) => {
      void qc.invalidateQueries({ queryKey: opts.queryKey(vars) });
      for (const k of opts.invalidate?.(vars) ?? []) void qc.invalidateQueries({ queryKey: k });
    },
  };
}
