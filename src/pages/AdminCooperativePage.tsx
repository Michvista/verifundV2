import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addCooperativeMember, createCooperative } from '../services/api';

type CooperativeType = 'thrift' | 'credit' | 'multipurpose';

export function AdminCooperativePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [stateName, setStateName] = useState('');
  const [cooperativeType, setCooperativeType] = useState<CooperativeType>('thrift');
  const [contributionAmount, setContributionAmount] = useState('10000');
  const [bvn, setBvn] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [memberId, setMemberId] = useState('');
  const [memberRole, setMemberRole] = useState<'member' | 'treasurer' | 'executive1' | 'executive2' | 'admin'>('member');
  const [memberMsg, setMemberMsg] = useState<string | null>(null);

  async function handleCreate() {
    if (!name || !registrationNumber || !stateName || !bvn) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await createCooperative({
        name,
        registrationNumber,
        stateName,
        cooperativeType,
        bvn: bvn.trim(),
        contributionAmount: Number(contributionAmount || 0),
      });
      localStorage.setItem('verifund_cooperative_id', response.cooperative.id);
      // Persist the virtual account so CooperativePage can display it without re-fetching
      if (response.virtualAccount.accountNumber) {
        localStorage.setItem('verifund_virtual_account', JSON.stringify({
          accountNumber: response.virtualAccount.accountNumber,
          bankName: response.virtualAccount.bankName ?? 'Nomba',
        }));
      }
      setResult(
        `✅ Cooperative "${response.cooperative.name}" created.\n` +
        `Virtual Account: ${response.virtualAccount.accountNumber ?? 'pending'} · ${response.virtualAccount.bankName ?? 'Nomba'}\n` +
        `Transfer real NGN to this account from any banking app to fund the treasury.`
      );
      navigate('/cooperative');
    } catch (err) {
      setError((err as Error).message || 'Failed to create cooperative');
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignMember() {
    const cooperativeId = localStorage.getItem('verifund_cooperative_id') || '';
    if (!cooperativeId || !memberId) return;
    setAssigning(true);
    setMemberMsg(null);
    try {
      await addCooperativeMember(cooperativeId, { memberId, role: memberRole });
      setMemberMsg(`Assigned ${memberId} as ${memberRole} in ${cooperativeId}.`);
      setMemberId('');
      setMemberRole('member');
    } catch (err) {
      setMemberMsg((err as Error).message || 'Failed to add member');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="admin-grid">
      <section className="admin-panel page-reveal">
        <div className="eyebrow">Cooperative Setup</div>
        <h2>Create a live cooperative record</h2>
        <p className="empty-state" style={{ marginTop: 10 }}>
          This page creates the treasury shell that Nomba will bind to a virtual account. No
          preset cooperative is loaded here.
        </p>

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
          <span>Monthly Contribution Amount</span>
          <input
            value={contributionAmount}
            onChange={(e) => setContributionAmount(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="10000"
            inputMode="numeric"
          />
        </label>

        <label className="input-block">
          <span>BVN (Required)</span>
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
            {result}
          </div>
        )}

        <button className="button button--primary button--full" style={{ marginTop: 16 }} disabled={loading} onClick={handleCreate}>
          {loading ? 'Creating cooperative...' : 'Create Cooperative'}
        </button>
      </section>

      <section className="admin-panel admin-panel--dark page-reveal">
        <div className="eyebrow">Why it matters</div>
        <h2>The virtual account is the control plane.</h2>
        <div className="admin-panel__balance">No cash leaves the ledger without Nomba.</div>
        <div className="admin-panel__stats">
          <div>
            <span>Contribution Routing</span>
            <strong>Dedicated virtual account</strong>
          </div>
          <div>
            <span>Withdrawal Gate</span>
            <strong>Multi-signature approval</strong>
          </div>
          <div>
            <span>Visibility</span>
            <strong>Realtime webhook trail</strong>
          </div>
        </div>
        <button className="button button--light button--full" style={{ marginTop: 24 }} onClick={() => navigate('/dashboard')}>
          Review Dashboard
        </button>

        <div style={{ marginTop: 28, width: '100%' }}>
          <div className="eyebrow">Assign Members</div>
          <p style={{ marginTop: 8, opacity: 0.85 }}>
            Add existing members to the active cooperative so they can sign in and see the cooperatives they belong to.
          </p>
          <label className="input-block">
            <span>Member ID</span>
            <input value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="mem_..." />
          </label>
          <label className="input-block">
            <span>Role in Cooperative</span>
            <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as typeof memberRole)}>
              <option value="member">Member</option>
              <option value="treasurer">Treasurer</option>
              <option value="executive1">Executive 1</option>
              <option value="executive2">Executive 2</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {memberMsg && <div className="notice" style={{ marginTop: 10 }}>{memberMsg}</div>}
          <button className="button button--primary button--full" style={{ marginTop: 12 }} disabled={assigning || !memberId} onClick={handleAssignMember}>
            {assigning ? 'Assigning...' : 'Add Member to Cooperative'}
          </button>
        </div>
      </section>
    </div>
  );
}
