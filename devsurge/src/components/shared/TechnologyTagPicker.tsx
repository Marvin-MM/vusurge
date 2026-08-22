import * as React from "react";
import { X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTechnologyTags } from "@/features/users/api/queries";

export interface TechnologyTagPickerProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  className?: string;
}

/** Chip-based multi-select for a submission's tech stack, backed by the real
 * `/meta/technology-tags` catalog. Catalogue-only by design, not a free-text
 * input: the backend rejects `PATCH .../submissions/:id/draft` with a 400
 * ("Technology tag "X" is not in the active catalogue") for any tag name
 * that doesn't case-insensitively match an active `technology_tag` row —
 * confirmed live — so offering a "custom add" affordance here would just
 * hand the user a guaranteed-to-fail action. */
export function TechnologyTagPicker({ selectedTags, onChange, maxTags = 12, className }: TechnologyTagPickerProps) {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { items: catalogTags, isLoading } = useTechnologyTags(debouncedSearch || undefined);

  const handleAdd = (name: string) => {
    if (selectedTags.some((t) => t.toLowerCase() === name.toLowerCase())) return;
    if (selectedTags.length >= maxTags) return;
    onChange([...selectedTags, name]);
    setSearch("");
  };

  const handleRemove = (name: string) => onChange(selectedTags.filter((t) => t !== name));

  const suggestions = catalogTags.filter((t) => !selectedTags.some((s) => s.toLowerCase() === t.name.toLowerCase()));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search the technology catalog..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={selectedTags.length >= maxTags}
          className="pl-9 h-9 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Technologies ({selectedTags.length}/{maxTags}):</span>
          {selectedTags.length >= maxTags && <span className="text-amber-500 font-semibold">Maximum limit reached</span>}
        </div>
        <div className="min-h-[44px] p-2.5 rounded-xl border border-border/80 bg-muted/20 flex flex-wrap gap-1.5 items-center">
          {selectedTags.length === 0 ? (
            <span className="text-xs text-muted-foreground italic px-1">
              No technologies added yet. Search the catalog below to add some.
            </span>
          ) : (
            selectedTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <span>{tag}</span>
                <button type="button" onClick={() => handleRemove(tag)} className="hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {selectedTags.length < maxTags && (suggestions.length > 0 || isLoading) && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {debouncedSearch ? "Matching Technologies" : "Popular Technologies"}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
            {isLoading && suggestions.length === 0 ? (
              <span className="text-[11px] text-muted-foreground px-1">Searching...</span>
            ) : suggestions.length === 0 ? (
              <span className="text-[11px] text-muted-foreground px-1">No matching technologies in the catalog.</span>
            ) : (
              suggestions.slice(0, 30).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleAdd(tag.name)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  <span>{tag.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
