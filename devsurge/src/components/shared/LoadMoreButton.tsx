import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadMoreButtonProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  onClick: () => void;
  className?: string;
}

/** Shared "load more" control for every cursor-paginated list — see useCursorList. */
export function LoadMoreButton({ hasMore, isLoadingMore, onClick, className }: LoadMoreButtonProps) {
  if (!hasMore) return null;

  return (
    <div className={className ?? "flex justify-center pt-6"}>
      <Button variant="outline" size="sm" onClick={onClick} disabled={isLoadingMore} className="gap-2 text-xs">
        {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <span>{isLoadingMore ? "Loading…" : "Load More"}</span>
      </Button>
    </div>
  );
}
