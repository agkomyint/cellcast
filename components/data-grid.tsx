"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, RotateCcw, Search } from "lucide-react";
export type GridColumn = {
  key: string;
  label: string;
  render?: (row: Record<string, string | number>) => React.ReactNode;
};
export function DataGrid({
  id,
  title,
  columns,
  rows,
  rowHeight = 38,
}: {
  id: string;
  title: string;
  columns: GridColumn[];
  rows: Record<string, string | number>[];
  rowHeight?: number;
}) {
  const [query, setQuery] = useState(""),
    [zoom, setZoom] = useState(1),
    [ready, setReady] = useState(false),
    [sort, setSort] = useState<{ key: string; ascending: boolean }>();
  const container = useRef<HTMLDivElement>(null);
  const scroll = useRef({ top: 0, left: 0 });
  const zoomAnchor = useRef<number | undefined>(undefined);
  const changeZoom = (value: number) => {
    zoomAnchor.current = (container.current?.scrollTop || 0) / zoom;
    setZoom(value);
  };
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`cellcast-table-${id}`) || "{}",
      );
      if (typeof saved.query === "string") setQuery(saved.query);
      if (
        typeof saved.zoom === "number" &&
        saved.zoom >= 0.8 &&
        saved.zoom <= 1.6
      )
        setZoom(saved.zoom);
      if (
        columns.some((c) => c.key === saved.sort?.key) &&
        typeof saved.sort?.ascending === "boolean"
      )
        setSort(saved.sort);
    } catch {}
    setReady(true);
  }, [id]); // Each table owns its controls and saved state.
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          `cellcast-table-${id}`,
          JSON.stringify({ query, zoom, sort, scroll: scroll.current }),
        );
      } catch {}
  }, [id, query, zoom, sort, ready]);
  useLayoutEffect(() => {
    const element = container.current;
    try {
      const saved = JSON.parse(
        localStorage.getItem(`cellcast-table-${id}`) || "{}",
      );
      if (
        Number.isFinite(saved.scroll?.top) &&
        Number.isFinite(saved.scroll?.left)
      ) {
        scroll.current = saved.scroll;
        requestAnimationFrame(() =>
          container.current?.scrollTo({
            top: saved.scroll.top,
            left: saved.scroll.left,
          }),
        );
      }
    } catch {}
    return () => {
      clearTimeout(saveTimer.current);
      try {
        const saved = JSON.parse(
          localStorage.getItem(`cellcast-table-${id}`) || "{}",
        );
        localStorage.setItem(
          `cellcast-table-${id}`,
          JSON.stringify({
            ...saved,
            scroll: {
              top: element?.scrollTop ?? scroll.current.top,
              left: element?.scrollLeft ?? scroll.current.left,
            },
          }),
        );
      } catch {}
    };
  }, [id]);
  const filtered = useMemo(() => {
    const values = rows.filter(
      (r) =>
        !query ||
        Object.values(r).some((v) =>
          String(v).toLowerCase().includes(query.toLowerCase()),
        ),
    );
    if (sort)
      values.sort((a, b) => {
        const x = a[sort.key],
          y = b[sort.key];
        const value =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y), undefined, { numeric: true });
        return sort.ascending ? value : -value;
      });
    return values;
  }, [rows, query, sort]);
  const virtual = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => container.current,
    estimateSize: () => Math.round(rowHeight * zoom),
    overscan: 10,
  });
  useEffect(() => {
    virtual.measure();
    if (zoomAnchor.current !== undefined) {
      container.current?.scrollTo({ top: zoomAnchor.current * zoom });
      zoomAnchor.current = undefined;
    }
  }, [zoom, virtual]);
  return (
    <section className="data-grid" aria-label={`${title} table`}>
      <div className="grid-toolbar">
        <div className="grid-search">
          <Search size={14} />
          <Input
            aria-label={`Search ${title}`}
            placeholder={`Search ${title.toLowerCase()}…`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              container.current?.scrollTo({ top: 0 });
            }}
          />
        </div>
        <span>{filtered.length.toLocaleString()} rows</span>
        <div className="grid-zoom">
          <Button
            variant="outline"
            size="icon"
            aria-label={`Zoom out ${title}`}
            disabled={zoom <= 0.8}
            onClick={() =>
              changeZoom(Math.max(0.8, Math.round((zoom - 0.1) * 10) / 10))
            }
          >
            <Minus />
          </Button>
          <output aria-label={`${title} zoom`}>
            {Math.round(zoom * 100)}%
          </output>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Zoom in ${title}`}
            disabled={zoom >= 1.6}
            onClick={() =>
              changeZoom(Math.min(1.6, Math.round((zoom + 0.1) * 10) / 10))
            }
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Reset ${title} table`}
            onClick={() => {
              setZoom(1);
              setQuery("");
              setSort(undefined);
              container.current?.scrollTo({ top: 0, left: 0 });
            }}
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
      <div
        ref={container}
        className="grid-viewport"
        onScroll={(e) => {
          scroll.current = {
            top: e.currentTarget.scrollTop,
            left: e.currentTarget.scrollLeft,
          };
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            try {
              const saved = JSON.parse(
                localStorage.getItem(`cellcast-table-${id}`) || "{}",
              );
              localStorage.setItem(
                `cellcast-table-${id}`,
                JSON.stringify({ ...saved, scroll: scroll.current }),
              );
            } catch {}
          }, 150);
        }}
        tabIndex={0}
        aria-label={`${title} scroll area`}
        style={{ fontSize: `${12 * zoom}px` }}
      >
        <div
          role="table"
          aria-label={title}
          aria-rowcount={filtered.length + 1}
          className="grid-inner"
          style={{ minWidth: Math.max(440, columns.length * 155) * zoom }}
        >
          <div
            role="row"
            className="grid-header"
            style={{
              gridTemplateColumns: `repeat(${columns.length},minmax(0,1fr))`,
            }}
          >
            {columns.map((c) => (
              <Button
                key={c.key}
                variant="ghost"
                role="columnheader"
                aria-sort={
                  sort?.key === c.key
                    ? sort.ascending
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                onClick={() =>
                  setSort({
                    key: c.key,
                    ascending: sort?.key === c.key ? !sort.ascending : true,
                  })
                }
              >
                {c.label}
                {sort?.key === c.key ? (sort.ascending ? " ↑" : " ↓") : ""}
              </Button>
            ))}
          </div>
          <div style={{ height: virtual.getTotalSize(), position: "relative" }}>
            {virtual.getVirtualItems().map((item) => (
              <div
                key={item.key}
                role="row"
                aria-rowindex={item.index + 2}
                className="grid-row"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: item.size,
                  transform: `translateY(${item.start}px)`,
                  gridTemplateColumns: `repeat(${columns.length},minmax(0,1fr))`,
                }}
              >
                {columns.map((c) => (
                  <div
                    role="cell"
                    key={c.key}
                    title={String(filtered[item.index][c.key] ?? "")}
                  >
                    {c.render
                      ? c.render(filtered[item.index])
                      : filtered[item.index][c.key]}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        {!filtered.length && (
          <div className="empty">
            No matching rows. Clear this table’s search to show all rows.
          </div>
        )}
      </div>
    </section>
  );
}
