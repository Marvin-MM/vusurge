import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Resolves the generic "go to my organization admin dashboard" link
 * (`/org-admin`, used by nav/footer/invitation-acceptance CTAs) to a real
 * destination — there is no single fixed org to redirect to, so it depends
 * on who's asking: signed out → sign in and come back here; signed in with
 * memberships → their first organization; signed in with none → the apply
 * flow.
 */
export function OrgAdminEntryRedirect() {
  const { isAuthenticated, isLoading, memberships } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/signin?returnTo=%2Forg-admin" replace />;
  }

  if (memberships.length > 0) {
    return <Navigate to={`/org/${memberships[0].organizationId}`} replace />;
  }

  return <Navigate to="/app/apply-organization" replace />;
}
