import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient, useSession } from "@/api/client/authClient";
import { apiArray, apiGet, onSessionExpired } from "@/api/client/axiosClient";
import { clearCsrfToken } from "@/api/client/csrf";
import { useUiStore } from "@/stores/useUiStore";
import type { GlobalRole, OrgRole, User, UserContext } from "@/types";

/** Shape of the real GET /me response (backend/src/modules/users/users.dto.ts). */
interface MeResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  platformRole: "PLATFORM_SUPERADMIN" | "PLATFORM_SUPPORT_AGENT" | null;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  avatarAssetId: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  discordHandle: string | null;
  visibility: "PUBLIC" | "ORGANIZATION_MEMBERS" | "PRIVATE";
  twoFactorEnabled: boolean;
  skills: { id: string | null; name: string; isCustom: boolean }[];
}

/** Shape of the real GET /me/organizations response — a plain array, not a cursor page. */
export interface MyOrganizationMembership {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  role: OrgRole;
  joinedAt: string;
}

export interface SignInResult {
  error?: string;
  twoFactorRedirect?: boolean;
}

export interface AuthContextType {
  user: User | null;
  userContext: UserContext;
  isAuthenticated: boolean;
  /** True while the initial session/profile fetch is still in flight. */
  isLoading: boolean;
  /** Every organization the signed-in user actively belongs to (real mode only). */
  memberships: MyOrganizationMembership[];
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, name: string, returnTo?: string) => Promise<SignInResult>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

function toUser(me: MeResponse): User {
  return {
    id: me.id,
    email: me.email,
    fullName: me.displayName || me.email,
    username: me.email.split("@")[0],
    globalRole: (me.platformRole ?? "USER") as GlobalRole,
    avatarUrl: undefined,
    createdAt: new Date().toISOString(),
    twoFactorEnabled: me.twoFactorEnabled,
    profile: {
      headline: undefined,
      bio: me.bio ?? undefined,
      avatarUrl: undefined,
      location: me.location ?? undefined,
      githubUsername: me.githubUrl ?? undefined,
      linkedinUrl: me.linkedinUrl ?? undefined,
      websiteUrl: me.portfolioUrl ?? undefined,
      skills: me.skills.map((s) => ({ id: s.id ?? s.name, name: s.name, category: "OTHER" })),
      availableForTeams: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };
}

function useRealAuth(): AuthContextType {
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useSession();
  const activeOrganizationId = useUiStore((s) => s.activeOrganizationId);
  const authUserId = session?.user?.id;

  const meQuery = useQuery({
    queryKey: ["auth", "me", authUserId],
    queryFn: () => apiGet<MeResponse>("/me"),
    enabled: Boolean(authUserId),
    staleTime: 60_000,
  });

  const membershipsQuery = useQuery({
    queryKey: ["auth", "memberships", authUserId],
    queryFn: () => apiArray<MyOrganizationMembership>("/me/organizations"),
    enabled: Boolean(authUserId),
    staleTime: 60_000,
  });

  React.useEffect(() => {
    // Registered once per provider instance: when the transport layer sees
    // a 401 on any API call, the session is dead server-side even if the
    // client hasn't noticed yet — force a clean client-side reset so
    // useSession() and every route guard reflect that immediately.
    onSessionExpired(() => {
      clearCsrfToken();
      queryClient.removeQueries({ queryKey: ["auth"] });
      void authClient.signOut();
    });
  }, [queryClient]);

  const memberships = membershipsQuery.data ?? [];
  const activeMembership = memberships.find((m) => m.organizationId === activeOrganizationId);

  const isAuthenticated = Boolean(authUserId);
  const isLoading = sessionPending || (isAuthenticated && (meQuery.isPending || membershipsQuery.isPending));

  const user = meQuery.data ? toUser(meQuery.data) : null;

  const userContext: UserContext = user
    ? {
        user,
        globalRole: user.globalRole,
        activeOrgId: activeMembership?.organizationId,
        orgRole: activeMembership?.role,
        // Challenge-scoped roles (JUDGE/MENTOR/PARTICIPANT) are inherently
        // per-challenge, not a global list — pages that need one resolve it
        // contextually (e.g. from the challenge/participation/staff-
        // assignment endpoints for the specific challenge being viewed)
        // rather than this context eagerly loading every challenge a user
        // has any relationship to.
        challengeRoles: {},
      }
    : { user: null as any, globalRole: "USER" };

  const signIn = React.useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      return { error: result.error.message || "Invalid email or password." };
    }
    if ((result.data as any)?.twoFactorRedirect) {
      return { twoFactorRedirect: true };
    }
    return {};
  }, []);

  const signUp = React.useCallback(async (email: string, password: string, name: string, returnTo?: string): Promise<SignInResult> => {
    const callbackParams = new URLSearchParams({ verified: "true" });
    if (returnTo) callbackParams.set("returnTo", returnTo);
    const result = await authClient.signUp.email({
      email,
      password,
      name,
      callbackURL: `${window.location.origin}/auth/verify-email?${callbackParams.toString()}`,
    });
    if (result.error) {
      return { error: result.error.message || "Could not create an account." };
    }
    return {};
  }, []);

  const logout = React.useCallback(async () => {
    clearCsrfToken();
    await authClient.signOut();
    queryClient.removeQueries({ queryKey: ["auth"] });
  }, [queryClient]);

  return {
    user,
    userContext,
    isAuthenticated,
    isLoading,
    memberships,
    signIn,
    signUp,
    logout,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useRealAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth() must be called within <AuthProvider>. Every route renders under it (see App.tsx).");
  }
  return context;
}
