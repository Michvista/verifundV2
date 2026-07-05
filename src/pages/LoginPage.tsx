import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [memberId, setMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationState = location.state as LoginLocationState | null;
  const returnTo = locationState?.from?.pathname || '/dashboard';

  async function handleLogin(id: string) {
    setLoading(true);
    setError(null);
    try {
      await signIn(id);
      navigate(returnTo, { replace: true });
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
          <h2>Sign in with your member ID</h2>
          <p>
            Use the ID returned during registration. No demo logins, no hidden shortcuts.
          </p>

          <label className="input-block">
            <span>Member ID</span>
            <input
              value={memberId}
              onChange={(e) => setMemberId(e.target.value.trim())}
              placeholder="Enter your member ID"
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
            {loading ? 'Verifying...' : 'Continue'}
          </button>

          <p style={{ marginTop: 16, fontSize: 13 }}>
            New member?{' '}
            <Link to="/onboard" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Register here
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
