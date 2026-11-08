"use client";
import { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import {
  OrthographicView,
  type OrthographicViewState,
  type PickingInfo,
} from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { CellPoint } from "@/lib/atlas";
import { Button } from "@/components/ui/button";
import { Minus, Plus, RotateCcw } from "lucide-react";
const palette: [number, number, number][] = [
  [102, 223, 208],
  [172, 155, 234],
  [148, 214, 170],
  [221, 168, 117],
  [102, 177, 231],
  [230, 145, 173],
  [190, 207, 121],
  [157, 174, 223],
  [225, 192, 127],
  [118, 207, 177],
];
export default function CellScatter({
  points,
  expression = false,
  filter = "",
  onSelect,
  id = "synthetic-landscape",
}: {
  points: CellPoint[];
  expression?: boolean;
  filter?: string;
  onSelect?: (p: CellPoint) => void;
  id?: string;
}) {
  const [view, setView] = useState<OrthographicViewState>(),
    [gpuError, setGpuError] = useState(""),
    [ready, setReady] = useState(false),
    [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`cellcast-plot-${id}`) || "null",
      );
      if (
        saved &&
        typeof saved.zoom === "number" &&
        saved.zoom >= -3 &&
        saved.zoom <= 8 &&
        Array.isArray(saved.target) &&
        saved.target.length === 3 &&
        saved.target.every(Number.isFinite)
      )
        setView(saved);
    } catch {}
    setReady(true);
  }, [id]);
  useEffect(() => {
    if (ready && view)
      try {
        localStorage.setItem(`cellcast-plot-${id}`, JSON.stringify(view));
      } catch {}
  }, [id, ready, view]);
  const { normalized, groups, max } = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      max = 0;
    const groups = new Map<string, number>();
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      max = Math.max(max, p.expression || 0);
      if (!groups.has(p.group)) groups.set(p.group, groups.size);
    }
    const scale = 300 / Math.max(maxX - minX, maxY - minY, 1e-9);
    return {
      normalized: points.map((p) => ({
        ...p,
        position: [
          (p.x - (maxX + minX) / 2) * scale,
          (p.y - (maxY + minY) / 2) * scale,
          0,
        ] as [number, number, number],
      })),
      groups,
      max,
    };
  }, [points]);
  const initial: OrthographicViewState = {
    target: [0, 0, 0],
    zoom: 0,
    minZoom: -3,
    maxZoom: 8,
  };
  const layer = useMemo(
    () =>
      new ScatterplotLayer({
        id: "cells",
        data: normalized,
        pickable: true,
        radiusUnits: "pixels",
        getRadius: points.length > 50000 ? 1.5 : 2.5,
        getPosition: (p) => p.position,
        getFillColor: (p) => {
          if (filter && p.group !== filter) return [75, 87, 97, 30];
          if (expression) {
            const t = Math.log1p(p.expression || 0) / Math.log1p(max || 1);
            return [
              Math.round(35 + 210 * t),
              Math.round(55 + 165 * t),
              Math.round(70 + 80 * t),
              210,
            ];
          }
          return [...palette[(groups.get(p.group) || 0) % palette.length], 210];
        },
        updateTriggers: { getFillColor: [filter, expression, max] },
      }),
    [normalized, points.length, filter, expression, max, groups],
  );
  return (
    <div
      className="deck-plot"
      role="region"
      aria-label={`Interactive cell embedding, ${points.length.toLocaleString()} cells`}
    >
      <DeckGL
        views={new OrthographicView({ flipY: false })}
        initialViewState={initial}
        viewState={view}
        onViewStateChange={({ viewState }) =>
          setView(viewState as OrthographicViewState)
        }
        touchAction={touch ? "pan-y" : "compute"}
        controller={{
          dragPan: !touch,
          scrollZoom: false,
          touchZoom: true,
          keyboard: true,
        }}
        layers={[layer]}
        onError={(e) => setGpuError(e.message)}
        getTooltip={({ object }: PickingInfo) =>
          object
            ? {
                text: `${object.id}\n${object.group}${expression ? `\nExpression: ${object.expression?.toFixed(3)}` : ""}`,
                style: {
                  backgroundColor: "#18212a",
                  color: "#e3e9ef",
                  fontSize: "12px",
                },
              }
            : null
        }
        onClick={({ object }: PickingInfo) => object && onSelect?.(object)}
      />
      <div className="deck-controls">
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom out"
          onClick={() =>
            setView((v) => ({
              ...(v || initial),
              zoom: ((v?.zoom as number) || 0) - 0.5,
            }))
          }
        >
          <Minus />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom in"
          onClick={() =>
            setView((v) => ({
              ...(v || initial),
              zoom: ((v?.zoom as number) || 0) + 0.5,
            }))
          }
        >
          <Plus />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Reset view"
          onClick={() => setView(initial)}
        >
          <RotateCcw />
        </Button>
      </div>
      {gpuError && (
        <div className="plot-error" role="alert">
          GPU plot unavailable: {gpuError}. Cell tables and source downloads
          remain available.
        </div>
      )}
      <span className="plot-instructions">
        Drag to pan · use zoom buttons · click a cell
      </span>
    </div>
  );
}
