"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/Icon";
import ui from "./ui.module.css";

export type TableColumn = { key: string; label: string; align?: "right"; sortable?: boolean };
/** lead shows a poster-like initial before the text. sort is the value used when the column is sorted. */
export type TableCell = { text: string; sort?: number | null; lead?: string };
export type TableRow = { key: string; href: string; cells: Record<string, TableCell> };

/** Rows open href on click; the first column's text is also a link for keyboard and screen-reader users. */
export function DataTable({ columns, rows, caption }: { columns: TableColumn[]; rows: TableRow[]; caption: string }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const sorted = sort
    ? [...rows].sort((a, b) => {
        const left = a.cells[sort.key]?.sort ?? null;
        const right = b.cells[sort.key]?.sort ?? null;
        if (left === null || right === null) return (left === null ? 1 : 0) - (right === null ? 1 : 0);
        return sort.desc ? right - left : left - right;
      })
    : rows;

  return (
    <div className={ui.tableScroll}>
      <table className={ui.table}>
        <caption className={ui.tableCaption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const align = column.align === "right" ? ui.alignRight : undefined;
              if (!column.sortable) return <th key={column.key} scope="col" className={align}>{column.label}</th>;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={align}
                  aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
                >
                  <button
                    type="button"
                    className={`${ui.sortButton} ${active ? ui.sortActive : ""}`}
                    onClick={() => setSort({ key: column.key, desc: active ? !sort.desc : true })}
                  >
                    {column.label}
                    <Icon name={active && !sort.desc ? "arrow-up" : "arrow-down"} size={13} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.key} onClick={() => router.push(row.href)}>
              {columns.map((column, index) => {
                const cell = row.cells[column.key];
                const text = index === 0 ? (
                  <Link href={row.href} onClick={(event) => event.stopPropagation()}>{cell?.text}</Link>
                ) : (
                  cell?.text
                );
                return (
                  <td key={column.key} className={column.align === "right" ? ui.alignRight : undefined}>
                    {cell?.lead ? (
                      <span className={ui.leadCell}>
                        <span aria-hidden="true" className={ui.poster}>{cell.lead}</span>
                        {text}
                      </span>
                    ) : (
                      text
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
