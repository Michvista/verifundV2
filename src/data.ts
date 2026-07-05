import type { UserRole } from './services/session';

type NavItem = {
  label: string;
  to: string;
  requiresAuth?: boolean;
  allowedRoles?: UserRole[];
};

export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Onboard', to: '/onboard' },
  { label: 'Login', to: '/login' },
  { label: 'Cooperative', to: '/cooperative' },
  { label: 'Trust Score', to: '/cooperative/trust-score' },
  { label: 'Risk Dashboard', to: '/risk/dashboard' },
  { label: 'Transactions', to: '/transactions', requiresAuth: true },
  { label: 'System Status', to: '/system/status', requiresAuth: true },
  { label: 'Admin Hub', to: '/admin/cooperative', allowedRoles: ['admin'] },
  { label: 'Withdrawals', to: '/admin/withdrawal', allowedRoles: ['admin', 'treasurer', 'executive1', 'executive2'] },
  { label: 'Fraud Alerts', to: '/fraud/alerts', allowedRoles: ['admin', 'regulator'] },
  { label: 'Whistleblower', to: '/whistleblower' },
  { label: 'Lookup', to: '/public/lookup' },
];

export const contributionTrend: number[] = [];
export const trustHistory: number[] = [];
