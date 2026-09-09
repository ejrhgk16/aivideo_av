import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { metadataBase: new URL('https://ai-drama-screen.qwerqerqwere.chatgpt.site'), title: 'AI DRAMA — 1분의 몰입', description: '짧아서 더 깊게. 매일 발견하는 새로운 AI 드라마.' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko" className="dark"><body>{children}</body></html>}
