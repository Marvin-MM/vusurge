import * as React from "react";
import { Permission, can } from "@/types/permissions";
import { useAuth } from "@/context/AuthContext";

export interface PermissionGateProps {
  permission: Permission;
  challengeId?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * PermissionGate guards UI actions & sections based on the active user's
 * permissions. This is a UX guard only — every permission here has a
 * matching server-side check (see backend/docs/permissions-matrix.md);
 * hiding a control here never substitutes for real authorization.
 */
export function PermissionGate({
  permission,
  challengeId,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { userContext } = useAuth();
  const allowed = can(userContext, permission, challengeId);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
