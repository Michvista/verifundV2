import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register, type RegisterResponse } from '../services/api';

type Step = 'form' | 'success';

export function OnboardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bvn, setBvn] = useState('');

  const [result, setResult] = useState<RegisterResponse | null>(null);

  async function handleSubmit() {
    if (!firstName || !lastName || !phone || bvn.length !== 11) return;
    setLoading(true);
    setError(null);
    try {
      const res = await register({ firstName, lastName, phoneNumber: phone, bvnHash: bvn });
      setResult(res);
      setStep('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success' && result) {
    return (
      <div className="onboard-shell">
        <div className="stepper">
          <div className="stepper__item">01 Verify</div>
          <div className="stepper__item stepper__item--active">02 Account</div>
          <div className="stepper__item">03 Authorize</div>
        </div>

        <section className="center-card page-reveal" style={{ maxWidth: 520 }}>
          <div className="eyebrow">Registration Complete</div>
          <h2>Welcome, {result.member.firstName}!</h2>
          <p>Your member profile and a Nomba-backed virtual treasury have been created.</p>

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
              <strong style={{ color: result.verification.verified ? 'var(--accent)' : 'var(--danger)' }}>
                {result.verification.verified ? '✓ Verified' : '✗ Unverified'}
              </strong>
            </div>
          </div>

          <div className="nomba-explanation">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Why a Virtual Account?</div>
            <p>
              The virtual account isn't just a feature — it's the entire anti-absconding mechanism.
              All contributions flow into a dedicated Nomba virtual account.
              The treasurer <em>structurally cannot touch the money</em> — every disbursement
              is gated by multi-signature approval and risk scoring before Nomba releases funds.
              VeriFund turns cases like Micheno (₦2B) and Covenant Fadama (₦178M, 44,000 victims)
              into prevention use cases, not post-fraud investigations.
            </p>
          </div>

          <div className="notice" style={{ marginTop: 0 }}>
            Save your Member ID: <strong>{result.member.id}</strong> — you'll use it to log in.
          </div>

          <button
            className="button button--primary button--full"
            style={{ marginTop: 16 }}
            onClick={() => navigate('/login')}
          >
            Go to Login →
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="onboard-shell">
      <div className="stepper">
        <div className="stepper__item stepper__item--active">01 Verify</div>
        <div className="stepper__item">02 Account</div>
        <div className="stepper__item">03 Authorize</div>
      </div>

      <section className="center-card center-card--narrow page-reveal">
        <div className="eyebrow">New Member Registration</div>
        <h2>Create your VeriFund account</h2>
        <p>
          Your BVN will be verified against the cooperative registry and linked to a Nomba
          virtual account for contribution tracking.
        </p>

        <label className="input-block">
          <span>First Name</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Amina"
          />
        </label>

        <label className="input-block">
          <span>Last Name</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Okafor"
          />
        </label>

        <label className="input-block">
          <span>Phone Number</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+2348000000001"
            inputMode="tel"
          />
        </label>

        <label className="input-block">
          <span>BVN (11 digits)</span>
          <input
            value={bvn}
            onChange={(e) => setBvn(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
            placeholder="•••• •••• •••"
            inputMode="numeric"
          />
        </label>

        {error && (
          <div className="callout" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <div className="notice" style={{ marginTop: 18 }}>
          This data is stored securely. Your BVN is hashed before storage and never exposed in
          client state.
        </div>

        <button
          className="button button--primary button--full"
          style={{ marginTop: 16 }}
          disabled={!firstName || !lastName || !phone || bvn.length !== 11 || loading}
          onClick={handleSubmit}
        >
          {loading ? 'Creating account…' : 'Create Account & Verify BVN'}
        </button>

        <p style={{ marginTop: 16, fontSize: 13 }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Log in here
          </Link>
        </p>
      </section>
    </div>
  );
}
