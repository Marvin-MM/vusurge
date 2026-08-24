import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Search, Trophy, Building2, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePublicSearch } from "@/features/public/api/queries";
import { getDisplayStatus } from "@/lib/challengeStatus";
import { ChallengeStatusBadge } from "@/components/shared/StatusBadge";

/**
 * Search is a lookup, not a destination — running it in place keeps the
 * reader where they were and gets them to the actual challenge or
 * organization in one step. Results are live (debounced) rather than
 * submit-then-render, since the backend search endpoint is a cheap public
 * text query.
 */
export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [input, setInput] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);

  // Start each visit clean rather than showing the previous search's results.
  React.useEffect(() => {
    if (!open) {
      setInput("");
      setDebounced("");
    }
  }, [open]);

  const { data, isFetching } = usePublicSearch(debounced);

  const challenges = data?.challenges ?? [];
  const organizations = data?.organizations ?? [];
  const total = challenges.length + organizations.length;

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Search</DialogTitle>

        <div className="relative border-b border-border">
          <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          {isFetching && debounced && (
            <Loader2 className="h-4 w-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
          )}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search challenges and organizations..."
            className="pl-11 pr-11 h-14 text-sm border-0 focus-visible:ring-0 rounded-none bg-transparent"
            autoFocus
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!debounced ? (
            <div className="p-10 text-center text-xs text-muted-foreground">
              Start typing to find challenges and organizations.
            </div>
          ) : total === 0 && !isFetching ? (
            <div className="p-10 text-center text-xs text-muted-foreground">
              No results for &ldquo;{debounced}&rdquo;.
            </div>
          ) : (
            <div className="py-2">
              {challenges.length > 0 && (
                <div className="px-2 pb-2">
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Trophy className="h-3 w-3" />
                    <span>Challenges</span>
                  </div>
                  {challenges.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => go(`/challenges/${c.organizationSlug}/${c.slug}`)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent/60 transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-bold text-foreground truncate">{c.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {c.organizationName}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <ChallengeStatusBadge status={getDisplayStatus(c)} />
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {organizations.length > 0 && (
                <div className="px-2 pb-2">
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" />
                    <span>Organizations</span>
                  </div>
                  {organizations.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => go(`/organizations/${o.slug}`)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent/60 transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-bold text-foreground truncate">{o.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {o.organizationType?.replace(/_/g, " ")}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
