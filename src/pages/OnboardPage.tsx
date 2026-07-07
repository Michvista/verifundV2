import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, type RegisterResponse } from '../services/api';

type Step = 'form' | 'success';

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
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

async function hashBvnForApi(bvn: string) {
  if (!window.crypto?.subtle) {
    throw new Error('Secure BVN hashing is unavailable in this browser.');
  }

  const bytes = new TextEncoder().encode(bvn);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return `sha256:${hash}`;
}

export function OnboardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bvn, setBvn] = useState('');

  const [result, setResult] = useState<RegisterResponse | null>(null);
  const trimmedFullName = fullName.trim();
  const trimmedPhone = phone.trim();
  const passwordReady = password.length >= 8 && password === confirmPassword;
  const canSubmit = Boolean(
    trimmedFullName && trimmedPhone && passwordReady && bvn.length === 11,
  );

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const [firstName, ...lastNameParts] = trimmedFullName.split(/\s+/);
      const lastName = lastNameParts.join(' ') || firstName;
      const bvnHash = await hashBvnForApi(bvn);
      const res = await register({
        firstName,
        lastName,
        phoneNumber: trimmedPhone,
        password,
        bvnHash,
        role: 'member',
      });
      setResult(res);
      setBvn('');
      setPassword('');
      setConfirmPassword('');
      setStep('success');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success' && result) {
    return (
      <div className="auth-simple auth-simple--signup">
        <section className="auth-card auth-card--success page-reveal">
          <div className="eyebrow">Registration Complete</div>
          <h2>Welcome, {result.member.firstName}!</h2>
          <p>
            Your profile is live. Use your phone number and password when signing in.
          </p>

          <div className="success-block">
            <div className="success-block__row">
              <span>Member ID</span>
              <strong style={{ fontFamily: 'monospace' }}>{result.member.id}</strong>
            </div>
            <div className="success-block__row">
              <span>Role</span>
              <strong>{result.member.role}</strong>
            </div>
            <div className="success-block__row">
              <span>BVN Verified</span>
              <strong
                style={{
                  color: result.member.bvnVerified ? 'var(--accent)' : 'var(--danger)',
                }}
              >
                {result.member.bvnVerified ? 'Verified' : 'Unverified'}
              </strong>
            </div>
          </div>

          {!result.verification.verified && (
            <div className="notice" style={{ marginTop: 16 }}>
              This BVN is already linked to another profile. Use a fresh BVN if you want a new
              member record.
            </div>
          )}

          <div className="nomba-explanation">
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Why the virtual account matters
            </div>
            <p>
              The virtual account is the anti-absconding mechanism. Contributions flow into a
              dedicated Nomba account the treasurer cannot touch directly. Withdrawals still
              require multi-signature approval and a risk check before Nomba releases funds.
            </p>
          </div>

          <div className="notice" style={{ marginTop: 0 }}>
            Account reference: <strong>{result.member.id}</strong>
          </div>

          <button
            className="button button--primary button--full"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-simple auth-simple--signup">
      <section className="auth-card auth-card--signup page-reveal">
        <div className="auth-card__header">
          <h1>Create Account</h1>
          <p>Join VeriFund to secure your cooperative assets.</p>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <label className="auth-field">
            <span>Full Name</span>
            <div className="auth-field__control">
              <span className="auth-field__icon" aria-hidden="true">
                <ProfileIcon />
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Phone Number</span>
            <div className="auth-field__control">
              <span className="auth-field__icon" aria-hidden="true">☎</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 800 000 0001"
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
                placeholder="Your Password"
                type="password"
                autoComplete="new-password"
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Confirm Password</span>
            <div className="auth-field__control">
              <span className="auth-field__icon" aria-hidden="true">
                <LockIcon />
              </span>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter Password"
                type="password"
                autoComplete="new-password"
              />
            </div>
          </label>

          <label className="auth-field">
            <span>BVN</span>
            <div className="auth-field__control">
              <span className="auth-field__icon" aria-hidden="true">#</span>
              <input
                value={bvn}
                onChange={(e) => setBvn(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                placeholder="11 digit verification number"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
          </label>

          {error && (
            <div className="callout">
              {error}
            </div>
          )}

          {password && password.length < 8 && (
            <div className="callout">
              Password must be at least 8 characters.
            </div>
          )}

          {confirmPassword && password !== confirmPassword && (
            <div className="callout">
              Passwords do not match.
            </div>
          )}

          <button
            className="button button--primary button--full auth-submit"
            type="submit"
            disabled={!canSubmit || loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-card__terms auth-card__terms--compact">
          By creating an account, your BVN is hashed before submission.
        </p>

        <p className="auth-card__footer">
          Already registered?{' '}
          <Link to="/login">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
