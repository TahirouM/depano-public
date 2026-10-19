'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, Menu, Monitor, Moon, ShieldAlert, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/states';
import { SessionProvider, backofficeRole, logout, useMeQuery } from '@/components/session';
import { canAccess, isActive, navFor } from '@/lib/nav';
import { fullName } from '@/lib/format';
import { cn } from '@/lib/utils';

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md px-2 py-1 font-semibold tracking-tight">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        D
      </span>
      <span className="whitespace-nowrap">
        DEPANO <span className="hidden font-normal text-muted-foreground sm:inline">Back-office</span>
      </span>
    </Link>
  );
}

function NavLinks({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="grid gap-1">
      {navFor(isAdmin).map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )}
          >
            <item.icon className={cn('size-4', active && 'text-primary')} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Changer le thème">
          <Sun className="dark:hidden" aria-hidden />
          <Moon className="hidden dark:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Thème</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden /> Clair
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden /> Sombre
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden /> Système
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ name, role }: { name: string; role: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto max-w-56 justify-start gap-2 px-2 py-1.5" aria-label={`Compte de ${name}`}>
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden min-w-0 text-left leading-tight sm:grid">
            <span className="truncate text-sm">{name}</span>
            <span className="text-xs text-muted-foreground">{role === 'admin' ? 'Administrateur' : 'Support'}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => logout()}>
          <LogOut aria-hidden /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const me = useMeQuery();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const role = me.data ? backofficeRole(me.data) : null;
  const isAdmin = role === 'admin';
  const allowed = role ? canAccess(pathname, isAdmin) : true;

  // Le support arrive sur la file des interventions plutôt que sur les KPI.
  useEffect(() => {
    if (role === 'support' && pathname === '/') router.replace('/interventions');
  }, [role, pathname, router]);

  if (me.isPending) {
    return (
      <div className="flex min-h-dvh">
        <div className="hidden w-64 border-r bg-sidebar p-4 lg:block">
          <Skeleton className="mb-6 h-8 w-40" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-9 w-full" />
          ))}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  if (me.isError || !me.data) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <ErrorState error={me.error} onRetry={() => me.refetch()} className="max-w-md" />
      </div>
    );
  }
  if (!role) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div role="alert" className="flex max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center">
          <ShieldAlert className="size-8 text-urgent" aria-hidden />
          <h1 className="font-medium">Accès réservé</h1>
          <p className="text-sm text-muted-foreground">Le back-office est réservé aux comptes admin et support.</p>
          <Button variant="outline" onClick={() => logout()}>
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  const name = fullName(me.data);

  return (
    <SessionProvider value={{ me: me.data, role, isAdmin }}>
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
          <Logo />
          <NavLinks isAdmin={isAdmin} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu">
                  <Menu aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-4">
                <SheetHeader className="p-0">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <SheetDescription className="sr-only">Navigation du back-office</SheetDescription>
                  <Logo />
                </SheetHeader>
                <NavLinks isAdmin={isAdmin} onNavigate={() => setMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeMenu />
              <div aria-hidden className="mx-1 h-6 w-px bg-border" />
              <UserMenu name={name} role={role} />
            </div>
          </header>
          <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 p-4 outline-none sm:p-6">
            {allowed ? (
              children
            ) : (
              <div role="alert" className="mx-auto mt-12 flex max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center">
                <ShieldAlert className="size-8 text-urgent" aria-hidden />
                <h1 className="font-medium">Section réservée aux administrateurs</h1>
                <p className="text-sm text-muted-foreground">Votre rôle support ne donne pas accès à cette page.</p>
                <Button asChild variant="outline">
                  <Link href="/interventions">Voir les interventions</Link>
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
