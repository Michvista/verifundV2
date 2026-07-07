import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.78 19.78 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.78 19.78 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.91.32 1.79.59 2.64a2 2 0 0 1-.45 2.11L8 9.72a16 16 0 0 0 6.28 6.28l1.25-1.25a2 2 0 0 1 2.11-.45c.85.27 1.73.47 2.64.59A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationState = location.state as LoginLocationState | null;
  const returnTo = locationState?.from?.pathname || '/dashboard';
  const canSubmit = Boolean(identifier.trim() && password);

  async function handleLogin() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await signIn({ identifier: identifier.trim(), password });
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Login failed. Check your member ID or phone number and password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-simple auth-simple--login">
      <section className="auth-card auth-card--login page-reveal">
        <div className="auth-card__header">
          <Link className="auth-card__brand" to="/">VeriFund</Link>
          <h1>Member Login</h1>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleLogin();
          }}
        >
          <label className="auth-field">
            <span>Phone Number or Member ID</span>
            <div className="auth-field__control">
              <span className="auth-field__icon" aria-hidden="true">
                <PhoneIcon />
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="+234 800 000 0001 or mem_1234567890"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-field__control">
              <span className="auth-field__icon" aria-hidden="true">
                <LockIcon />
              </span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                type="password"
                autoComplete="current-password"
              />
            </div>
          </label>

          <div className="auth-card__meta-link">
            <Link to="/onboard">Forgot Password?</Link>
          </div>

          {error && (
            <div className="callout">
              {error}
            </div>
          )}

          <button
            className="button button--primary button--full auth-submit"
            type="submit"
            disabled={!canSubmit || loading}
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

      </section>

      <p className="auth-card__outside-footer">
        New to VeriFund? <Link to="/onboard">Sign Up Cooperative</Link>
      </p>
    </div>
  );
}
