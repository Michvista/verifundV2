import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { navItems } from '../data';
import { getMyCooperatives, type CooperativeAccessResponse } from '../services/api';
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
  const [draftCooperativeId, setDraftCooperativeId] = useState(loadCooperativeId);
  const [cooperatives, setCooperatives] = useState<CooperativeAccessResponse['cooperatives']>([]);
  const [coopNotice, setCoopNotice] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sysStatus, setSysStatus] = useState<{
    connected: boolean;
    nombaMode?: string;
    databaseMode?: string;
  }>({ connected: false });

  useEffect(() => {
    setCooperativeId(loadCooperativeId());
    setDraftCooperativeId(loadCooperativeId());
    setUser(loadUser());
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    void getMyCooperatives()
      .then((res) => {
        setCooperatives(res.cooperatives);
        const saved = loadCooperativeId();
        if (!saved && res.cooperatives[0]?.id) {
          localStorage.setItem('verifund_cooperative_id', res.cooperatives[0].id);
          setCooperativeId(res.cooperatives[0].id);
          setDraftCooperativeId(res.cooperatives[0].id);
        }
      })
      .catch(() => setCooperatives([]));
  }, [user]);

  useEffect(() => {
    async function checkHealth() {
      try {
        const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5050/api';
        const healthUrl = `${rawBaseUrl.replace('/api', '')}/health`;
        const res = await fetch(healthUrl);
        if (res.ok) {
          const data = await res.json();
          setSysStatus({
            connected: true,
            nombaMode: data.nombaMode,
            databaseMode: data.databaseMode,
          });
        } else {
          setSysStatus({ connected: false });
        }
      } catch {
        setSysStatus({ connected: false });
      }
    }
    void checkHealth();
    const timer = setInterval(() => void checkHealth(), 5000); // Check every 5s
    return () => clearInterval(timer);
  }, []);

  function handleLogout() {
    localStorage.removeItem('verifund_token');
    localStorage.removeItem('verifund_user');
    navigate('/login');
  }

  function handleSaveCooperativeId() {
    const next = draftCooperativeId.trim();
    if (cooperatives.length > 0 && next && !cooperatives.some((coop) => coop.id === next)) {
      setCoopNotice('You can only open cooperatives you created or were assigned to.');
      return;
    }
    setCoopNotice(null);
    localStorage.setItem('verifund_cooperative_id', next);
    setCooperativeId(next);
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
          {cooperatives.length > 0 ? (
            <label className="input-block" style={{ marginTop: 12 }}>
              <span>Your Cooperatives</span>
              <select
                value={cooperativeId}
                onChange={(e) => {
                  const next = e.target.value;
                  setDraftCooperativeId(next);
                  localStorage.setItem('verifund_cooperative_id', next);
                  setCooperativeId(next);
                }}
              >
                <option value="">Select cooperative</option>
                {cooperatives.map((coop) => (
                  <option key={coop.id} value={coop.id}>
                    {coop.name} ({coop.role})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <button
              className="button button--ghost button--full"
              onClick={() => navigate('/admin/cooperative')}
            >
              {cooperativeId ? 'Create or switch cooperative' : 'Create cooperative'}
            </button>
          )}
          <label className="input-block" style={{ marginTop: 12 }}>
            <span>Load Cooperative ID</span>
            <input
              value={draftCooperativeId}
              onChange={(e) => setDraftCooperativeId(e.target.value)}
              placeholder="rc-local-1001"
            />
          </label>
          {coopNotice && (
            <div className="notice" style={{ marginTop: 10 }}>
              {coopNotice}
            </div>
          )}
          <button className="button button--primary button--full" onClick={handleSaveCooperativeId}>
            Open Cooperative
          </button>
          <button className="button button--ghost button--full" onClick={() => navigate('/admin/cooperative')} style={{ marginTop: 8 }}>
            Create or assign cooperative
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

        <div className="sidebar__status" style={{ padding: '12px 16px', margin: '8px 16px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'grid', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sysStatus.connected ? '#10b981' : '#ef4444' }} />
            <span style={{ fontWeight: 600, color: sysStatus.connected ? '#fff' : 'rgba(255,255,255,0.4)' }}>
              Backend: {sysStatus.connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          {sysStatus.connected && (
            <>
              <div>Database: <span style={{ color: '#fff', fontWeight: 600 }}>{sysStatus.databaseMode === 'postgres' ? '🗄️ Neon Postgres' : '📦 In-Memory'}</span></div>
              <div>Nomba: <span style={{ color: '#fff', fontWeight: 600 }}>{sysStatus.nombaMode === 'live' ? '🟢 Live' : '🟡 Mock'}</span></div>
            </>
          )}
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
