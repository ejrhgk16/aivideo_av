import Image from "next/image";
import { redirect } from "next/navigation";

import ui from "@/components/ui.module.css";
import { getOperator } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export default async function LoginPage() {
  if (await getOperator()) redirect("/");
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <p className={styles.brand}>
          <Image src="/logo.png" alt="" width={32} height={32} className={ui.brandLogo} />
          <span className={ui.brandText}>
            <span className={ui.wordmark}>peeka</span>
            <span className={ui.brandTag}>관리자</span>
          </span>
        </p>
        <h1 className={ui.title}>관리자 로그인</h1>
        <p className={ui.muted}>운영자 계정만 들어올 수 있어요.</p>
        <LoginForm />
      </div>
    </main>
  );
}
