import { apiFetch } from "@/lib/api";
import { vpsDb } from "@/lib/vpsDb";
import { useState, useEffect } from "react";
import { useAuth, useCan } from "@/hooks/useAuth";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Sprout, LayoutDashboard, ShieldCheck, Settings, Bot } from "lucide-react";
import { navGroups } from "@/config/navigation";
import { cn } from "@/lib/utils";


import { AIChatPanel } from "./AIChatPanel";

export function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const can = useCan();
  const { profile, roleSlugs, session } = useAuth();

  const slugs = Array.from(roleSlugs).map(s => s.toLowerCase());
  const isAdmin = slugs.includes("admin");
  const isSecretary = slugs.includes("secretary");
  const isBde = slugs.includes("bd") ||
    slugs.includes("bde") ||
    (profile?.requested_role && ["bd", "bde"].includes(profile.requested_role.toLowerCase()));

  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const active = navGroups.find(g => g.items.some(i => location.pathname.startsWith(i.url)));
    return active ? [active.title] : [navGroups[0].title];
  });

  const [openSubGroups, setOpenSubGroups] = useState<string[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [employeeAdmin, setEmployeeAdmin] = useState(false);

  const [counts, setCounts] = useState({ clientAcq: 0, conversions: 0, customers: 0 });

  useEffect(() => {
    // Auto-open sub-groups if active
    navGroups.forEach(g => {
      g.items.forEach(i => {
        if (i.items?.some(sub => location.pathname.startsWith(sub.url))) {
          setOpenSubGroups(prev => prev.includes(i.title) ? prev : [...prev, i.title]);
        }
      });
    });
  }, [location.pathname]);

  const toggleGroup = (title: string) =>
    setOpenGroups(prev => (prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]));

  const toggleSubGroup = (title: string) =>
    setOpenSubGroups(prev => (prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]));

  useEffect(() => {
    let mounted = true;
    const fetchCounts = async () => {
      try {
        // [VPS Migration] Session now comes from useAuth hook, not vpsDb
        if (!session) return;
        
        const userId = session?.user?.id;
        let companyFilter = "";
        if (userId) {
const { data: profile } = {} as any; // [VPS Migration] fixed assignment
          if (profile?.company_id) {
            companyFilter = `?company_id=${profile.company_id}`;
          }
        }

        const res = await apiFetch(`/api/analytics/sidebar_counts${companyFilter}`, {
          credentials: 'include'
        });
        
        if (!res.ok) throw new Error("Failed to fetch sidebar counts");
        
        const data = await res.json();
        
        if (!mounted) return;
        setCounts({
          clientAcq: data.clientAcq || 0,
          conversions: data.conversions || 0,
          customers: data.customers || 0
        });
      } catch (err) {
        // ignore
        console.error("Sidebar count fetch error:", err);
      }
    };
    
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const currentUserId = profile?.id;

  useEffect(() => {
    let mounted = true;

    const fetchPerms = async () => {
      if (!profile?.email) return;

      let isEmpAdmin = false;
      try {
        const empRes = await apiFetch('/api/employees', {
          headers: {
            },
        });
        const empData = empRes.ok ? await empRes.json() : [];
        const employee = empData?.find((e: any) => e.email?.toLowerCase() === profile.email?.toLowerCase());
        if (employee && employee.role?.toLowerCase() === "admin") {
          isEmpAdmin = true;
        }
      } catch (e) {
        console.error("Employee fetching error:", e);
      }

      if (!mounted) return;
      setEmployeeAdmin(isEmpAdmin);

      if (isAdmin || isEmpAdmin) {
        setPermissionsLoading(false);
        return;
      }

      if (!currentUserId) {
        console.log('[AppSidebar] No currentUserId yet, skipping permissions fetch.');
        return;
      }

      try {
        const permsRes = await apiFetch(`/api/user-permissions?user_id=${currentUserId}&t=${Date.now()}`, {
          headers: {
            },
          cache: 'no-store'
        });

        if (!mounted) return;

        if (!permsRes.ok) {
          console.error('[AppSidebar] ❌ Permissions API fail:', permsRes.status);
          return;
        }

        const data = await permsRes.json();
        if (Array.isArray(data)) {
          const perms = data
            .filter((p: any) => p.has_access === true)
            .map((p: any) => String(p.section).toLowerCase().trim());

          setPermissions(perms);
        } else {
          console.warn('[AppSidebar] ⚠️ Permissions API returned unexpected data:', data);
        }
      } catch (err) {
        console.error("[AppSidebar] 🚨 Permissions fetch error:", err);
      } finally {
        if (mounted) {
          setPermissionsLoading(false);
        }
      }
    };

    fetchPerms();
    const interval = setInterval(() => {
      if (mounted) {
        fetchPerms();
      }
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [currentUserId]);

  const activeIsAdmin = isAdmin || employeeAdmin;

  // BDE role: if no explicit user_permissions are set, default to CRM only
  const BDE_ALLOWED_GROUPS = ['CRM'];
  const hasBdeDefaults = isBde && permissions.length === 0;

  console.log('[AppSidebar] 🛠 Recalculating visibleGroups. Admin:', activeIsAdmin, 'BDE:', isBde, 'Permissions Count:', permissions.length);

  const visibleGroups = navGroups
    .map(g => {
      // 1. If Admin, show everything in the group
      if (activeIsAdmin) {
        return g;
      }

      // 2. BDE with no explicit permissions → show CRM group, and specific items in other groups
      if (hasBdeDefaults) {
        if (g.title === 'Farmers') {
          return { ...g, items: g.items.filter(i => ['Farmers List', 'Farmer Verification', 'Farmer KYC', 'Farm Visits', 'Contract Farming', 'Supply Commitments', 'Goods Collection', 'Farmer Rating', 'Payouts & Payments', 'Convert to Customer'].includes(i.title)) };
        }
        if (g.title === 'Warehouse & Inventory') {
          return {
            ...g,
            items: g.items.map(item => {
              if (item.title === 'Quotations') {
                return item;
              }
              return null;
            }).filter((item): item is NonNullable<typeof item> => item !== null)
          };
        }
        if (!BDE_ALLOWED_GROUPS.includes(g.title)) return { ...g, items: [] };
        // For HR & Employees, hide all items for BDE users (Face Attendance is role-restricted)
        if (g.title === 'HR & Employees') {
          return { ...g, items: [] };
        }
        return g; // Show full CRM group
      }
      
      // 3. Filter items by explicit user_permissions
      const filteredItems = g.items.map(item => {
        // If it has sub-items (like Warehouse -> Inventory -> Available Stock)
        if (item.items && item.items.length > 0) {
          const filteredSubItems = item.items.filter(sub => {
            const subTitle = sub.title.toLowerCase().trim();
            // Match plain title OR "SECTION__sub" format stored in DB
            const isAllowed = permissions.some(p => {
              if (p === subTitle) return true;
              const parts = p.split('__');
              return parts.length > 1 && parts[parts.length - 1] === subTitle;
            });
            if (isAllowed) console.log(`[AppSidebar] ✔️ Allowed (sub): ${sub.title}`);
            return isAllowed;
          });
          return { ...item, items: filteredSubItems };
        }
        
        // If it's a top-level item in the group
        return item;
      }).filter(item => {
        // Keep item if it has allowed sub-items OR if its own title is allowed
        const itemTitle = item.title.toLowerCase().trim();
        // Match plain title OR "SECTION__sub" format stored in DB
        const isSelfAllowed = permissions.some(p => {
          if (p === itemTitle) return true;
          const parts = p.split('__');
          return parts.length > 1 && parts[parts.length - 1] === itemTitle;
        });
        const hasAllowedChildren = item.items && item.items.length > 0;
        
        const isAlwaysVisible = ['contract farming', 'supply commitments', 'goods collection', 'farmer rating', 'payouts', 'payouts & payments', 'support', 'farm visits', 'farmer kyc', 'farmer verification', 'farmer documents'].includes(itemTitle);

        if (isSelfAllowed || isAlwaysVisible) console.log(`[AppSidebar] ✔️ Allowed (item): ${item.title}`);
        
        return isSelfAllowed || hasAllowedChildren || isAlwaysVisible;
      });

      return { ...g, items: filteredItems };
    })
    .filter(g => g.items.length > 0);

  if (permissionsLoading && !activeIsAdmin) {
    return (
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0 items-center justify-center",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Verifying Access...</span>
        </div>
      </aside>
    );
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-14 flex items-center gap-2 px-4 border-b border-sidebar-border shrink-0">
          <div className="h-8 w-8 rounded-md flex items-center justify-center shadow-sm overflow-hidden bg-white">
            <img src="/logo.webp" alt="Company Logo" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground leading-tight truncate">
              {profile?.company_name || "AgriExport ERP"}
            </div>
            <div className="text-[10px] text-sidebar-muted uppercase tracking-wider">Impex · Agri Export ERP</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {visibleGroups.map(group => {
            const Icon = group.icon;
            const isOpen = openGroups.includes(group.title);
            const hasActive = group.items.some(i => location.pathname === i.url || location.pathname.startsWith(i.url + "/"));
            return (
              <div key={group.title}>
                <button
                  onClick={() => toggleGroup(group.title)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors",
                    hasActive ? "text-white" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  <span className="flex-1 text-left uppercase tracking-wide text-[11px]">{group.title}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-sidebar-border space-y-0.5">
                    {group.items.map(item => {
                      const ItemIcon = item.icon;
                      const hasSubItems = item.items && item.items.length > 0;
                      const isSubOpen = openSubGroups.includes(item.title);
                      const isSubActive = item.items?.some(sub => location.pathname === sub.url || location.pathname.startsWith(sub.url + "/"));
                      const badgeCount = item.url === '/crm/client-acquisition' ? counts.clientAcq : item.url === '/crm/convert' ? counts.conversions : item.url === '/crm/customers' ? counts.customers : 0;

                      if (hasSubItems) {
                        return (
                          <div key={item.title} className="space-y-0.5">
                            <button
                              onClick={() => toggleSubGroup(item.title)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors border-l-[3px] border-transparent",
                                isSubActive ? "nav-active font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                              )}
                            >
                              {ItemIcon && <ItemIcon className="h-3.5 w-3.5 shrink-0" />}
                              <span className="truncate flex-1 text-left">{item.title}</span>
                              <ChevronDown className={cn("h-3 w-3 transition-transform", isSubOpen && "rotate-180")} />
                            </button>
                            {isSubOpen && (
                              <div className="ml-4 pl-2 border-l border-sidebar-border space-y-0.5">
                                {item.items!.map(subItem => {
                                  const SubIcon = subItem.icon;
                                  return (
                                    <NavLink
                                      key={subItem.url}
                                      to={subItem.url}
                                      end
                                      onClick={() => onClose()}
                                      className={({ isActive }) =>
                                        cn(
                                          "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition-colors border-l-[3px] border-transparent",
                                          isActive ? "text-white bg-sidebar-accent font-medium border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                                        )
                                      }
                                    >
                                      {SubIcon && <SubIcon className="h-3 w-3 shrink-0" />}
                                      <span className="truncate">{subItem.title}</span>
                                    </NavLink>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          end
                          onClick={() => onClose()}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors border-l-[3px] border-transparent",
                              isActive ? "nav-active font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                            )
                          }
                        >
                          {ItemIcon && <ItemIcon className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{item.title}</span>
                          {badgeCount > 0 && (
                            <span className="ml-auto text-[11px] bg-white/5 text-white px-2 py-0.5 rounded-full font-semibold">{badgeCount}</span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div>
            <button
              onClick={() => setAiOpen(true)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            >
              <Bot className="h-4 w-4" />
              <span className="flex-1 text-left uppercase tracking-wide text-[11px]">AI Assistant</span>
            </button>
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-3 shrink-0">
          <div className="flex items-center gap-2 px-1">
            <div className="h-8 w-8 rounded-full logo-mark flex items-center justify-center text-xs font-bold text-[hsl(var(--primary-foreground))] overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (profile?.full_name || profile?.email || "U").slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">
                {profile?.full_name && profile.full_name !== profile.email ? profile.full_name : profile?.email ? "User" : "User"}
              </div>
              <div className="text-[10px] text-sidebar-muted truncate capitalize">
                {roleSlugs.size > 0
                  ? Array.from(roleSlugs)
                    .map(s => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))
                    .join(", ")
                  : "No role assigned"}
              </div>
            </div>
            <div className="mt-2">
              <button
                onClick={() => {
                  navigate('/employees/face-attendance?mode=checkout');
                  onClose();
                }}
                className="w-full text-left text-xs text-sidebar-muted hover:text-white"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>
      <AIChatPanel open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}


