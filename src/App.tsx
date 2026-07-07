import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { RequireAuth } from './auth/RequireAuth';

const AdminCooperativePage = lazy(() =>
  import('./pages/AdminCooperativePage').then((module) => ({ default: module.AdminCooperativePage })),
);
const CooperativePage = lazy(() =>
  import('./pages/CooperativePage').then((module) => ({ default: module.CooperativePage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const FraudAlertsPage = lazy(() =>
  import('./pages/FraudAlertsPage').then((module) => ({ default: module.FraudAlertsPage })),
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })),
);
const OnboardPage = lazy(() =>
  import('./pages/OnboardPage').then((module) => ({ default: module.OnboardPage })),
);
const PublicLookupPage = lazy(() =>
  import('./pages/PublicLookupPage').then((module) => ({ default: module.PublicLookupPage })),
);
const RiskDashboardPage = lazy(() =>
  import('./pages/RiskDashboardPage').then((module) => ({ default: module.RiskDashboardPage })),
);
const SystemStatusPage = lazy(() =>
  import('./pages/SystemStatusPage').then((module) => ({ default: module.SystemStatusPage })),
);
const TransactionsPage = lazy(() =>
  import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })),
);
const TrustScorePage = lazy(() =>
  import('./pages/TrustScorePage').then((module) => ({ default: module.TrustScorePage })),
);
const WhistleblowerPage = lazy(() =>
  import('./pages/WhistleblowerPage').then((module) => ({ default: module.WhistleblowerPage })),
);
const WithdrawalPage = lazy(() =>
  import('./pages/WithdrawalPage').then((module) => ({ default: module.WithdrawalPage })),
);

function RouteFallback() {
  return <section className="note-panel page-reveal">Loading page...</section>;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="onboard" element={<OnboardPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<Shell />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cooperative" element={<CooperativePage />} />
          <Route path="cooperative/trust-score" element={<TrustScorePage />} />
          <Route path="risk/dashboard" element={<RiskDashboardPage />} />
          <Route
            path="transactions"
            element={
              <RequireAuth>
                <TransactionsPage />
              </RequireAuth>
            }
          />
          <Route
            path="system/status"
            element={
              <RequireAuth>
                <SystemStatusPage />
              </RequireAuth>
            }
          />
          <Route
          path="admin/cooperative"
          element={
            <RequireAuth allowedRoles={['admin']}>
              <AdminCooperativePage />
            </RequireAuth>
          }
          />
          <Route
          path="admin/withdrawal"
          element={
            <RequireAuth allowedRoles={['admin', 'treasurer', 'executive1', 'executive2']}>
              <WithdrawalPage />
            </RequireAuth>
          }
          />
          <Route
          path="fraud/alerts"
          element={
            <RequireAuth allowedRoles={['admin', 'regulator']}>
              <FraudAlertsPage />
            </RequireAuth>
          }
          />
          <Route path="whistleblower" element={<WhistleblowerPage />} />
          <Route path="public/lookup" element={<PublicLookupPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
