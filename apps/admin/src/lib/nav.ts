import {
  BarChart3,
  FileDown,
  Gavel,
  HardHat,
  LayoutGrid,
  MapPinned,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Réservé aux admins (plan §6 : le support lit les interventions, rembourse et arbitre). */
  adminOnly?: boolean;
}

export const NAV: NavItem[] = [
  { href: '/', label: 'Tableau de bord', icon: BarChart3, adminOnly: true },
  { href: '/artisans', label: 'Artisans', icon: HardHat, adminOnly: true },
  { href: '/interventions', label: 'Interventions', icon: Wrench },
  { href: '/litiges', label: 'Litiges', icon: Gavel },
  { href: '/catalogue', label: 'Catalogue', icon: LayoutGrid, adminOnly: true },
  { href: '/zones', label: 'Zones & commissions', icon: MapPinned, adminOnly: true },
  { href: '/utilisateurs', label: 'Utilisateurs', icon: Users },
  { href: '/exports', label: 'Exports', icon: FileDown, adminOnly: true },
];

export function navFor(isAdmin: boolean) {
  return NAV.filter((n) => isAdmin || !n.adminOnly);
}

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Section autorisée pour le rôle ? (sert à bloquer l'accès direct par URL). */
export function canAccess(pathname: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const item = [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) => isActive(pathname, n.href));
  return !item?.adminOnly;
}
