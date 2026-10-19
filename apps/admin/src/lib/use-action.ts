'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api';

/** Mutation avec toasts et invalidation des requêtes concernées. */
export function useAction<TVars, TData>(opts: {
  fn: (vars: TVars) => Promise<TData>;
  success: string | ((d: TData) => string);
  invalidate?: QueryKey[];
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: opts.fn,
    onSuccess: async (d) => {
      toast.success(typeof opts.success === 'function' ? opts.success(d) : opts.success);
      await Promise.all((opts.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
    },
    onError: (e) => {
      toast.error(errorMessage(e));
    },
  });
}
