import Image from "next/image";

import { Icon } from "@/components/Icon";
import { NavLinks } from "@/components/NavLinks";
import ui from "@/components/ui.module.css";
import { requireOperator } from "@/lib/auth";
import { logout } from "./actions";

// Every page under (admin) needs a signed-in operator; pages and actions still check on their own.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const operator = await requireOperator();
  return (
    <div className={ui.shell}>
      <aside className={ui.sidebar}>
        <p className={ui.brand}>
          <Image src="/logo.png" alt="" width={32} height={32} className={ui.brandLogo} />
          <span className={ui.brandText}>
            <span className={ui.wordmark}>peeka</span>
            <span className={ui.brandTag}>관리자</span>
          </span>
        </p>
        <NavLinks />
        <div className={ui.sidebarSpacer} />
        <p className={ui.account}>{operator.displayName ?? operator.loginId}</p>
        <form action={logout}>
          <button type="submit" className={ui.navItem}>
            <Icon name="log-out" />
            <span className={ui.navLabel}>로그아웃</span>
            <span className={ui.navShort}>나가기</span>
          </button>
        </form>
      </aside>
      <main className={ui.main}>{children}</main>
    </div>
  );
}
