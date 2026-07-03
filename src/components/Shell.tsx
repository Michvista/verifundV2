import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { navItems } from '../data';
import { IconBell, IconSearch, IconUser } from './icons';

// ─── Types ────────────────────────────────────────────────────────────────────
type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

const SEED_MEMBERS = [
  { id: 'mem-01', name: 'Amina Okafor', role: 'Treasurer' },
  { id: 'mem-02', name: 'Bola Adewale', role: 'Executive 1' },
  { id: 'mem-03', name: 'Chika Nwosu', role: 'Executive 2' },
  { id: 'admin-01', name: 'Regina Ojo', role: 'Admin' },
  { id: 'reg-01', name: 'Ifeanyi Okoro', role: 'Regulator' },
];

function loadUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem('verifund_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Shell ────────────────────────────────────────────────────────────────────
export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(loadUser);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);


  function handleLogout() {
    localStorage.removeItem('verifund_token');
    localStorage.removeItem('verifund_user');
    navigate('/login');
  }

  async function handleQuickSwitch(memberId: string) {
    const { login } = await import('../services/api');
    try {
      const result = await login(memberId);
      localStorage.setItem('verifund_token', result.token);
      localStorage.setItem('verifund_user', JSON.stringify(result.member));
      setUser(result.member);
    } catch (e) {
      console.error('Quick switch failed', e);
    }
  }

  const shouldUseDarkFrame =
    location.pathname.startsWith('/cooperative/') &&
    !location.pathname.endsWith('/trust-score') &&
    !location.pathname.endsWith('/dashboard');

  return (
    <div className={shouldUseDarkFrame ? 'app-frame app-frame--dark' : 'app-frame'}>
      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <div className="brand__wordmark">VeriFund</div>
          <div className="brand__sub">Digital Passbook</div>
        </div>

        {/* User info in sidebar */}
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user__name">
              {user.firstName} {user.lastName}
            </div>
            <div className="sidebar-user__role">{user.role}</div>
          </div>
        )}

        <nav className="sidebar__nav">
          {navItems.slice(0, 6).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
              onClick={() => setMobileNavOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__nav sidebar__nav--lower">
          {navItems.slice(6).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
              onClick={() => setMobileNavOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <button className="button button--ghost sidebar__cta" onClick={handleLogout}>
          Sign Out
        </button>
      </aside>

      {/* Main shell */}
      <div className="shell">
        <header className="topbar">
          {/* Mobile hamburger */}
          <button
            className="hamburger-btn"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label="Open navigation"
          >
            <span /><span /><span />
          </button>

          <div>
            <div className="eyebrow">Nomba-backed cooperative treasury</div>
            <h1 className="page-title">{pageTitle(location.pathname)}</h1>
          </div>

          <div className="topbar__actions">
            {/* Quick role switcher */}
            <div className="role-switcher">
              <select
                className="role-select"
                value={user?.id || ''}
                onChange={(e) => handleQuickSwitch(e.target.value)}
                title="Switch active member role"
              >
                <option value="" disabled>Switch role…</option>
                {SEED_MEMBERS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <label className="search">
              <IconSearch />
              <input placeholder="Search passbook…" aria-label="Search passbook" />
            </label>
            <button className="icon-button" aria-label="Notifications"><IconBell /></button>
            <button
              className="icon-button"
              aria-label="User menu"
              onClick={() => navigate('/login')}
            >
              <IconUser />
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pageTitle(pathname: string) {
  if (pathname.startsWith('/admin/withdrawal')) return 'Multi-Signature Disbursement';
  if (pathname.startsWith('/admin/cooperative')) return 'Dashboard';
  if (pathname.startsWith('/cooperative/') && pathname.endsWith('/trust-score')) return 'Public Trust Registry';
  if (pathname.startsWith('/cooperative/')) return 'Cooperative Overview';
  if (pathname.startsWith('/fraud/alerts')) return 'Fraud Alerts';
  if (pathname.startsWith('/whistleblower')) return 'Anonymous Report';
  if (pathname.startsWith('/public/lookup')) return 'Registration Lookup';
  return 'Dashboard';
}
