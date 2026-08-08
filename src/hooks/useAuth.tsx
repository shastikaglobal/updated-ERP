import { apiFetch } from "@/lib/api";
import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";

export type User = { id: string; email: string; user_metadata?: any };
export type Session = { user: User; access_token?: string };

export type ApprovalStatus = "pending" | "approved" | "rejected";

type Profile = {
  id: string;
  company_id: string | null;
  company_name?: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  status: ApprovalStatus;
  requested_role: string | null;
  rejection_reason: string | null;
  email_signature: string | null;
  phone: string | null;
  dob: string | null;
  joining_date: string | null;
  system_mode: string | null;
  city: string | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  permissions: Set<string>;
  roleSlugs: Set<string>;
  loading: boolean;
  onlineUsers: string[];
  activeMinutes: number;
  idleMinutes: number;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateSessionState: (user: User) => void;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [roleSlugs, setRoleSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [onlineUsers] = useState<string[]>([]);
  const [activeMinutes] = useState(0);
  const [idleMinutes] = useState(0);

  const loadUserData = async () => {
    try {
      const res = await apiFetch(`/api/auth/me?t=${Date.now()}`, { credentials: 'include', headers: { 'Cache-Control': 'no-cache' } });
      if (res.ok) {
        const data = await res.json();
        
        let companyName = null;
        if (data.user?.company_id) {
          try {
            const compRes = await apiFetch('/api/vps-fallback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                table: 'companies',
                action: 'select',
                select: 'name',
                filters: [{ column: 'id', type: 'eq', value: data.user.company_id }],
                single: true
              })
            });
            if (compRes.ok) {
              const compJson = await compRes.json();
              companyName = compJson.data?.name || null;
            }
          } catch {
            companyName = "Shastika Global Impex";
          }
        }

        setProfile({
          ...data.user,
          company_id: data.user.company_id || '00000000-0000-0000-0000-00000000ae01',
          company_name: companyName
        });
      } else {
        setProfile(null);
      }

      const rolesRes = await apiFetch(`/api/auth/roles?t=${Date.now()}`, { credentials: 'include', headers: { 'Cache-Control': 'no-cache' } });
      const codes = new Set<string>();
      const slugs = new Set<string>();
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        if (rolesData.roles) {
          rolesData.roles.forEach((r: any) => {
            if (r.slug) slugs.add(r.slug);
            if (r.code) codes.add(r.code);
          });
        }
      }
      setPermissions(codes);
      setRoleSlugs(slugs);
    } catch (err) {
      console.error('[Auth] loadUserData failed:', err);
      setProfile(null);
    }
  };

  const updateSessionState = (user: User) => {
    setSession({ user });
    loadUserData();
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const navEntries = performance.getEntriesByType("navigation");
        const isReload = (navEntries.length > 0 && (navEntries[0] as any).type === "reload") || 
                         (performance.navigation && performance.navigation.type === 1);

        if (isReload) {
          await apiFetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
          setSession(null);
          setLoading(false);
          return;
        }

        const res = await apiFetch(`/api/auth/me?t=${Date.now()}`, { credentials: 'include', headers: { 'Cache-Control': 'no-cache' } });
        if (res.ok) {
          const { user } = await res.json();
          setSession({ user });
          await loadUserData();
        } else if (res.status === 401) {
          const refreshRes = await apiFetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          if (refreshRes.ok) {
            const retryRes = await apiFetch(`/api/auth/me?t=${Date.now()}`, { credentials: 'include', headers: { 'Cache-Control': 'no-cache' } });
            if (retryRes.ok) {
              const { user } = await retryRes.json();
              setSession({ user });
              await loadUserData();
            }
          } else {
             setSession(null);
          }
        } else {
          setSession(null);
        }
      } catch (err) {
        console.error("Auth check failed", err);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const refresh = async () => {
    if (session?.user) await loadUserData();
  };

  const signOut = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setSession(null);
    setProfile(null);
    setPermissions(new Set());
    setRoleSlugs(new Set());
    window.location.href = "/auth";
  };

  const contextValue = useMemo(() => ({
    session, user: session?.user ?? null, profile, permissions, roleSlugs, loading, onlineUsers, activeMinutes, idleMinutes, signOut, refresh, updateSessionState
  }), [session, profile, permissions, roleSlugs, loading, onlineUsers, activeMinutes, idleMinutes]);

  return (
    <Ctx.Provider value={contextValue}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    console.warn("useAuth used outside AuthProvider — returning fallback context");
    return {
      session: null,
      user: null,
      profile: null,
      permissions: new Set<string>(),
      roleSlugs: new Set<string>(),
      loading: false,
      onlineUsers: [],
      activeMinutes: 0,
      idleMinutes: 0,
      signOut: async () => {},
      refresh: async () => {},
      updateSessionState: (_user: User) => {}
    } as AuthCtx;
  }
  return ctx;
}

export function useCan() {
  const { permissions } = useAuth();
  return (code: string) => permissions.has(code);
}

export function useIsAdminOrManager() {
  const { roleSlugs, profile } = useAuth();
  const slugs = Array.from(roleSlugs).map(s => s.toLowerCase());
  const profRole = profile?.role?.toLowerCase() || "";
  const profReqRole = profile?.requested_role?.toLowerCase() || "";
  return slugs.includes("admin") || slugs.includes("manager") || profRole === "admin" || profRole === "manager" || profReqRole === "admin" || profReqRole === "manager";
}

export function useCanManageApprovals() {
  const { roleSlugs } = useAuth();
  const slugs = Array.from(roleSlugs).map(s => s.toLowerCase());
  return slugs.includes("admin") || slugs.includes("manager") || slugs.includes("secretary");
}
