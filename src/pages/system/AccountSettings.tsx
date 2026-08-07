import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section, FormGrid, FormRow } from "@/components/shared/FormShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { useAuth, useIsAdminOrManager } from "@/hooks/useAuth";
import { Loader2, User as UserIcon, Lock, Bell, Mail, Activity, Shield, LogIn, Camera, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const tabs = [
  { id: 'profile', label: 'My Profile', icon: UserIcon },
  { id: 'security', label: 'Login & Security', icon: Lock },
  { id: 'notifications', label: 'Notification Preferences', icon: Bell },
  { id: 'preferences', label: 'Preferences', icon: Globe },
  { id: 'activity', label: 'My Activity Log', icon: Activity },
];

const SUPER_ADMIN_EMAIL = "shastikaglobal11@gmail.com";

export default function AccountSettings() {
  const { profile, user, roleSlugs, refresh, session } = useAuth();
  const isAdmin = Array.from(roleSlugs).map(s => s.toLowerCase()).includes("admin");
  const canChangePassword = profile?.email === SUPER_ADMIN_EMAIL || user?.email === SUPER_ADMIN_EMAIL;
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [officialEmail, setOfficialEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [dob, setDob] = useState("");
  const [joiningDate, setJoiningDate] = useState("");

  // Security
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginHistory, setLoginHistory] = useState<any[]>([]);

  // Notifications
  const [emailNotif, setEmailNotif] = useState(true);
  const [whatsappNotif, setWhatsappNotif] = useState(true);
  const [taskNotif, setTaskNotif] = useState(true);
  const [followupNotif, setFollowupNotif] = useState(true);

  // App Preferences
  const [language, setLanguage] = useState("English");
  const [timezone, setTimezone] = useState("UTC");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [theme, setTheme] = useState("light");
  const [dashboardLayout, setDashboardLayout] = useState("default");

  // Signature
  const [signature, setSignature] = useState("");
  const [companyInfo, setCompanyInfo] = useState("Shastika Global Impex Pvt Ltd");

  // Activity
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setContactNumber(profile.phone || "");
      setOfficialEmail(profile.email || user?.email || "");
      setAvatarUrl(profile.avatar_url || "");
      setSignature(profile.email_signature || "");
      setEmployeeId(profile.biometric_id || ""); // Using biometric_id as employee ID for now
      setDesignation(profile.requested_role || "");
      
      // Extract YYYY-MM-DD in the local timezone so that timezone-shifted ISO strings (e.g. 18:30 UTC for midnight IST) display the correct local day
      const formatDateForInput = (d: string | null | undefined) => {
        if (!d) return "";
        const date = new Date(d);
        if (isNaN(date.getTime())) return d.substring(0, 10);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      setDob(formatDateForInput(profile.dob));
      setJoiningDate(formatDateForInput(profile.joining_date));
      
      setDepartment(profile.department || "");
    }
    setLoading(false);
  }, [profile, user]);

  useEffect(() => {
    if (!profile?.id) return;

    if (activeTab === 'security') {
      const fetchLoginHistory = async () => {
        try {
          const res = await apiFetch(`/api/analytics/activity_logs?user_id=${profile.id}&action=login`, {
            headers: { 'Authorization': `Bearer ${user?.access_token || ''}` }
          });
          if (res.ok) {
            const data = await res.json();
            setLoginHistory(data.slice(0, 5));
          }
        } catch (err) {
          console.error("Failed to fetch login history", err);
        }
      };
      fetchLoginHistory();
    }

    if (activeTab === 'activity') {
      const fetchActivities = async () => {
        try {
          const res = await apiFetch(`/api/analytics/activity_logs?user_id=${profile.id}`, {
            headers: { 'Authorization': `Bearer ${user?.access_token || ''}` }
          });
          if (res.ok) {
            const data = await res.json();
            setActivityLogs(data.slice(0, 15));
          }
        } catch (err) {
          console.error("Failed to fetch activity logs", err);
        }
      };
      fetchActivities();
    }

    if (activeTab === 'preferences') {
      const fetchPreferences = async () => {
        try {
          const res = await apiFetch(`/api/employees/${profile.id}/preferences`, {
            headers: { 'Authorization': `Bearer ${user?.access_token || ''}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data && Object.keys(data).length > 0) {
              setLanguage(data.language || 'English');
              setTimezone(data.timezone || 'UTC');
              setDateFormat(data.date_format || 'DD/MM/YYYY');
              setTheme(data.theme || 'light');
              setDashboardLayout(data.dashboard_layout || 'default');
            }
          }
        } catch (err) {
          console.error("Failed to fetch preferences", err);
        }
      };
      fetchPreferences();
    }
  }, [activeTab, profile?.id]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const formData = new FormData();
      formData.append('file', file);
      const _uploadRes = await apiFetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token || user?.access_token || ''}` },
        body: formData
      });
      if (!_uploadRes.ok) throw new Error("Upload failed");
      const { publicUrl } = await _uploadRes.json();

      const res = await apiFetch(`/api/employees/${profile.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${user?.access_token || ''}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ avatar_url: publicUrl })
      });

      if (!res.ok) {
        throw new Error("Failed to update avatar url on backend");
      }

      setAvatarUrl(publicUrl);
      toast.success("Profile picture updated successfully!");
    } catch (err: any) {
      toast.error("Avatar upload failed: " + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile?.id) return;
    setSaving(true);
    const updates = {
      full_name: fullName,
      phone: contactNumber,
      requested_role: designation,
      biometric_id: employeeId,
      dob: dob || null,
      joining_date: joiningDate || null,
      department: department || null,
    };

    try {
      const res = await apiFetch(`/api/employees/${profile.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${user?.access_token || ''}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        throw new Error("Failed to update profile on backend");
      }

      await refresh();
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error("Failed to update profile: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    
    try {
      const res = await apiFetch("/api/auth/update-password", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${user?.access_token || ''}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ newPassword })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }
      
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error("Error updating password: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSignature = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/employees/${profile.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${user?.access_token || ''}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email_signature: signature })
      });

      if (!res.ok) {
        throw new Error("Failed to save email signature on backend");
      }

      toast.success("Signature saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save signature: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!profile?.id) return;
    setSaving(true);
    
    const prefData = {
      user_id: profile.id,
      language,
      timezone,
      date_format: dateFormat,
      theme,
      dashboard_layout: dashboardLayout,
      updated_at: new Date().toISOString()
    };
    try {
      const res = await apiFetch(`/api/employees/${profile.id}/preferences`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${user?.access_token || ''}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(prefData)
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Preferences saved successfully!");
      // Apply theme globally
      localStorage.setItem('ui-theme', theme);
      if (theme === 'dark') {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }
    } catch (err) {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader 
        title="Account Settings" 
        description="Manage your account preferences, profile, and security settings." 
        breadcrumbs={[{ label: "System" }, { label: "Account Settings" }]} 
      />

      <div className="flex flex-col md:flex-row gap-6 mt-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-[#1a2332] rounded-xl overflow-hidden flex flex-col p-2 gap-1 shadow-md border border-slate-800/50">
            {tabs.filter(tab => tab.id !== 'security' || isAdmin).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm ${
                  activeTab === tab.id 
                    ? 'bg-[#2563eb] text-white font-medium shadow-md shadow-blue-900/20' 
                    : 'text-slate-300 dark:text-slate-400 hover:bg-slate-800/80 dark:hover:bg-slate-800 hover:text-white'
                }`}
              >
                <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'opacity-100' : 'opacity-70'}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-card rounded-xl border border-border shadow-sm min-h-[500px] overflow-hidden">
          {activeTab === 'profile' && (
            <div className="p-6 md:p-8 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">My Profile</h2>
                  <p className="text-sm text-muted-foreground">Update your personal information and contact details.</p>
                </div>
                <Button onClick={handleSaveProfile} disabled={saving} className="bg-[#2563eb] hover:bg-blue-700">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>

              <div className="grid gap-8 max-w-2xl">
                <div className="flex items-center gap-6">
                  <div className="relative h-24 w-24 rounded-full border-4 border-background overflow-hidden bg-muted shadow-sm shrink-0 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <UserIcon className="h-10 w-10 text-slate-300 dark:text-slate-400" />
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 cursor-pointer transition-opacity">
                      <Camera className="h-6 w-6 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                    </label>
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Profile Picture</h3>
                    <p className="text-sm text-muted-foreground mb-2">JPG, GIF or PNG. Max size of 2MB.</p>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer">
                        <span className="text-sm font-medium text-blue-600 hover:text-blue-700">Upload new picture</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                      </label>
                      {uploadingAvatar && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Employee ID <span className="text-muted-foreground font-normal">(Read-only)</span></Label>
                    <Input value={employeeId} disabled className="bg-muted/50 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <Input value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Sales Manager" />
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Sales & Marketing" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Number</Label>
                    <Input value={contactNumber} onChange={e => setContactNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Official Email</Label>
                    <Input value={officialEmail} disabled className="bg-muted/50 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Joining</Label>
                    <Input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && isAdmin && (
            <div className="p-6 md:p-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-semibold text-foreground mb-1">Login & Security</h2>
              <p className="text-sm text-muted-foreground mb-6">Manage your password and active sessions.</p>

              {canChangePassword ? (
                <Section title="Change Password" className="mb-8">
                  <div className="grid gap-4 max-w-sm">
                    <div className="space-y-2">
                      <Label>New Password</Label>
                      <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm New Password</Label>
                      <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                    </div>
                    <Button onClick={handleUpdatePassword} disabled={saving || !newPassword || !confirmPassword} className="w-full bg-[#2563eb] hover:bg-blue-700">
                      {saving ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </Section>
              ) : (
                <Section title="Change Password" className="mb-8">
                  <div className="p-4 border border-amber-900/30 rounded-lg bg-amber-950/20 text-amber-400 text-sm max-w-md">
                    🔒 Password changes are restricted to the system owner only.
                  </div>
                </Section>
              )}

              <Section title="Active Sessions">
                <div className="border rounded-lg p-4 flex items-center gap-4 bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                    <LogIn className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">Current Session (Windows, Chrome)</p>
                    <p className="text-xs text-muted-foreground">Active now</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                </div>
              </Section>

              <Section title="Login History (Last 5)" className="mt-8">
                {loginHistory.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden divide-y">
                    {loginHistory.map((log: any) => (
                      <div key={log.id} className="p-3 px-4 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <LogIn className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{log.action || "Login Successful"}</span>
                        </div>
                        <span className="text-muted-foreground">{format(new Date(log.created_at), "MMM d, yyyy h:mm a")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/50 text-center">No recent login history found.</p>
                )}
              </Section>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="p-6 md:p-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-semibold text-foreground mb-1">Notification Preferences</h2>
              <p className="text-sm text-muted-foreground mb-6">Choose how and when you want to be notified.</p>

              <div className="max-w-2xl space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium text-foreground">Email Notifications</h3>
                    <p className="text-sm text-muted-foreground">Receive daily summaries and important updates via email.</p>
                  </div>
                  <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium text-foreground">WhatsApp Alerts</h3>
                    <p className="text-sm text-muted-foreground">Get instant alerts for critical approvals or mentions on WhatsApp.</p>
                  </div>
                  <Switch checked={whatsappNotif} onCheckedChange={setWhatsappNotif} />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium text-foreground">Task Reminders</h3>
                    <p className="text-sm text-muted-foreground">Reminders for upcoming tasks and deadlines.</p>
                  </div>
                  <Switch checked={taskNotif} onCheckedChange={setTaskNotif} />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium text-foreground">Follow-up Reminders</h3>
                    <p className="text-sm text-muted-foreground">Automated notifications for CRM follow-ups.</p>
                  </div>
                  <Switch checked={followupNotif} onCheckedChange={setFollowupNotif} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="p-6 md:p-8 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Preferences</h2>
                  <p className="text-sm text-muted-foreground">Customize your application experience.</p>
                </div>
                <Button onClick={handleSavePreferences} disabled={saving} className="bg-[#2563eb] hover:bg-blue-700">
                  {saving ? "Saving..." : "Save Preferences"}
                </Button>
              </div>

              <div className="grid gap-6 max-w-2xl">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Tamil">Tamil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Time Zone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="IST">Indian Standard Time (IST)</SelectItem>
                        <SelectItem value="EST">Eastern Standard Time (EST)</SelectItem>
                        <SelectItem value="PST">Pacific Standard Time (PST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select value={dateFormat} onValueChange={setDateFormat}>
                      <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="p-6 md:p-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-semibold text-foreground mb-1">My Activity Log</h2>
              <p className="text-sm text-muted-foreground mb-6">Recent actions and modules accessed by you.</p>

              {activityLogs.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                      <tr>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Module/Entity</th>
                        <th className="px-4 py-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {activityLogs.map((log: any) => (
                        <tr key={log.id} className="bg-card hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium text-foreground">{log.action || '-'}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {log.module ? `[${log.module}]` : ''} {log.entity || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                  <Activity className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No recent activity logs found.</p>
                </div>
              )}
            </div>
          )}


        </div>
      </div>
    </div>
  );
}

// Minimal inline Badge component to avoid importing if it fails
function Badge({ children, className, variant = "default" }: { children: React.ReactNode, className?: string, variant?: string }) {
  let baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  if (variant === "outline") baseStyles += " text-foreground";
  else if (variant === "default") baseStyles += " border-transparent bg-primary text-primary-foreground";
  
  return (
    <div className={`${baseStyles} ${className || ''}`}>
      {children}
    </div>
  );
}
