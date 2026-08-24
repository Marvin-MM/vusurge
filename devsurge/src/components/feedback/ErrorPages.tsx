import React, { Component, ReactNode, ErrorInfo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ShieldAlert,
  Lock,
  Building2,
  Clock,
  HelpCircle,
  ArrowLeft,
  RefreshCw,
  Home,
  FileQuestion,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-4">
        <FileQuestion className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-3xl font-extrabold text-foreground tracking-tight">404 — Page Not Found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        The destination or resource you requested doesn't exist, has been archived, or you may have followed a broken link.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Go Back
        </Button>
        <Button size="sm" asChild className="gap-1.5 text-xs">
          <Link to="/">
            <Home className="h-3.5 w-3.5" />
            VUSurge Home
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function ForbiddenPage({ requiredPermission }: { requiredPermission?: string }) {
  const { user, userContext } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-4">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-extrabold text-foreground tracking-tight">403 — Access Restricted</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-lg">
        Your account (<span className="font-semibold text-foreground">{user?.fullName || user?.email}</span> with role{" "}
        <span className="font-mono text-xs text-primary">{userContext.orgRole || userContext.globalRole}</span>) does
        not have sufficient privileges to access this view.
      </p>
      {requiredPermission && (
        <div className="mt-3 px-3 py-1.5 rounded bg-muted/60 border border-border/80 text-xs font-mono text-muted-foreground">
          Required permission: <span className="text-foreground font-semibold">{requiredPermission}</span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Go Back
        </Button>
        <Button size="sm" asChild className="gap-1.5 text-xs">
          <Link to="/app">
            <Home className="h-3.5 w-3.5" />
            Go to My Workspace
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function UnauthorizedPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
        <Lock className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-extrabold text-foreground tracking-tight">401 — Authentication Required</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        You must be signed in to view this challenge workspace, participate in teams, or submit project artifacts.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button size="sm" asChild className="gap-1.5 text-xs">
          <Link to="/auth/signin">Sign In to Continue</Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="text-xs">
          <Link to="/auth/signup">Create New Account</Link>
        </Button>
      </div>
    </div>
  );
}

export function OrganizationSuspendedPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-4">
        <Building2 className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Organization Suspended</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-lg">
        This organization workspace has been suspended or frozen by VUSurge Platform Trust & Safety due to pending policy review or administrative lock.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        If you are the organization owner, please reach out to platform operations via the support desk.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button size="sm" asChild className="gap-1.5 text-xs">
          <Link to="/app/support">Contact Platform Support</Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="text-xs">
          <Link to="/app">Return to Participant Portal</Link>
        </Button>
      </div>
    </div>
  );
}

export function InvitationExpiredPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
        <Clock className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Invitation Expired or Invalid</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        This invitation token has expired, reached its redemption quota limit, or has been revoked by the organization administrator.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button size="sm" asChild className="gap-1.5 text-xs">
          <Link to="/app/organizations">Explore Open Organizations</Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="text-xs">
          <Link to="/app">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export function ChallengeUnavailablePage({ reason = "This challenge is currently in private preview or has concluded." }: { reason?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-4">
        <FileQuestion className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Challenge Unavailable</h2>
      <p className="mt-2 text-xs text-muted-foreground max-w-md">{reason}</p>
      <div className="mt-5 flex items-center gap-3">
        <Button size="sm" asChild className="text-xs">
          <Link to="/challenges">Browse Open Challenges</Link>
        </Button>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an uncaught render error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
          <p className="mt-2 text-xs text-muted-foreground max-w-md">
            An unexpected client render issue occurred. You can retry the operation or return to your workspace.
          </p>
          {this.state.error?.message && (
            <pre className="mt-3 p-2.5 bg-muted/60 border border-border/60 rounded text-[11px] font-mono text-muted-foreground max-w-md overflow-x-auto">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-5 flex items-center gap-3">
            <Button size="sm" onClick={this.handleReset} className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Reload & Retry
            </Button>
            {/* Plain anchor, not <Link>: this boundary wraps <BrowserRouter>
                in App.tsx precisely so it can catch catastrophic errors
                anywhere, including ones that leave Router context
                unavailable. A <Link> here would itself throw ("Cannot
                destructure property 'basename'...") since it has no Router
                ancestor once this fallback is what's mounted, turning any
                caught error into a second, uncaught crash and a blank
                white screen instead of this fallback UI. */}
            <Button variant="outline" size="sm" asChild className="text-xs">
              <a href="/app">Return Home</a>
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
