import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, User, Shield, XCircle, RotateCcw, Paperclip, X, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  useSupportTicket,
  useAddTicketComment,
  useCloseSupportTicket,
  useReopenSupportTicket,
  formatAttachmentReference,
  parseCommentAttachments,
} from "@/features/notifications/api/queries";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/features/users/api/queries";
import { EmptyState } from "@/components/feedback/EmptyState";
import { toast } from "sonner";
import { useUploadPrivateFile, useRequestPrivateFileDownload } from "@/lib/fileUpload";

function CommentAttachment({ fileId, displayName }: { fileId: string; displayName: string }) {
  const downloadMutation = useRequestPrivateFileDownload();

  const handleDownload = () => {
    downloadMutation.mutate(fileId, {
      onSuccess: (result) => {
        window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
      },
      onError: (err: any) => {
        if (err?.code === "FILE_SCAN_PENDING") {
          toast.info("This attachment is still being scanned for malware. Try again shortly.");
        } else if (err?.code === "FILE_QUARANTINED") {
          toast.error("This attachment failed malware scanning and cannot be downloaded.");
        } else {
          toast.error(err?.message || "Failed to fetch download link.");
        }
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloadMutation.isPending}
      className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md border border-border bg-background text-[11px] font-medium text-foreground hover:border-primary/40 disabled:opacity-60"
    >
      {downloadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3 text-primary" />}
      <span>{displayName}</span>
      <Download className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}

function CommentAuthor({ authorUserId, isMe }: { authorUserId: string; isMe: boolean }) {
  const { data: profile } = useUserProfile(authorUserId);
  return <>{isMe ? "You" : profile?.displayName || "Support Team"}</>;
}

export function SupportTicketDetailPage() {
  const { ticketId = "" } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useSupportTicket(ticketId);
  const addCommentMutation = useAddTicketComment();
  const closeMutation = useCloseSupportTicket();
  const reopenMutation = useReopenSupportTicket();

  const [replyText, setReplyText] = React.useState("");
  const [pendingAttachment, setPendingAttachment] = React.useState<{ fileId: string; displayName: string } | null>(null);
  const uploadMutation = useUploadPrivateFile();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="py-20 text-center text-xs text-muted-foreground">Loading support thread...</div>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        <EmptyState
          title="Ticket Not Found"
          description="The requested support ticket does not exist or has been archived."
          action={{ label: "Back to Support Desk", onClick: () => navigate("/app/support") }}
        />
      </PageContainer>
    );
  }

  const { ticket, comments } = data;

  const handleSendReply = () => {
    const body = replyText.trim() || (pendingAttachment ? "Attached a file." : "");
    if (!body) return;
    const fullBody = pendingAttachment
      ? `${body}\n\n${formatAttachmentReference(pendingAttachment.fileId, pendingAttachment.displayName)}`
      : body;
    addCommentMutation.mutate(
      { ticketId: ticket.id, body: fullBody },
      {
        onSuccess: () => {
          setReplyText("");
          setPendingAttachment(null);
          toast.success("Reply posted.");
        },
        onError: (err: any) => toast.error(err?.message || "Failed to post reply."),
      }
    );
  };

  const handleAttachFile = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !ticket.organizationId) return;
    uploadMutation.mutate(
      {
        purpose: "SUPPORT_ATTACHMENT",
        organizationId: ticket.organizationId,
        resourceId: ticket.id,
        challengeId: ticket.challengeId ?? undefined,
        file,
      },
      {
        onSuccess: (asset) => {
          setPendingAttachment({ fileId: asset.id, displayName: asset.displayName });
          toast.success("File uploaded — it will be scanned for malware before it's downloadable.");
        },
        onError: (err: any) => toast.error(err?.message || "Failed to upload attachment."),
      }
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isClosed = ticket.status === "CLOSED";

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/support")} className="text-xs h-8 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Support Tickets</span>
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs uppercase">{ticket.category}</Badge>
          <Badge variant="default" className="text-xs font-bold">{ticket.status}</Badge>
          {isClosed ? (
            <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate(ticket.id)} disabled={reopenMutation.isPending} className="text-xs h-8 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reopen</span>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => closeMutation.mutate(ticket.id)} disabled={closeMutation.isPending} className="text-xs h-8 gap-1.5">
              <XCircle className="h-3.5 w-3.5" />
              <span>Close Ticket</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border p-6 space-y-4">
        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{ticket.subject}</h1>
          <p className="text-xs text-muted-foreground">Opened on {new Date(ticket.createdAt).toLocaleString()}</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{ticket.description}</p>
        {ticket.resolutionSummary && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-foreground">
            <strong>Resolution:</strong> {ticket.resolutionSummary}
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-foreground">Conversation</h3>

        <div className="space-y-3">
          {comments.map((comment) => {
            const isMe = comment.authorUserId === user?.id;
            const { text, attachments } = parseCommentAttachments(comment.body);
            return (
              <div key={comment.id} className={`p-4 rounded-xl border flex flex-col space-y-2 ${isMe ? "bg-card border-border sm:ml-8" : "bg-primary/5 border-primary/20 sm:mr-8"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isMe ? <User className="h-4 w-4 text-primary" /> : <Shield className="h-4 w-4 text-primary" />}
                    <span className="text-xs font-bold text-foreground">
                      <CommentAuthor authorUserId={comment.authorUserId} isMe={isMe} />
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {text && <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{text}</p>}
                {attachments.map((attachment) => (
                  <CommentAttachment key={attachment.fileId} fileId={attachment.fileId} displayName={attachment.displayName} />
                ))}
              </div>
            );
          })}
          {comments.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">No replies yet.</div>
          )}
        </div>

        {!isClosed && (
          <Card className="border-border p-4 space-y-3">
            <h4 className="text-xs font-bold text-foreground">Add a Reply</h4>
            <Textarea placeholder="Type your reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} className="text-xs min-h-[80px]" />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSendReply} disabled={addCommentMutation.isPending || !replyText.trim()} className="text-xs font-semibold gap-1.5">
                <Send className="h-3 w-3" />
                <span>{addCommentMutation.isPending ? "Sending..." : "Post Reply"}</span>
              </Button>
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
