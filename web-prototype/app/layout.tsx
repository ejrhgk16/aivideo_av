import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { metadataBase: new URL('https://ai-drama-screen.qwerqerqwere.chatgpt.site'), title: 'peeka — 1분의 몰입', description: '짧아서 더 깊게. 매일 발견하는 새로운 AI 드라마.', icons: { icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/peeka/logo.png', type: 'image/png', sizes: '192x192' }], apple: '/apple-touch-icon.png' } };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
