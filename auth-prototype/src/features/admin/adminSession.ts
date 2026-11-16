import { createContext, useContext } from 'react';

/** Prototype sign-in held by the web admin layout; nothing is sent to a server. */
export type AdminSession = { email: string | null; signIn: (email: string) => void; signOut: () => void };

/** sessionStorage key: tab-scoped, so a reload keeps the reviewer signed in and closing the tab signs out. */
export const ADMIN_SESSION_KEY = 'aidrama.admin.email';

export const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession() {
  const session = useContext(AdminSessionContext);
  if (!session) throw new Error('useAdminSession must be used inside the admin layout');
  return session;
}
