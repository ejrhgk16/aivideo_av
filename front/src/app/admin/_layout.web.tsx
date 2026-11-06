import { useMemo, useState } from 'react';
import { Redirect, Slot, usePathname } from 'expo-router';
import { ADMIN_SESSION_KEY, AdminSessionContext } from '@/features/admin/adminSession';

// Prototype gate: every admin page except /admin/login needs the sample sign-in.
export default function AdminWebLayout() {
  const pathname = usePathname();
  const [email, setEmail] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY));
  const session = useMemo(() => ({
    email,
    signIn: (value: string) => { sessionStorage.setItem(ADMIN_SESSION_KEY, value); setEmail(value); },
    signOut: () => { sessionStorage.removeItem(ADMIN_SESSION_KEY); setEmail(null); },
  }), [email]);
  const onLogin = pathname === '/admin/login';
  if (!email && !onLogin) return <Redirect href="/admin/login" />;
  if (email && onLogin) return <Redirect href="/admin" />;
  return <AdminSessionContext.Provider value={session}><Slot /></AdminSessionContext.Provider>;
}
