"use client";

import { useEffect, useRef, type ComponentProps } from "react";

/**
 * Marks its wrapper with data-inview="false" until it scrolls into view, then "true".
 * Children animate with `group-data-[inview=false]:` (or plain CSS on [data-inview]).
 * The attribute is only set client-side and skipped for reduced motion, so content
 * renders in its final state without JS.
 */
export function InView({
  threshold = 0.35,
  className,
  ...props
}: ComponentProps<"div"> & { threshold?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.dataset.inview = "false";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.dataset.inview = "true";
        observer.disconnect();
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return <div ref={ref} className={`group ${className ?? ""}`} {...props} />;
}

/** Counts up from 0 to `value` over 600 ms once visible. Renders the final value without JS. */
export function CountUp({ value, prefix = "" }: { value: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    el.textContent = `${prefix}0`;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / 600, 1);
          const eased = 1 - (1 - t) ** 3;
          el.textContent = `${prefix}${Math.round(value * eased)}`;
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 1 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, prefix]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value}
    </span>
  );
}
