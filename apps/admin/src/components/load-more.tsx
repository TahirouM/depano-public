'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoadMore({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}) {
  if (!hasNextPage) return null;
  return (
    <div className="mt-4 flex justify-center">
      <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
        {isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden />}
        Charger plus
      </Button>
    </div>
  );
}
