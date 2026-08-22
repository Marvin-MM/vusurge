import * as React from "react";
import { Plus, X, Search, Check } from "lucide-react";
import { Skill } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PRESET_SKILLS: Skill[] = [
  { id: "sk-ts", name: "TypeScript / React", category: "ENGINEERING" },
  { id: "sk-py", name: "Python / PyTorch", category: "AI_ML" },
  { id: "sk-llm", name: "LLM Agent Pipelines", category: "AI_ML" },
  { id: "sk-rust", name: "Rust & Systems", category: "ENGINEERING" },
  { id: "sk-wasm", name: "WebAssembly", category: "ENGINEERING" },
  { id: "sk-dist", name: "Distributed Systems", category: "ENGINEERING" },
  { id: "sk-ui", name: "UI/UX & Product Design", category: "DESIGN" },
  { id: "sk-sec", name: "Cybersecurity & Cryptography", category: "ENGINEERING" },
  { id: "sk-iot", name: "Embedded IoT & Hardware", category: "ENGINEERING" },
  { id: "sk-bio", name: "Biomedical Informatics", category: "AI_ML" },
  { id: "sk-quant", name: "Quantum Algorithms", category: "AI_ML" },
  { id: "sk-pm", name: "Technical Product Management", category: "PRODUCT" },
  { id: "sk-vc", name: "Venture Architecture", category: "BUSINESS" },
  { id: "sk-sol", name: "Solidity / Smart Contracts", category: "ENGINEERING" },
];

export interface SkillPickerProps {
  selectedSkills: Skill[] | string[];
  onChange: (skills: Skill[]) => void;
  maxSkills?: number;
  className?: string;
}

export function SkillPicker({
  selectedSkills,
  onChange,
  maxSkills = 10,
  className,
}: SkillPickerProps) {
  const [search, setSearch] = React.useState("");
  const [customCategory, setCustomCategory] = React.useState<Skill["category"]>("ENGINEERING");

  // Normalize selectedSkills to Skill[]
  const normalizedSelected: Skill[] = React.useMemo(() => {
    return selectedSkills.map((s) => {
      if (typeof s === "string") {
        const found = PRESET_SKILLS.find((ps) => ps.name.toLowerCase() === s.toLowerCase());
        return found || { id: `custom-${s}`, name: s, category: "OTHER" as const };
      }
      return s;
    });
  }, [selectedSkills]);

  const handleTogglePreset = (preset: Skill) => {
    const isSelected = normalizedSelected.some(
      (s) => s.id === preset.id || s.name.toLowerCase() === preset.name.toLowerCase()
    );
    if (isSelected) {
      onChange(normalizedSelected.filter((s) => s.id !== preset.id && s.name.toLowerCase() !== preset.name.toLowerCase()));
    } else {
      if (normalizedSelected.length >= maxSkills) return;
      onChange([...normalizedSelected, preset]);
    }
  };

  const handleAddCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = search.trim();
    if (!clean) return;
    if (normalizedSelected.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
      setSearch("");
      return;
    }
    if (normalizedSelected.length >= maxSkills) return;

    const newSkill: Skill = {
      id: `custom-${Date.now()}`,
      name: clean,
      category: customCategory,
    };

    onChange([...normalizedSelected, newSkill]);
    setSearch("");
  };

  const handleRemove = (skillNameOrId: string) => {
    onChange(normalizedSelected.filter((s) => s.id !== skillNameOrId && s.name !== skillNameOrId));
  };

  const filteredPresets = PRESET_SKILLS.filter(
    (ps) =>
      search === "" ||
      ps.name.toLowerCase().includes(search.toLowerCase()) ||
      ps.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and custom add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search skills or type custom skill and press Add..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustom();
              }
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleAddCustom}
          disabled={!search.trim() || normalizedSelected.length >= maxSkills}
          className="h-9 gap-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add</span>
        </Button>
      </div>

      {/* Selected badges */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Selected Skills ({normalizedSelected.length}/{maxSkills}):</span>
          {normalizedSelected.length >= maxSkills && (
            <span className="text-amber-500 font-semibold">Maximum limit reached</span>
          )}
        </div>

        <div className="min-h-[44px] p-2.5 rounded-xl border border-border/80 bg-muted/20 flex flex-wrap gap-1.5 items-center">
          {normalizedSelected.length === 0 ? (
            <span className="text-xs text-muted-foreground italic px-1">
              No skills selected yet. Choose from presets below or type your own.
            </span>
          ) : (
            normalizedSelected.map((skill) => (
              <span
                key={skill.id || skill.name}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
              >
                <span>{skill.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(skill.id || skill.name)}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Preset suggestions */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Popular Technologies & Domains
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
          {filteredPresets.map((preset) => {
            const isSelected = normalizedSelected.some(
              (s) => s.id === preset.id || s.name.toLowerCase() === preset.name.toLowerCase()
            );
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleTogglePreset(preset)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary font-semibold"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}
              >
                {isSelected && <Check className="h-3 w-3" />}
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
