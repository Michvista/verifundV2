import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../services/api';

const SEED_MEMBERS = [
  { id: 'mem-01', name: 'Amina Okafor', role: 'Treasurer' },
  { id: 'mem-02', name: 'Bola Adewale', role: 'Executive 1' },
  { id: 'mem-03', name: 'Chika Nwosu', role: 'Executive 2' },
  { id: 'admin-01', name: 'Regina Ojo', role: 'Admin' },
  { id: 'reg-01', name: 'Ifeanyi Okoro', role: 'Regulator' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [memberId, setMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(id: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await login(id);
      localStorage.setItem('verifund_token', result.token);
      localStorage.setItem('verifund_user', JSON.stringify(result.member));
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Login failed. Check your Member ID.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-page">
        <div className="auth-brand">
          <div className="auth-brand__wordmark">VeriFund</div>
          <div className="auth-brand__sub">AI-Powered Cooperative Treasury</div>
        </div>

        <section className="center-card page-reveal">
          <div className="eyebrow">Secure Access</div>
          <h2>Sign in to your cooperative</h2>
          <p>Enter your Member ID to access the VeriFund dashboard.</p>

          <label className="input-block">
            <span>Member ID</span>
            <input
              value={memberId}
              onChange={(e) => setMemberId(e.target.value.trim())}
              placeholder="e.g. mem-01"
              onKeyDown={(e) => e.key === 'Enter' && memberId && handleLogin(memberId)}
            />
          </label>

          {error && (
            <div className="callout" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}

          <button
            className="button button--primary button--full"
            style={{ marginTop: 20 }}
            disabled={!memberId || loading}
            onClick={() => handleLogin(memberId)}
          >
            {loading ? 'Verifying…' : 'Continue →'}
          </button>

          <p style={{ marginTop: 16, fontSize: 13 }}>
            New member?{' '}
            <Link to="/onboard" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Register here
            </Link>
          </p>
        </section>

        {/* Quick Login helper for hackathon demo */}
        <section className="quick-login-card page-reveal">
          <div className="eyebrow">Demo Quick Access</div>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
            Click any seed member to log in instantly for the hackathon demo.
          </p>
          <div className="quick-login-grid">
            {SEED_MEMBERS.map((m) => (
              <button
                key={m.id}
                className="quick-login-btn"
                onClick={() => handleLogin(m.id)}
                disabled={loading}
              >
                <div className="quick-login-btn__name">{m.name}</div>
                <div className="quick-login-btn__role">{m.role}</div>
                <div className="quick-login-btn__id">{m.id}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
