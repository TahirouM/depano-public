'use client';

import { ExternalLink, FileText } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function looksLikePdf(url: string) {
  try {
    const u = new URL(url, 'http://x');
    return /\.pdf$/i.test(u.pathname) || /application%2Fpdf|application\/pdf/i.test(u.search);
  } catch {
    return /\.pdf/i.test(url);
  }
}

/**
 * Aperçu d'un fichier privé servi par URL signée : image en ligne, PDF (ou
 * format non affichable) en lien vers un nouvel onglet.
 */
export function FilePreview({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || looksLikePdf(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border bg-muted text-sm font-medium text-primary underline-offset-4 hover:underline',
          className,
        )}
      >
        <FileText className="size-8" aria-hidden />
        <span className="inline-flex items-center gap-1">
          Ouvrir le document <ExternalLink className="size-3" aria-hidden />
        </span>
        <span className="sr-only">({alt}, nouvel onglet)</span>
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn('block overflow-hidden rounded-lg border bg-muted', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- URL signée externe, pas d'optimisation */}
      <img src={url} alt={alt} loading="lazy" className="aspect-[4/3] w-full object-cover" onError={() => setFailed(true)} />
    </a>
  );
}

export function PhotoGrid({ urls, label }: { urls: string[]; label: string }) {
  if (urls.length === 0) return <p className="text-sm text-muted-foreground">Aucune photo.</p>;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((u, i) => (
        <li key={u}>
          <FilePreview url={u} alt={`${label} ${i + 1}`} />
        </li>
      ))}
    </ul>
  );
}
