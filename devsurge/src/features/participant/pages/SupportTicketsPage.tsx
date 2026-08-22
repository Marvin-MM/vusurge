import * as React from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, Plus, MessageSquare, ArrowRight, FileQuestion, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { useSupportTickets, useCreateSupportTicket } from "@/features/notifications/api/queries";
import { useMyChallengeParticipations } from "@/features/participant/api/queries";
import { SupportTicket } from "@/types";
import { toast } from "sonner";

const CATEGORY_LABEL: Record<SupportTicket["category"], string> = {
  BUG: "Bug Report",
  ACCESS_OR_ACCOUNT: "Access / Account",
  ORGANIZATION_ISSUE: "Organization Issue",
  CHALLENGE_ISSUE: "Challenge Issue",
  ABUSE_OR_SAFETY: "Abuse / Safety",
  FEATURE_REQUEST: "Feature Request",
  OTHER: "Other",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-blue-500 text-white",
  TRIAGED: "bg-blue-500 text-white",
  IN_PROGRESS: "bg-amber-500 text-white",
  WAITING_USER: "bg-amber-500 text-white",
  RESOLVED: "bg-emerald-500 text-white",
  CLOSED: "",
};

export function SupportTicketsPage() {
  const navigate = useNavigate();
  const { items: tickets, isLoading, hasMore, loadMore, isLoadingMore } = useSupportTickets();
  const { data: participations = [] } = useMyChallengeParticipations();
  const createTicketMutation = useCreateSupportTicket();

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [category, setCategory] = React.useState<SupportTicket["category"]>("OTHER");
  const [selectedChallengeId, setSelectedChallengeId] = React.useState("");
  const [description, setDescription] = React.useState("");

  const handleCreateTicket = () => {
    if (!subject.trim() || !description.trim()) {
      toast.error("Please provide both a subject and details for your request.");
      return;
    }
    createTicketMutation.mutate(
      { subject, category, description, challengeId: selectedChallengeId || undefined },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          setSubject("");
          setDescription("");
          toast.success("Support ticket opened.");
        },
        onError: (err: any) => toast.error(err?.message || "Failed to create ticket."),
      }
    );
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Support Desk"
        description="Open help requests for challenge, account, or technical issues."
        actions={
          <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="text-xs font-semibold gap-1.5">
            <Plus className="h-4 w-4" />
            <span>Open New Ticket</span>
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">My Support Tickets</h3>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((n) => <div key={n} className="h-24 rounded-xl bg-muted/40 border border-border animate-pulse" />)}
          </div>
        ) : tickets.length === 0 ? (
          <Card className="p-8 text-center border-dashed space-y-2">
            <FileQuestion className="h-8 w-8 text-muted-foreground mx-auto" />
            <h4 className="text-xs font-bold text-foreground">No tickets yet</h4>
            <p className="text-xs text-muted-foreground">You have not submitted any support tickets.</p>
          </Card>
        ) : (
          <>
            {tickets.map((t) => (
              <Card key={t.id} onClick={() => navigate(`/app/support/${t.id}`)} className="p-4 hover:border-primary/40 transition-colors cursor-pointer space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${STATUS_COLOR[t.status] || ""}`} variant={STATUS_COLOR[t.status] ? "default" : "secondary"}>{t.status}</Badge>
                      <span className="text-[11px] font-semibold text-primary uppercase">{CATEGORY_LABEL[t.category]}</span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground truncate hover:text-primary transition-colors">{t.subject}</h4>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>

                <div className="flex items-center justify-end pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-primary flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>View Conversation</span>
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Card>
            ))}
            <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
          </>
        )}
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span>Open Support Ticket</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Describe your question or issue in detail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Category</label>
              <Select value={category} onValueChange={(v) => setCategory(v as SupportTicket["category"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {participations.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Associated Challenge (Optional)</label>
                <Select value={selectedChallengeId} onValueChange={setSelectedChallengeId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {participations.map((p) => (
                      <SelectItem key={p.challengeId} value={p.challengeId}>{p.challengeTitle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Subject *</label>
              <Input placeholder="Brief summary of your inquiry..." value={subject} onChange={(e) => setSubject(e.target.value)} className="text-xs h-9" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description *</label>
              <Textarea placeholder="Include as much detail as possible..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-xs min-h-[90px]" />
            </div>
          </div>

          <DialogFooter className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)} className="text-xs">Cancel</Button>
            <Button type="button" size="sm" onClick={handleCreateTicket} disabled={createTicketMutation.isPending} className="text-xs font-semibold gap-1.5">
              <Send className="h-3 w-3" />
              <span>{createTicketMutation.isPending ? "Submitting..." : "Open Ticket"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
