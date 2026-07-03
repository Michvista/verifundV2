import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { DashboardPage } from './pages/DashboardPage';
import { OnboardPage } from './pages/OnboardPage';
import { LoginPage } from './pages/LoginPage';
import { CooperativePage } from './pages/CooperativePage';
import { TrustScorePage } from './pages/TrustScorePage';
import { AdminCooperativePage } from './pages/AdminCooperativePage';
import { WithdrawalPage } from './pages/WithdrawalPage';
import { FraudAlertsPage } from './pages/FraudAlertsPage';
import { WhistleblowerPage } from './pages/WhistleblowerPage';
import { PublicLookupPage } from './pages/PublicLookupPage';

export default function App() {
  return (
    <Routes>
      <Route path="onboard" element={<OnboardPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="/" element={<Shell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="cooperative/:id" element={<CooperativePage />} />
        <Route path="cooperative/:id/trust-score" element={<TrustScorePage />} />
        <Route path="admin/cooperative" element={<AdminCooperativePage />} />
        <Route path="admin/withdrawal" element={<WithdrawalPage />} />
        <Route path="fraud/alerts" element={<FraudAlertsPage />} />
        <Route path="whistleblower" element={<WhistleblowerPage />} />
        <Route path="public/lookup" element={<PublicLookupPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
