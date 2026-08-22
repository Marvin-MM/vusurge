import * as React from "react";
import { ChevronDown, HelpCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FAQ } from "@/types";
import { cn } from "@/lib/utils";

export interface FAQItem {
  id?: string;
  question: string;
  answer: string;
  category?: string;
}

export interface FAQListProps {
  items: FAQItem[] | FAQ[];
  categories?: string[];
  allowSearch?: boolean;
  className?: string;
}

export function FAQList({
  items,
  categories,
  allowSearch = false,
  className,
}: FAQListProps) {
  const [openIds, setOpenIds] = React.useState<Record<string, boolean>>({
    "faq-0": true, // open first item by default
  });
  const [search, setSearch] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<string>("ALL");

  const toggle = (id: string) => {
    setOpenIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredItems = items.filter((item, idx) => {
    const id = item.id || `faq-${idx}`;
    const matchesSearch =
      search === "" ||
      item.question.toLowerCase().includes(search.toLowerCase()) ||
      item.answer.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      activeCategory === "ALL" || ("category" in item && item.category === activeCategory);

    return matchesSearch && matchesCategory;
  });

  return (
    <div className={cn("space-y-6", className)}>
      {allowSearch && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions and answers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {categories && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              activeCategory === "ALL"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/70 text-muted-foreground hover:bg-accent"
            )}
          >
            All Questions
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/70 text-muted-foreground hover:bg-accent"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No matching questions found.
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const id = item.id || `faq-${idx}`;
            const isOpen = !!openIds[id];

            return (
              <div
                key={id}
                className="rounded-xl border border-border/80 bg-card overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-bold text-foreground">
                      {item.question}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                      isOpen && "rotate-180 text-primary"
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40 pl-11">
                    <p className="whitespace-pre-line">{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
