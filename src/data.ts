export const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Onboard', to: '/onboard' },
  { label: 'Login', to: '/login' },
  { label: 'Cooperative', to: '/cooperative/okafor-farmers-thrift' },
  { label: 'Trust Score', to: '/cooperative/okafor-farmers-thrift/trust-score' },
  { label: 'Admin Hub', to: '/admin/cooperative' },
  { label: 'Withdrawals', to: '/admin/withdrawal' },
  { label: 'Fraud Alerts', to: '/fraud/alerts' },
  { label: 'Whistleblower', to: '/whistleblower' },
  { label: 'Lookup', to: '/public/lookup' },
];

export const contributionHistory = [
  { date: '2023-12-15', amount: '₦20,000.00', status: 'Confirmed', reference: 'TXN-9921-XF' },
  { date: '2023-11-15', amount: '₦20,000.00', status: 'Confirmed', reference: 'TXN-8742-LK' },
  { date: '2023-10-15', amount: '₦20,000.00', status: 'Archived', reference: 'TXN-4410-PP' },
  { date: '2023-09-15', amount: '₦25,000.00', status: 'Confirmed', reference: 'TXN-3291-ZZ' },
];

export const contributionTrend = [18, 21, 19, 24, 26, 23, 29, 35, 40, 44, 49, 53];

export const trustHistory = [42, 46, 50, 53, 58, 61, 70, 73, 72, 75, 78, 79];

export const dashboard = {
  balance: 482000.5,
  nextContribution: 'Jan 15, ₦20,000',
  tenure: '14 Months Active',
  trustScore: 92,
  loanStatus: 'Eligible',
  activityFeed: [
    { id: 'feed-1', title: 'New Member Joined', text: 'Adewale K. joined the Lagos Mainland cell.', time: '2 mins ago' },
    { id: 'feed-2', title: 'Dividend Payout', text: 'Quarterly 4% dividends distributed to active members.', time: '1 hour ago' },
    { id: 'feed-3', title: 'General Meeting', text: 'Annual review scheduled for Jan 20th.', time: '5 hours ago' },
    { id: 'feed-4', title: 'Identity Verified', text: 'KYC documents were re-verified by Admin #04.', time: 'Yesterday' },
  ],
  contributionTrend,
  contributionHistory: [
    { id: 'txn-9921-xf', date: '2023-12-15', amount: 20000, status: 'confirmed', reference: 'TXN-9921-XF' },
    { id: 'txn-8742-lk', date: '2023-11-15', amount: 20000, status: 'confirmed', reference: 'TXN-8742-LK' },
    { id: 'txn-4410-pp', date: '2023-10-15', amount: 20000, status: 'archived', reference: 'TXN-4410-PP' },
    { id: 'txn-3291-zz', date: '2023-09-15', amount: 25000, status: 'confirmed', reference: 'TXN-3291-ZZ' },
  ],
};

export const withdrawalRiskSignals = [
  { label: '30-day average', value: '₦510,000' },
  { label: 'Requested amount', value: '₦850,000' },
  { label: 'Deviation', value: '+67%' },
  { label: 'Risk band', value: 'Medium' },
];

export const activityFeed = [
  { title: 'New Member Joined', text: 'Adewale K. joined the Lagos Mainland cell.', time: '2 mins ago' },
  { title: 'Dividend Payout', text: 'Quarterly 4% dividends distributed to active members.', time: '1 hour ago' },
  { title: 'General Meeting', text: 'Annual review scheduled for Jan 20th.', time: '5 hours ago' },
  { title: 'Identity Verified', text: 'KYC documents were re-verified by Admin #04.', time: 'Yesterday' },
];

export const pendingQueue = [
  { ref: '#WF-9042', initiated: '24/10/23', recipient: 'Agba Ventures Ltd', amount: '₦2,450,000.00', sigs: '■■□', status: 'Processing', id: 'wf-9042' },
  { ref: '#WF-9038', initiated: '23/10/23', recipient: 'Staff Gratuity Fund', amount: '₦12,000,000.00', sigs: '■■■', status: 'Flagged: Risk', id: 'wf-9038' },
  { ref: '#WF-8991', initiated: '21/10/23', recipient: 'Property Rent (H2)', amount: '₦850,000.00', sigs: '■□□', status: 'Pending Sig', id: 'wf-8991' },
];

export const alerts = [
  { type: 'anomaly', title: 'Large withdrawal outside baseline', reason: 'Requested amount is 4.7x the 30-day average.', severity: 'High' },
  { type: 'ghost_member', title: 'Duplicate BVN detected', reason: 'Same BVN appears across two active member profiles.', severity: 'Medium' },
  { type: 'ring_detected', title: 'Repeated approval cluster', reason: 'Three requests were co-signed by the same trio in 9 days.', severity: 'High' },
];

export const trustBars = [
  { label: 'Member Verification', value: 95 },
  { label: 'Contribution Regularity', value: 88 },
  { label: 'Loan Liquidity', value: 91 },
  { label: 'Governance Transparency', value: 100 },
  { label: 'External Audit Status', value: 85 },
];
