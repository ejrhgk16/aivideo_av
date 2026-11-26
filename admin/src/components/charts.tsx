"use client";

import { useState, type MouseEvent } from "react";

import ui from "@/components/ui.module.css";
import { formatCount, formatDate, formatRate, steepestDrop } from "@/lib/metrics";
import styles from "./charts.module.css";

export type DailyPoint = { date: string; views: number };

/** Rounds an axis maximum up to a clean number: 1,234 → 1,500, 45.2 → 50. */
function niceCeil(value: number) {
  const half = 10 ** Math.floor(Math.log10(value)) / 2;
  return Math.ceil(value / half) * half;
}

const shortDate = (date: string) => formatDate(date).slice(5);

/**
 * Daily views as bars on a date axis.
 * Hover shows a day, click or arrow keys pin it; with nothing chosen the last day is shown.
 */
export function DailyChart({ series }: { series: DailyPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const last = series.length - 1;
  const active = hovered ?? selected ?? last;
  const day = series[active];
  const viewMax = niceCeil(Math.max(1, ...series.map((point) => point.views)));
  const peak = series.reduce((best, point) => (point.views > best.views ? point : best));
  const total = series.reduce((sum, point) => sum + point.views, 0);
  const ticks = [0, Math.floor(series.length / 2), last];

  const indexAt = (event: MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return Math.min(last, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * series.length)));
  };

  return (
    <div className={styles.chart}>
      <p className={styles.readout} aria-live="polite">
        {formatDate(day.date)} · 조회수 {formatCount(day.views)}
      </p>
      <div
        role="img"
        aria-label={`일별 조회수 그래프. 기간 합계 조회수 ${formatCount(total)}회, 최고 ${shortDate(peak.date)} ${formatCount(peak.views)}회`}
        tabIndex={0}
        className={styles.daily}
        onPointerMove={(event) => setHovered(indexAt(event))}
        onPointerLeave={() => setHovered(null)}
        onClick={(event) => setSelected(indexAt(event))}
        onKeyDown={(event) => {
          const next = ({ ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: last } as Record<string, number>)[
            event.key
          ];
          if (next === undefined) return;
          event.preventDefault();
          setHovered(null);
          setSelected(Math.min(last, Math.max(0, next)));
        }}
      >
        <p className={ui.small}>조회수 축 0 – {formatCount(viewMax)}</p>
        <div className={styles.plot}>
          {series.map((point, index) => (
            <div key={point.date} className={`${styles.slot} ${index === active ? styles.active : ""}`}>
              <div className={styles.bar} style={{ height: `${(point.views / viewMax) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.dates} aria-hidden="true">
        {series.map((point, index) => (
          <span key={point.date}>{ticks.includes(index) ? shortDate(point.date) : null}</span>
        ))}
      </div>
      <p className={ui.small}>막대 = 조회수 · 강조 표시 = 선택한 날</p>
    </div>
  );
}

/** points are the share of views that reached 0, 5, ..., 100% of the episode; the steepest 5% drop is marked. */
export function RetentionChart({ points }: { points: number[] }) {
  const drop = steepestDrop(points);
  const xy = (index: number) => `${index * 5},${100 - points[index] * 100}`;
  const line = points.map((_, index) => xy(index)).join(" ");
  const label = [25, 50, 75, 100].map((point) => `${point}% 지점 ${formatRate(points[point / 5] ?? null)}`).join(", ");
  return (
    <div className={styles.chart}>
      {drop ? (
        <p className={styles.drop}>
          {drop.from}–{drop.to}% 구간에서 가장 많이 이탈 (−{Math.round(drop.drop * 100)}%p)
        </p>
      ) : null}
      <div className={styles.retention}>
        <div className={styles.yTicks} aria-hidden="true">
          {[100, 50, 0].map((tick) => (
            <span key={tick} style={{ top: `${100 - tick}%` }}>{tick}%</span>
          ))}
        </div>
        <div role="img" aria-label={`구간 이탈 곡선. ${label}`} className={styles.curve}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {[0, 50, 100].map((y) => (
              <line key={y} x1={0} x2={100} y1={y} y2={y} className={styles.grid} />
            ))}
            <polygon points={`0,100 ${line} 100,100`} className={styles.area} />
            <polyline points={line} className={styles.line} />
            {drop ? (
              <polyline points={`${xy(drop.from / 5)} ${xy(drop.to / 5)}`} className={`${styles.line} ${styles.dropLine}`} />
            ) : null}
            {points.map((value, index) => (
              <rect key={index} x={index * 5 - 2.5} y={0} width={5} height={100} className={styles.hit}>
                <title>{`${index * 5}% 지점 · ${formatRate(value)}`}</title>
              </rect>
            ))}
          </svg>
          {drop
            ? [drop.from, drop.to].map((point) => (
                <span
                  key={point}
                  className={styles.marker}
                  style={{ left: `${point}%`, bottom: `${points[point / 5] * 100}%` }}
                />
              ))
            : null}
        </div>
        <div className={styles.xTicks} aria-hidden="true">
          {[0, 25, 50, 75, 100].map((tick) => (
            // Shifting by the tick's own share keeps 0% and 100% inside the plot and centres 50%.
            <span key={tick} style={{ left: `${tick}%`, transform: `translateX(-${tick}%)` }}>{tick}%</span>
          ))}
        </div>
      </div>
      <p className={ui.small}>가로 = 재생 위치(회차 길이 대비) · 세로 = 그 지점까지 도달한 조회 비율</p>
    </div>
  );
}

export function Meter({ label, value }: { label: string; value: number | null }) {
  return (
    <div className={styles.meter}>
      <span className={ui.muted}>{label}</span>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${(value ?? 0) * 100}%` }} />
      </div>
      <span className={styles.meterValue}>{formatRate(value)}</span>
    </div>
  );
}
