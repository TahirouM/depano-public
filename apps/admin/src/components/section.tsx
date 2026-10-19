import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function Section({
  title,
  actions,
  children,
  className,
  id,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Card className={cn('gap-4', className)} aria-labelledby={id ? `${id}-title` : undefined} role={id ? 'region' : undefined}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle id={id ? `${id}-title` : undefined} className="text-base">
          {title}
        </CardTitle>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
