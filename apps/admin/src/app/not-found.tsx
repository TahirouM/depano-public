import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="grid gap-3">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="text-2xl font-semibold">Page introuvable</h1>
        <Button asChild variant="outline">
          <Link href="/">Retour au tableau de bord</Link>
        </Button>
      </div>
    </div>
  );
}
