export type CooperativeType = 'thrift' | 'credit' | 'multipurpose';
export type ContributionStatus = 'pending' | 'confirmed' | 'flagged' | 'failed' | 'archived';
export type WithdrawalStatus = 'pending' | 'partially_signed' | 'approved' | 'rejected' | 'released' | 'pending_review';
export type AlertStatus = 'open' | 'investigating' | 'resolved' | 'false_positive';
export type AlertType = 'anomaly' | 'ghost_member' | 'ring_detected' | 'whistleblower';
export type RiskCategory = 'low' | 'medium' | 'high';

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  passwordHash: string;
  bvnHash: string;
  bvnVerified: boolean;
  bvnVerifiedAt?: string;
  role: 'member' | 'treasurer' | 'executive1' | 'executive2' | 'admin' | 'regulator';
  isActive: boolean;
}

export interface Cooperative {
  id: string;
  name: string;
  registrationNumber: string;
  state: string;
  cooperativeType: CooperativeType;
  nombaVirtualAccountRef: string;
  nombaAccountId: string;
  nombaVirtualAccountNumber?: string;
  healthScore: number;
  healthScoreUpdatedAt: string;
  isActive: boolean;
  memberCount: number;
  balance: number;
}

export interface Contribution {
  id: string;
  memberId: string;
  cooperativeId: string;
  amount: number;
  nombaTransactionRef: string;
  status: ContributionStatus;
  riskScore: number;
  contributedAt: string;
}

export interface WithdrawalSignature {
  id: string;
  withdrawalRequestId: string;
  signedBy: string;
  role: 'treasurer' | 'executive1' | 'executive2';
  signedAt: string;
}

export interface WithdrawalRequest {
  id: string;
  cooperativeId: string;
  requestedBy: string;
  amount: number;
  destinationAccount: string;
  destinationBankCode: string;
  purpose: string;
  riskScore: number;
  status: WithdrawalStatus;
  nombaTransferRef?: string;
  createdAt: string;
  average30d: number;
  signatureCount: number;
  explanations: string[];
}

export interface FraudAlert {
  id: string;
  cooperativeId: string;
  alertType: AlertType;
  riskScore: number;
  triggeredBy: string;
  evidenceJson: Record<string, unknown>;
  status: AlertStatus;
  createdAt: string;
  title: string;
  reason: string;
  severity: 'Low' | 'Medium' | 'High';
}

export interface WhistleblowerReport {
  id: string;
  submittedAt: string;
  report: string;
  supportingDetails?: string;
  status: AlertStatus;
}

export interface AuditEvent {
  id: string;
  cooperativeId: string;
  eventType: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardContribution {
  id: string;
  date: string;
  amount: number;
  status: 'confirmed' | 'archived';
  reference: string;
}

export interface DashboardFeedItem {
  id: string;
  title: string;
  text: string;
  time: string;
}

export interface ApiDashboard {
  balance: number;
  nextContribution: string;
  tenure: string;
  trustScore: number;
  loanStatus: string;
  activityFeed: DashboardFeedItem[];
  contributionTrend: number[];
  contributionHistory: DashboardContribution[];
}
