import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LifeBuoy, ArrowLeft, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import {
  usePlatformSupportTickets,
  usePlatformSupportTicket,
  useChangeTicketStatus,
  useSetTicketPriority,
  useResolveTicket,
  useAddTicketComment,
  useAddTicketInternalNote,
} from "@/features/superadmin/api/queries";
import { SupportTicket } from "@/types";
import { toast } from "sonner";

const STATUS_OPTIONS: SupportTicket["status"][] = ["OPEN", "TRIAGED", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS: SupportTicket["priority"][] = ["LOW", "NORMAL", "HIGH", "URGENT"];

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "bg-destructive/10 text-destructive border-destructive/20",
  HIGH: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  NORMAL: "bg-muted text-muted-foreground border-border",
  LOW: "bg-muted text-muted-foreground border-border",
};

function TicketDetail({ ticketId }: { ticketId: string }) {
  const navigate = useNavigate();
  const { data: ticket, isLoading } = usePlatformSupportTicket(ticketId);
  const changeStatusMutation = useChangeTicketStatus(ticketId);
  const setPriorityMutation = useSetTicketPriority(ticketId);
  const resolveMutation = useResolveTicket(ticketId);
  const commentMutation = useAddTicketComment(ticketId);
  const noteMutation = useAddTicketInternalNote(ticketId);

  const [commentBody, setCommentBody] = React.useState("");
  const [noteBody, setNoteBody] = React.useState("");
  const [resolutionSummary, setResolutionSummary] = React.useState("");

  if (isLoading || !ticket) {
    return <div className="py-16 text-center text-xs text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/support")} className="text-xs h-8 gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Tickets</span>
      </Button>

      <Card className="p-6 border-border space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-black text-foreground">{ticket.subject}</h2>
          <div className="flex items-center gap-2">
            <Select value={ticket.status} onValueChange={(v: any) => changeStatusMutation.mutate(v, { onSuccess: () => toast.success("Status updated.") })}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={ticket.priority} onValueChange={(v: any) => setPriorityMutation.mutate(v, { onSuccess: () => toast.success("Priority updated.") })}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">{ticket.category.replace(/_/g, " ")}</Badge>
          <span>Opened {new Date(ticket.createdAt).toLocaleString()}</span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
        {ticket.resolutionSummary && (
          <div className="pt-3 border-t border-border/60 text-xs">
            <span className="font-bold text-foreground">Resolution: </span>
            <span className="text-muted-foreground">{ticket.resolutionSummary}</span>
          </div>
        )}
      </Card>

      <Card className="p-5 border-border space-y-3">
        <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5" />
          Reply to User
        </div>
        <Textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Write a user-visible reply..." className="text-xs min-h-20" />
        <Button
          size="sm"
          disabled={!commentBody.trim() || commentMutation.isPending}
          onClick={() => commentMutation.mutate(commentBody, { onSuccess: () => { setCommentBody(""); toast.success("Reply sent."); } })}
          className="text-xs"
        >
          Send Reply
        </Button>
      </Card>

      <Card className="p-5 border-border space-y-3 bg-muted/20">
        <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          Internal Note (staff-only)
        </div>
        <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Internal note, not visible to the user..." className="text-xs min-h-20" />
        <Button
          variant="outline"
          size="sm"
          disabled={!noteBody.trim() || noteMutation.isPending}
          onClick={() => noteMutation.mutate(noteBody, { onSuccess: () => { setNoteBody(""); toast.success("Note added."); } })}
          className="text-xs"
        >
          Add Internal Note
        </Button>
      </Card>

      {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
        <Card className="p-5 border-border space-y-3">
          <div className="text-xs font-bold text-foreground">Resolve Ticket</div>
          <Textarea value={resolutionSummary} onChange={(e) => setResolutionSummary(e.target.value)} placeholder="Resolution summary..." className="text-xs min-h-16" />
          <Button
            size="sm"
            disabled={resolutionSummary.trim().length < 3 || resolveMutation.isPending}
            onClick={() => resolveMutation.mutate(resolutionSummary, { onSuccess: () => { toast.success("Ticket resolved."); setResolutionSummary(""); } })}
            className="text-xs"
          >
            Mark Resolved
          </Button>
        </Card>
      )}
    </div>
  );
}

export function AdminSupportPage() {
  const navigate = useNavigate();
  const { ticketId } = useParams<{ ticketId: string }>();
  const { items: tickets, isLoading, hasMore, loadMore, isLoadingMore } = usePlatformSupportTickets();

  if (ticketId) {
    return (
      <PageContainer>
        <TicketDetail ticketId={ticketId} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Support & Operations" description="Triage support tickets across the platform." />

      <Card className="border-border">
        <CardContent className="p-0 divide-y divide-border/60">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-xs">
              <LifeBuoy className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No support tickets.
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate(`/admin/support/${t.id}`)}
                className="p-4 flex items-center justify-between gap-4 text-xs cursor-pointer hover:bg-accent/40"
              >
                <div>
                  <div className="font-bold text-foreground">{t.subject}</div>
                  <div className="text-muted-foreground">{t.category.replace(/_/g, " ")} · {new Date(t.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLE[t.priority] || ""}`}>{t.priority}</Badge>
                  <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
    </PageContainer>
  );
}
