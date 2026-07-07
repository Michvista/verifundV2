import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACTIVE_COOPERATIVE_EVENT } from '../components/Shell';
import {
  createCooperative,
  type CooperativeResponse,
  type CooperativeType,
  type VirtualAccountResponse,
} from '../services/api';

type CreateCooperativeResult = {
  cooperative: CooperativeResponse;
  virtualAccount: VirtualAccountResponse;
};

export function AdminCooperativePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [stateName, setStateName] = useState('');
  const [cooperativeType, setCooperativeType] = useState<CooperativeType>('thrift');
  const [bvn, setBvn] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateCooperativeResult | null>(null);

  const trimmedName = name.trim();
  const trimmedRegistrationNumber = registrationNumber.trim();
  const trimmedStateName = stateName.trim();
  const trimmedBvn = bvn.trim();
  const canSubmit = Boolean(
    trimmedName &&
      trimmedRegistrationNumber &&
      trimmedStateName &&
      trimmedBvn.length === 11,
  );

  async function handleCreate() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await createCooperative({
        name: trimmedName,
        registrationNumber: trimmedRegistrationNumber,
        stateName: trimmedStateName,
        cooperativeType,
        bvn: trimmedBvn,
      });
      localStorage.setItem('verifund_cooperative_id', response.cooperative.id);
      if (response.virtualAccount.accountNumber) {
        localStorage.setItem(
          'verifund_virtual_account',
          JSON.stringify({
            accountNumber: response.virtualAccount.accountNumber,
            bankName: response.virtualAccount.bankName ?? 'Nomba',
          }),
        );
      }
      window.dispatchEvent(new Event(ACTIVE_COOPERATIVE_EVENT));
      setResult(response);
      setName('');
      setRegistrationNumber('');
      setStateName('');
      setBvn('');
    } catch (err) {
      setError((err as Error).message || 'Failed to create cooperative');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel page-reveal">
        <h2>Create a live cooperative record</h2>

        <label className="input-block">
          <span>Cooperative Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VeriFund Farmers Cooperative" />
        </label>

        <label className="input-block">
          <span>Registration Number</span>
          <input
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            placeholder="2026-XYZ-001"
          />
        </label>

        <label className="input-block">
          <span>State</span>
          <input value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="Lagos" />
        </label>

        <label className="input-block">
          <span>Cooperative Type</span>
          <select value={cooperativeType} onChange={(e) => setCooperativeType(e.target.value as CooperativeType)}>
            <option value="thrift">Thrift</option>
            <option value="credit">Credit</option>
            <option value="multipurpose">Multipurpose</option>
          </select>
        </label>

        <label className="input-block">
          <span>BVN</span>
          <input
            value={bvn}
            onChange={(e) => setBvn(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
            placeholder="11 digits"
            inputMode="numeric"
          />
        </label>

        {error && (
          <div className="callout" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        {result && (
          <div className="notice" style={{ marginTop: 12 }}>
            Created <strong>{result.cooperative.name}</strong>. Active cooperative is now{' '}
            <strong>{result.cooperative.id}</strong>.
          </div>
        )}

        {bvn && trimmedBvn.length !== 11 && (
          <div className="callout" style={{ marginTop: 12 }}>
            BVN is required and must be 11 digits.
          </div>
        )}

        <button
          className="button button--primary button--full"
          style={{ marginTop: 16 }}
          disabled={!canSubmit || loading}
          onClick={handleCreate}
        >
          {loading ? 'Creating cooperative...' : 'Create Cooperative'}
        </button>
      </section>

      <section className="admin-panel admin-panel--dark page-reveal">
        <h2>The virtual account is the control plane.</h2>
        <div className="admin-panel__stats">
          <div>
            <span>Active Cooperative</span>
            <strong>{result?.cooperative.id ?? 'Not created yet'}</strong>
          </div>
          <div>
            <span>Virtual Account</span>
            <strong>{result?.virtualAccount.accountNumber ?? result?.cooperative.nombaVirtualAccountNumber ?? 'Pending'}</strong>
          </div>
          <div>
            <span>Nomba Provider</span>
            <strong>{result?.virtualAccount.provider ?? result?.virtualAccount.bankName ?? 'Awaiting setup'}</strong>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 24 }}>
          <button className="button button--light button--full" onClick={() => navigate('/cooperative')} disabled={!result}>
            View Cooperative
          </button>
          <button className="button button--ghost button--full" onClick={() => navigate('/dashboard')} disabled={!result}>
            Review Dashboard
          </button>
        </div>
      </section>
    </div>
  );
}
