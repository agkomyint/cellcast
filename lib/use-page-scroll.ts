"use client";
import { useLayoutEffect, type RefObject } from "react";

// Navigation and content scrolling are separate. Restore only once the requested
// position exists; late repository data must not reset the user's position.
export function usePageScroll(
  ref: RefObject<HTMLDivElement | null>,
  page: string,
) {
  useLayoutEffect(() => {
    const pane = ref.current;
    if (!pane) return;
    const key = `cellcast-scroll-${page}`;
    let target = 0;
    try {
      target = Math.max(0, Number(sessionStorage.getItem(key)) || 0);
    } catch {}
    let restoring = true,
      frame = 0;
    const persist = () => {
      if (!restoring)
        try {
          sessionStorage.setItem(key, String(pane.scrollTop));
        } catch {}
    };
    const restore = () => {
      if (!restoring) return;
      const max = pane.scrollHeight - pane.clientHeight;
      pane.scrollTop = Math.min(target, max);
      if (target <= max + 1) restoring = false;
    };
    const interrupt = () => {
      restoring = false;
      persist();
    };
    pane.scrollTop = 0;
    frame = requestAnimationFrame(restore);
    const observer = new ResizeObserver(restore);
    if (pane.firstElementChild) observer.observe(pane.firstElementChild);
    pane.addEventListener("scroll", persist, { passive: true });
    pane.addEventListener("wheel", interrupt, { passive: true });
    pane.addEventListener("pointerdown", interrupt, { passive: true });
    pane.addEventListener("keydown", interrupt);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (!restoring)
        try {
          sessionStorage.setItem(key, String(pane.scrollTop));
        } catch {}
      pane.removeEventListener("scroll", persist);
      pane.removeEventListener("wheel", interrupt);
      pane.removeEventListener("pointerdown", interrupt);
      pane.removeEventListener("keydown", interrupt);
    };
  }, [ref, page]);
}
