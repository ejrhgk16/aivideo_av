"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Icon, type IconName } from "@/components/Icon";
import ui from "./ui.module.css";

const nav: { href: string; label: string; short: string; icon: IconName }[] = [
  { href: "/", label: "프로젝트 목록", short: "목록", icon: "grid" },
  { href: "/upload", label: "새 업로드", short: "업로드", icon: "upload" },
];

export function NavLinks() {
  const pathname = usePathname();
  // Both screens keep the selected period, like the breadcrumbs.
  const range = useSearchParams().get("range");
  return nav.map((item) => {
    const active = (pathname === "/upload") === (item.href === "/upload");
    return (
      <Link
        key={item.href}
        href={range ? `${item.href}?range=${encodeURIComponent(range)}` : item.href}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className={`${ui.navItem} ${active ? ui.navActive : ""}`}
      >
        <Icon name={item.icon} />
        <span className={ui.navLabel}>{item.label}</span>
        <span className={ui.navShort}>{item.short}</span>
      </Link>
    );
  });
}
