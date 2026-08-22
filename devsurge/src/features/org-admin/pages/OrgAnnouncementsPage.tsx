import * as React from "react";
import { useParams } from "react-router-dom";
import { Megaphone, HelpCircle, Plus, Trash2, Send, Pencil, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import {
  useOrgAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  usePublishAnnouncement,
  useUnpublishAnnouncement,
  useOrgFaqs,
  useCreateFaq,
  useUpdateFaq,
  useDeleteFaq,
} from "@/features/org-admin/api/queries";
import { Announcement, FAQ } from "@/types";
import { toast } from "sonner";

export function OrgAnnouncementsPage() {
  const { orgId = "", challengeId } = useParams<{ orgId: string; challengeId?: string }>();
  const { items: announcements, hasMore, loadMore, isLoadingMore } = useOrgAnnouncements(orgId, challengeId);
  const createAnnMutation = useCreateAnnouncement(orgId);
  const updateAnnMutation = useUpdateAnnouncement(orgId);
  const publishAnnMutation = usePublishAnnouncement(orgId);
  const unpublishAnnMutation = useUnpublishAnnouncement(orgId);
  const { data: faqs = [] } = useOrgFaqs(orgId, challengeId);
  const createFaqMutation = useCreateFaq(orgId);
  const updateFaqMutation = useUpdateFaq(orgId);
  const deleteFaqMutation = useDeleteFaq(orgId);

  const [annDialogOpen, setAnnDialogOpen] = React.useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = React.useState<Announcement | null>(null);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [priority, setPriority] = React.useState("NORMAL");

  const [faqDialogOpen, setFaqDialogOpen] = React.useState(false);
  const [editingFaq, setEditingFaq] = React.useState<FAQ | null>(null);
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");

  const openCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    setTitle("");
    setBody("");
    setPriority("NORMAL");
    setAnnDialogOpen(true);
  };

  const openEditAnnouncement = (a: Announcement) => {
    setEditingAnnouncement(a);
    setTitle(a.title);
    setBody(a.body);
    setPriority(a.priority);
    setAnnDialogOpen(true);
  };

  const openCreateFaq = () => {
    setEditingFaq(null);
    setQuestion("");
    setAnswer("");
    setFaqDialogOpen(true);
  };

  const openEditFaq = (f: FAQ) => {
    setEditingFaq(f);
    setQuestion(f.question);
    setAnswer(f.answer);
    setFaqDialogOpen(true);
  };

  return (
    <OrgAccessGuard permission="organization.manage_announcements" title="Announcements Restricted" description="You require Organization Admin privileges to manage announcements and FAQs.">
      <PageContainer className="space-y-6">
        <PageHeader title="Announcements & FAQs" description="Broadcast updates and answer common questions for participants." />

        <Tabs defaultValue="announcements" className="space-y-6">
          <TabsList>
            <TabsTrigger value="announcements" className="text-xs gap-1.5">
              <Megaphone className="h-3.5 w-3.5" />
              Announcements
            </TabsTrigger>
            <TabsTrigger value="faqs" className="text-xs gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreateAnnouncement} className="text-xs font-semibold gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Announcement
              </Button>
            </div>
            <Card className="border-border">
              <CardContent className="p-0 divide-y divide-border/60">
                {announcements.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No announcements yet.</div>
                ) : (
                  announcements.map((a) => (
                    <div key={a.id} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-foreground">{a.title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px]">{a.priority}</Badge>
                          {a.isPublished ? (
                            <>
                              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-none">Published</Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => unpublishAnnMutation.mutate(a.id, { onSuccess: () => toast.success("Unpublished.") })}
                                className="text-xs h-7 gap-1"
                              >
                                <EyeOff className="h-3 w-3" />
                                Unpublish
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => publishAnnMutation.mutate(a.id, { onSuccess: () => toast.success("Published.") })} className="text-xs h-7 gap-1">
                              <Send className="h-3 w-3" />
                              Publish
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEditAnnouncement(a)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.body}</p>
                      <div className="text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
          </TabsContent>

          <TabsContent value="faqs" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreateFaq} className="text-xs font-semibold gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New FAQ
              </Button>
            </div>
            <Card className="border-border">
              <CardContent className="p-0 divide-y divide-border/60">
                {faqs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No FAQs yet.</div>
                ) : (
                  faqs.map((f) => (
                    <div key={f.id} className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-foreground">{f.question}</div>
                        <p className="text-xs text-muted-foreground">{f.answer}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEditFaq(f)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteFaqMutation.mutate(f.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={annDialogOpen} onOpenChange={setAnnDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="text-base font-bold">{editingAnnouncement ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="text-xs h-9" />
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body" className="text-xs min-h-[90px]" />
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setAnnDialogOpen(false)} className="text-xs">Cancel</Button>
              <Button
                size="sm"
                disabled={!title.trim() || !body.trim() || createAnnMutation.isPending || updateAnnMutation.isPending}
                onClick={() => {
                  if (editingAnnouncement) {
                    updateAnnMutation.mutate(
                      { announcementId: editingAnnouncement.id, payload: { title, body, priority } },
                      { onSuccess: () => { setAnnDialogOpen(false); toast.success("Announcement updated."); }, onError: (err: any) => toast.error(err?.message || "Failed to update.") },
                    );
                  } else {
                    createAnnMutation.mutate(
                      { challengeId, title, body, priority },
                      { onSuccess: () => { setAnnDialogOpen(false); setTitle(""); setBody(""); toast.success("Announcement created."); } }
                    );
                  }
                }}
                className="text-xs font-semibold"
              >
                {editingAnnouncement ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={faqDialogOpen} onOpenChange={setFaqDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="text-base font-bold">{editingFaq ? "Edit FAQ" : "New FAQ"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question" className="text-xs h-9" />
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer" className="text-xs min-h-[90px]" />
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setFaqDialogOpen(false)} className="text-xs">Cancel</Button>
              <Button
                size="sm"
                disabled={!question.trim() || !answer.trim() || createFaqMutation.isPending || updateFaqMutation.isPending}
                onClick={() => {
                  if (editingFaq) {
                    updateFaqMutation.mutate(
                      { faqId: editingFaq.id, payload: { question, answer } },
                      { onSuccess: () => { setFaqDialogOpen(false); toast.success("FAQ updated."); }, onError: (err: any) => toast.error(err?.message || "Failed to update.") },
                    );
                  } else {
                    createFaqMutation.mutate(
                      { challengeId, question, answer },
                      { onSuccess: () => { setFaqDialogOpen(false); setQuestion(""); setAnswer(""); toast.success("FAQ created."); } }
                    );
                  }
                }}
                className="text-xs font-semibold"
              >
                {editingFaq ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </OrgAccessGuard>
  );
}
