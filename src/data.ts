import type { UserRole } from './services/session';

type NavItem = {
  label: string;
  to: string;
  icon: 'dashboard' | 'building' | 'shield' | 'pulse' | 'wallet' | 'list' | 'alert' | 'message' | 'globe' | 'settings' | 'user';
  group?: 'primary' | 'secondary';
  requiresAuth?: boolean;
  allowedRoles?: UserRole[];
};

export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
  { label: 'Cooperative', to: '/cooperative', icon: 'building' },
  { label: 'Trust Score', to: '/cooperative/trust-score', icon: 'pulse' },
  { label: 'Risk Dashboard', to: '/risk/dashboard', icon: 'shield' },
  { label: 'Transactions', to: '/transactions', icon: 'wallet', requiresAuth: true },
  { label: 'System Status', to: '/system/status', icon: 'settings', requiresAuth: true },
  { label: 'Admin Hub', to: '/admin/cooperative', icon: 'building', allowedRoles: ['admin'] },
  { label: 'Withdrawals', to: '/admin/withdrawal', icon: 'list', allowedRoles: ['admin', 'treasurer', 'executive1', 'executive2'] },
  { label: 'Fraud Alerts', to: '/fraud/alerts', icon: 'alert', allowedRoles: ['admin', 'regulator'] },
  { label: 'Whistleblower', to: '/whistleblower', icon: 'message' },
  { label: 'Lookup', to: '/public/lookup', icon: 'globe' },
  { label: 'Onboard', to: '/onboard', icon: 'user', group: 'secondary' },
  { label: 'Login', to: '/login', icon: 'shield', group: 'secondary' },
];

export const contributionTrend: number[] = [];
export const trustHistory: number[] = [];
