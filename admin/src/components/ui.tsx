import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import {
  ADMIN_METRICS,
  ADMIN_RANGES,
  formatDate,
  formatKpi,
  kpiDelta,
  type DateRange,
  type KpiKey,
  type Kpis,
  type MetricKey,
  type RangeDays,
} from "@/lib/metrics";
import ui from "./ui.module.css";

export type Crumb = { label: string; href?: string };

/** Page title row, sample-metrics notice, and page body. narrow is for form pages. */
export function Page({ title, breadcrumb = [], actions, narrow, children }: {
  title: string;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${ui.content} ${narrow ? ui.contentNarrow : ""}`}>
      <header className={ui.header}>
        <div className={ui.headerCopy}>
          {breadcrumb.length ? (
            <nav aria-label="위치" className={ui.breadcrumb}>
              {breadcrumb.map((crumb, index) => (
                <Fragment key={crumb.label}>
                  {index ? <Icon name="chevron-right" size={14} /> : null}
                  {crumb.href ? (
                    <Link href={crumb.href} className={ui.crumbLink}>{crumb.label}</Link>
                  ) : (
                    <span aria-current="page">{crumb.label}</span>
                  )}
                </Fragment>
              ))}
            </nav>
          ) : null}
          <h1 className={ui.title}>{title}</h1>
        </div>
        {actions}
      </header>
      <SampleNotice />
      {children}
    </div>
  );
}

export function SampleNotice() {
  return (
    <div className={ui.notice}>
      <span className={ui.badge}>샘플 지표</span>
      <p className={ui.noticeCopy}>
        작품·회차 목록은 실제 DB 데이터예요. 지표 숫자는 수집 기능을 연결하기 전이라 예시이고, 정의는 관리자 지표
        정의서(초안 v0.1)를 따라요.
      </p>
    </div>
  );
}

export function Panel({ title, caption, children }: { title?: string; caption?: string; children: ReactNode }) {
  return (
    <section className={ui.panel}>
      {title ? (
        <div className={ui.panelHead}>
          <h2 className={ui.panelTitle}>{title}</h2>
          {caption ? <p className={ui.small}>{caption}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Period tabs as links: the selected range lives in ?range= so it survives navigation. */
export function RangeTabs({ value, range, basePath }: { value: RangeDays; range: DateRange; basePath: string }) {
  return (
    <div className={ui.row}>
      <nav aria-label="기간" className={ui.tabs}>
        {ADMIN_RANGES.map((days) => (
          <Link
            key={days}
            href={`${basePath}?range=${days}`}
            aria-current={days === value ? "page" : undefined}
            className={`${ui.tab} ${days === value ? ui.tabActive : ""}`}
          >
            최근 {days}일
          </Link>
        ))}
      </nav>
      <p className={ui.small}>
        {formatDate(range.start)} – {formatDate(range.end)} (KST) · 증감은 이전 {value}일 대비
      </p>
    </div>
  );
}

export function KpiGrid({ keys, current, previous, days }: {
  keys: KpiKey[];
  current: Kpis;
  previous: Kpis | null;
  days: number;
}) {
  return (
    <div className={ui.kpiGrid}>
      {keys.map((key) => {
        const delta = previous && kpiDelta(key, current, previous);
        const text = !delta
          ? "비교 데이터 없음"
          : delta.tone === "flat"
            ? delta.text
            : `${delta.text} ${delta.tone === "good" ? "개선" : "악화"}`;
        const tone = delta && delta.tone !== "flat" ? (delta.tone === "good" ? ui.good : ui.bad) : "";
        return (
          <div key={key} className={ui.kpiCard}>
            <p className={ui.muted}>{ADMIN_METRICS[key].label}</p>
            <p className={ui.kpiValue}>{formatKpi(key, current)}</p>
            <p
              className={`${ui.small} ${tone}`}
              aria-label={`이전 ${days}일 대비 ${text.replace("▲", "증가").replace("▼", "감소")}`}
            >
              {text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function MetricDefinitions({ keys }: { keys: MetricKey[] }) {
  return (
    <Panel title="지표 정의">
      {keys.map((key) => (
        <div key={key} className={ui.definition}>
          <p className={ui.definitionLabel}>{ADMIN_METRICS[key].label}</p>
          <p className={ui.muted}>{ADMIN_METRICS[key].definition}</p>
        </div>
      ))}
    </Panel>
  );
}

export function EmptyState({ title, description, actionHref, actionLabel }: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <Panel>
      <div className={ui.empty}>
        <p className={ui.emptyTitle}>{title}</p>
        <p className={ui.muted}>{description}</p>
        <Link href={actionHref} className={ui.button}>{actionLabel}</Link>
      </div>
    </Panel>
  );
}

/** Label, input, and its error or hint. htmlFor must match the input's id. */
export function Field({ label, htmlFor, required, error, hint, children }: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={ui.field}>
      <label htmlFor={htmlFor} className={ui.fieldLabel}>
        {label}
        {required ? <span className={ui.required}> *</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className={ui.error}>{error}</p>
      ) : hint ? (
        <p className={ui.hint}>{hint}</p>
      ) : null}
    </div>
  );
}
