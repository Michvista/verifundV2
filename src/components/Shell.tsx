import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { navItems } from '../data';
import { IconBell, IconSearch, IconUser } from './icons';

type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

function loadUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem('verifund_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadCooperativeId() {
  return localStorage.getItem('verifund_cooperative_id') || '';
}

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(loadUser);
  const [cooperativeId, setCooperativeId] = useState(loadCooperativeId);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setCooperativeId(loadCooperativeId());
    setUser(loadUser());
  }, [location.pathname]);

  function handleLogout() {
    localStorage.removeItem('verifund_token');
    localStorage.removeItem('verifund_user');
    navigate('/login');
  }

  const shouldUseDarkFrame =
    location.pathname.startsWith('/cooperative') &&
    !location.pathname.endsWith('/trust-score');

  return (
    <div className={shouldUseDarkFrame ? 'app-frame app-frame--dark' : 'app-frame'}>
      {mobileNavOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMobileNavOpen(false)} />
      )}

      <aside className={`sidebar ${mobileNavOpen ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <div className="brand__wordmark">VeriFund</div>
          <div className="brand__sub">Digital Treasury</div>
        </div>

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user__name">
              {user.firstName} {user.lastName}
            </div>
            <div className="sidebar-user__role">{user.role}</div>
          </div>
        )}

        <div className="sidebar__context">
          <span>Active Cooperative</span>
          <strong>{cooperativeId || 'Not set'}</strong>
          <button
            className="button button--ghost button--full"
            onClick={() => navigate('/admin/cooperative')}
          >
            {cooperativeId ? 'Change cooperative' : 'Create cooperative'}
          </button>
        </div>

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

      <div className="shell">
        <header className="topbar">
          <button
            className="hamburger-btn"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label="Open navigation"
          >
            <span />
            <span />
            <span />
          </button>

          <div>
            <div className="eyebrow">Nomba-backed cooperative treasury</div>
            <h1 className="page-title">{pageTitle(location.pathname)}</h1>
          </div>

          <div className="topbar__actions">
            <div className="topbar__chip">
              <span>Cooperative</span>
              <strong>{cooperativeId || 'Unset'}</strong>
            </div>

            <label className="search">
              <IconSearch />
              <input placeholder="Search ledger..." aria-label="Search passbook" />
            </label>
            <button className="icon-button" aria-label="Notifications">
              <IconBell />
            </button>
            <button className="icon-button" aria-label="User menu" onClick={() => navigate('/login')}>
              <IconUser />
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet context={{ cooperativeId, setCooperativeId, setUser }} />
        </main>
      </div>
    </div>
  );
}

function pageTitle(pathname: string) {
  if (pathname.startsWith('/admin/withdrawal')) return 'Multi-Signature Disbursement';
  if (pathname.startsWith('/admin/cooperative')) return 'Cooperative Setup';
  if (pathname.startsWith('/cooperative') && pathname.endsWith('/trust-score')) return 'Public Trust Registry';
  if (pathname.startsWith('/cooperative')) return 'Cooperative Overview';
  if (pathname.startsWith('/fraud/alerts')) return 'Fraud Alerts';
  if (pathname.startsWith('/whistleblower')) return 'Anonymous Report';
  if (pathname.startsWith('/public/lookup')) return 'Registration Lookup';
  return 'Dashboard';
}
