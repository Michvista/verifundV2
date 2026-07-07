import { Navigate, useLocation } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import type { UserRole } from "../services/session";
import { useAuth } from "./AuthContext";

type Props = {
  allowedRoles?: UserRole[];
  children: JSX.Element;
};

function AccessDenied({ allowedRoles }: { allowedRoles: UserRole[] }) {
  return (
    <SectionCard
      title="Access restricted"
      subtitle="Your account is signed in, but this workspace area requires a different role."
      actions={<StatusPill tone="danger">403</StatusPill>}
      className="page-reveal"
    >
      <p className="empty-state">
        Required role: <strong>{allowedRoles.join(", ")}</strong>
      </p>
    </SectionCard>
  );
}

export function RequireAuth({ allowedRoles, children }: Props) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user?.role as UserRole)) {
    return <AccessDenied allowedRoles={allowedRoles} />;
  }

  return children;
}
