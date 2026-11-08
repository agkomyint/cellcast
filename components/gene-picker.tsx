"use client";
import { useEffect, useId, useState } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Gene = { id: string; label: string };
export function GenePicker({
  studyId,
  value,
  onChange,
  disabled,
}: {
  studyId: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [genes, setGenes] = useState<Gene[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [active, setActive] = useState(0),
    [selected, setSelected] = useState<Gene>();
  const id = useId();
  const manual =
    /^(AT\dG\d+|ENS[A-Z0-9]+|Os\d+g\d+|LOC_[A-Za-z0-9_.]+)$/i.test(query) &&
    !genes.some((g) => g.id.toLowerCase() === query.toLowerCase())
      ? { id: query, label: "Use this source identifier" }
      : undefined;
  const options = manual ? [...genes, manual] : genes;
  useEffect(() => {
    setSelected(undefined);
    setOpen(false);
    setQuery("");
  }, [studyId]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setActive(0);
    const timer = setTimeout(
      async () => {
        try {
          const r = await fetch(
            `/api/datasets/${studyId}/genes?q=${encodeURIComponent(query)}`,
            { signal: controller.signal },
          );
          const data = await r.json();
          if (!r.ok) throw Error(data.error || "Gene search unavailable");
          setGenes(data.suggestions);
        } catch (e) {
          if (!controller.signal.aborted) {
            setError(e instanceof Error ? e.message : String(e));
            setGenes([]);
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, studyId]);
  const choose = (gene: Gene) => {
    onChange(gene.id);
    setSelected(gene);
    setOpen(false);
    setQuery("");
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          className="gene-picker-trigger"
          role="combobox"
          aria-label="Choose gene"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          disabled={disabled}
        >
          <span>
            {selected?.id === value && selected.label !== value ? (
              <>
                {selected.label}
                <small>{value}</small>
              </>
            ) : (
              value || "Choose a gene…"
            )}
          </span>
          <ChevronsUpDown size={14} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="gene-picker-popover"
          sideOffset={6}
          align="start"
          collisionPadding={12}
        >
          <div className="gene-search">
            <Search size={15} />
            <Input
              autoFocus
              aria-label="Search genes"
              placeholder="Search gene name or ID…"
              value={query}
              aria-controls={`${id}-list`}
              aria-activedescendant={
                options[active] ? `${id}-${active}` : undefined
              }
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const next =
                    (active +
                      (e.key === "ArrowDown" ? 1 : -1) +
                      options.length) %
                    Math.max(options.length, 1);
                  setActive(next);
                  document
                    .getElementById(`${id}-${next}`)
                    ?.scrollIntoView({ block: "nearest" });
                }
                if (e.key === "Enter" && options[active] && !loading) {
                  e.preventDefault();
                  choose(options[active]);
                }
              }}
            />
          </div>
          <div className="gene-picker-heading">
            {query ? "Matching genes" : "Suggested starting genes"}
          </div>
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label="Gene suggestions"
            className="gene-options"
          >
            {loading ? (
              <p role="status">Searching the repository…</p>
            ) : options.length ? (
              options.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={active === i}
                  className={active === i ? "highlighted" : ""}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(g)}
                >
                  <span>
                    <b>{g.label}</b>
                    {g.label !== g.id && <small>{g.id}</small>}
                  </span>
                  {g.id === value && <Check size={14} />}
                </button>
              ))
            ) : (
              <p>
                {error ||
                  "No matches. Try another gene name or a source identifier."}
              </p>
            )}
          </div>
          <p className="gene-picker-note">
            Suggestions match the study’s organism. Expression availability is
            checked when you run.
          </p>
          <Popover.Arrow className="gene-picker-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
