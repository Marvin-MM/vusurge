import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrganizationApplicationForm } from "@/features/participant/components/OrganizationApplicationForm";

export function ApplyOrganizationPage() {
  const navigate = useNavigate();

  return (
    <PageContainer className="space-y-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app")} className="text-xs h-8 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Button>

        <PageHeader
          title="Apply to Create an Organization"
          description="Host challenges, manage members, and run judging under your own organization on DevArena."
        />

        <OrganizationApplicationForm onSubmitted={() => setTimeout(() => navigate("/app"), 2500)} />
      </div>
    </PageContainer>
  );
}
