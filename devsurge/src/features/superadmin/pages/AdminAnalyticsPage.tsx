import { Building2, FileCheck2, Flag, ShieldCheck, Trophy, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { StatCard } from "@/components/shared/StatCard";
import { PlatformAccessGuard } from "@/features/superadmin/components/PlatformAccessGuard";
import { usePlatformAnalyticsSummary } from "@/features/superadmin/api/queries";

function AdminAnalyticsContent() {
  const { data, isLoading } = usePlatformAnalyticsSummary();
  if (isLoading || !data) return <PageContainer><div className="h-48 rounded-xl bg-muted/40 animate-pulse" /></PageContainer>;

  const verificationRate = data.users === 0 ? 0 : Math.round((data.verifiedUsers / data.users) * 100);
  const twoFactorRate = data.users === 0 ? 0 : Math.round((data.usersWithTwoFactor / data.users) * 100);

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Platform Analytics" description="Live operational totals across every tenant, generated from authoritative records." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Users" value={data.users} description={`${verificationRate}% email verified`} icon={Users} />
        <StatCard title="2FA adoption" value={`${twoFactorRate}%`} description={`${data.usersWithTwoFactor} enabled`} icon={ShieldCheck} />
        <StatCard title="Active organizations" value={data.activeOrganizations} description={`${data.suspendedOrganizations} suspended`} icon={Building2} />
        <StatCard title="Challenges" value={data.challenges} description={`${data.publicChallenges} public`} icon={Trophy} />
        <StatCard title="Active participations" value={data.activeParticipations} icon={Users} />
        <StatCard title="Final submissions" value={data.finalizedSubmissions} icon={FileCheck2} />
        <StatCard title="Open reports" value={data.openReports} icon={Flag} />
        <StatCard title="Open support tickets" value={data.openSupportTickets} icon={Flag} />
      </div>
      <Card className="p-4 text-xs text-muted-foreground">
        Generated {new Date(data.generatedAt).toLocaleString()}. These are operational counts, not a replacement for privacy-reviewed BI exports or long-term time-series reporting.
      </Card>
    </PageContainer>
  );
}

export function AdminAnalyticsPage() {
  return <PlatformAccessGuard anyOf={["platform.manage_organizations"]}><AdminAnalyticsContent /></PlatformAccessGuard>;
}
