"use client";

import { useId, useState } from "react";

/**
 * Chart pieces for the admin dashboard.
 *
 * Every chart here plots a single series, which is why they are single-hue: the
 * colours carry meaning rather than identity — gold is signups (the brand
 * accent), sage is arrivals (the same green the check-in console uses for "in
 * the room"), coral is the make-up of the room. Nothing here needs a
 * categorical palette, so nothing here gets one.
 *
 * All three are plain HTML rather than SVG. At this size the marks are
 * rectangles, and letting flexbox do the layout means they stay responsive and
 * keyboard-reachable without a measuring pass.
 */

export const CHART_GOLD = "#D9A441";
export const CHART_SAGE = "#6F8F60";
export const CHART_CORAL = "#B23A48";

/** Leaves room above the tallest column for its direct label. */
const PLOT_HEADROOM = 0.86;

export interface Column {
  key: string;
  /** Long form, for the readout and the table. */
  label: string;
  /** Short form for the axis. */
  tick: string;
  value: number;
}

export function ColumnChart({
  columns,
  color,
  noun,
  empty,
}: {
  columns: Column[];
  color: string;
  /** Plural, used in the readout and screen-reader labels: "signups". */
  noun: string;
  empty: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  if (columns.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-cream/15 px-5 py-12 text-center">
        <p className="text-sm text-cream/45">{empty}</p>
      </div>
    );
  }

  const max = Math.max(...columns.map((column) => column.value));
  const peak = columns.reduce(
    (best, column, index) => (column.value > columns[best].value ? index : best),
    0,
  );
  // Hovering reads out that column; otherwise the readout rests on the busiest
  // one, so the chart still answers "when was the rush?" without being touched.
  const shown = columns[active ?? peak];

  // Thin the axis anchored to the end, so the most recent tick is always drawn.
  const step = Math.max(1, Math.ceil(columns.length / 7));
  const showsTick = (index: number) => (columns.length - 1 - index) % step === 0;

  return (
    <>
      <p className="mt-1 flex items-baseline gap-2 font-[family-name:var(--font-oswald)] text-[12px] tracking-[0.08em] text-cream/40 uppercase">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="text-cream/70">{shown.label}</span>
        <span className="text-cream/70 tabular-nums">
          {shown.value} {noun}
        </span>
        {active === null && max > 0 && <span className="text-cream/30">· busiest</span>}
      </p>

      <div className="relative mt-4">
        {[0.34, 0.67, 1].map((fraction) => (
          <div
            key={fraction}
            aria-hidden
            className="absolute inset-x-0 h-px bg-cream/8"
            style={{ bottom: `${fraction * PLOT_HEADROOM * 100}%` }}
          />
        ))}

        <div className="flex h-[168px] items-stretch gap-[2px]">
          {columns.map((column, index) => {
            const height = max > 0 ? (column.value / max) * PLOT_HEADROOM * 100 : 0;
            const isActive = index === (active ?? peak);
            return (
              <button
                key={column.key}
                type="button"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-label={`${column.label}: ${column.value} ${noun}`}
                className="relative flex flex-1 items-end justify-center rounded-sm outline-none transition-colors hover:bg-cream/[0.05] focus-visible:bg-cream/[0.08]"
              >
                {index === peak && column.value > 0 && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 font-[family-name:var(--font-oswald)] text-[11px] text-cream/55 tabular-nums"
                    style={{ bottom: `calc(${height}% + 4px)` }}
                  >
                    {column.value}
                  </span>
                )}
                <span
                  aria-hidden
                  className="w-full max-w-6 rounded-t-[4px] transition-opacity"
                  style={{
                    // A flat day still gets a sliver, so the axis reads as a
                    // run of days rather than a gap with nothing in it.
                    height: column.value === 0 ? "2px" : `${height}%`,
                    background: color,
                    opacity: column.value === 0 ? 0.3 : isActive ? 1 : 0.78,
                  }}
                />
              </button>
            );
          })}
        </div>
        <div aria-hidden className="h-px w-full bg-cream/12" />
      </div>

      <div aria-hidden className="mt-2 flex gap-[2px]">
        {columns.map((column, index) => (
          <span
            key={column.key}
            className="flex-1 truncate text-center font-[family-name:var(--font-oswald)] text-[10.5px] tracking-[0.06em] text-cream/35 tabular-nums"
          >
            {showsTick(index) ? column.tick : ""}
          </span>
        ))}
      </div>

      <details className="group mt-4">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded font-[family-name:var(--font-oswald)] text-[10.5px] tracking-[0.12em] text-cream/35 uppercase transition hover:text-cream/60 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold">
          <span aria-hidden className="transition-transform group-open:rotate-90">
            ›
          </span>
          Numbers
        </summary>
        <div className="mt-2.5 max-h-44 overflow-y-auto rounded-lg border border-cream/10">
          <table className="w-full text-left text-[12.5px]" id={tableId}>
            <tbody className="divide-y divide-cream/8">
              {columns.map((column) => (
                <tr key={column.key}>
                  <th scope="row" className="px-3 py-1.5 font-normal text-cream/55">
                    {column.label}
                  </th>
                  <td className="px-3 py-1.5 text-right text-cream/75 tabular-nums">
                    {column.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export interface BarItem {
  label: string;
  count: number;
}

/**
 * Ranked counts of a free-text field. Horizontal because the labels are school
 * names, which never fit under a column, and every row is directly labelled —
 * this is a table that happens to draw its magnitudes.
 */
export function BarList({
  items,
  color,
  total,
  empty,
}: {
  items: BarItem[];
  color: string;
  total: number;
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-cream/15 px-5 py-8 text-center">
        <p className="text-sm text-cream/45">{empty}</p>
      </div>
    );
  }

  const max = Math.max(...items.map((item) => item.count));

  return (
    <ul className="mt-4 flex flex-col gap-3.5">
      {items.map((item) => {
        const share = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13.5px] text-cream/75">{item.label}</span>
              <span className="shrink-0 font-[family-name:var(--font-oswald)] text-[12.5px] text-cream/60 tabular-nums">
                {item.count}
                <span className="text-cream/30"> · {share}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-cream/8">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${(item.count / max) * 100}%`,
                  background: color,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
