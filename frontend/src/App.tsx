import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Boxes, BriefcaseBusiness,
  CalendarDays, ChevronDown, CircleHelp, ClipboardList, CreditCard,
  Clock3, Fuel, Gauge, ImageOff, LayoutDashboard, LogOut, Menu, Minus, PackageCheck, Plus,
  Settings, ShieldCheck, Sparkles, Truck, Users, Wallet, X,
} from "lucide-react";
import { changePassword, getDashboard, getPlants, getProfile, login, logout, type DashboardMetric } from "./api";
import ModuleWorkspace from "./ModuleWorkspace";
import { demoStorageKey, readDemoRecords, stockAvailable, type DemoRecord } from "./demoData";

const DashboardCharts = lazy(() => import("./DashboardCharts"));

const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Operations", path: "/operations", icon: Activity },
  { label: "Weighbridge", path: "/weighbridge", icon: Gauge },
  { label: "Production", path: "/production", icon: PackageCheck },
  { label: "Stock & Inventory", path: "/stock-inventory", icon: Boxes },
  { label: "Sales & Billing", path: "/sales-billing", icon: CreditCard },
  { label: "Dispatch & Transport", path: "/dispatch-transport", icon: Truck },
  { label: "Accounts & Expenses", path: "/accounts-expenses", icon: Wallet },
  { label: "Diesel & Fuel", path: "/diesel-fuel", icon: Fuel },
  { label: "HR & Payroll", path: "/hr-payroll", icon: Users },
  { label: "Maintenance", path: "/maintenance", icon: BriefcaseBusiness },
  { label: "Reports", path: "/reports", icon: ClipboardList },
];

const extraRoutes = [
  { label: "AI Assistant", path: "/ai-assistant" },
  { label: "Settings", path: "/settings" },
];

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(256),
});
type LoginFields = z.infer<typeof loginSchema>;

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
  confirmation: z.string().min(12).max(256),
}).refine((fields) => fields.newPassword === fields.confirmation, {
  path: ["confirmation"],
  message: "The new passwords do not match.",
});
type PasswordChangeFields = z.infer<typeof passwordChangeSchema>;

const numberFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});

function formatMetric(value: number, unit: string) {
  if (unit === "INR") return inrFormatter.format(value);
  const formatted = numberFormatter.format(value);
  return unit === "count" ? formatted : `${formatted} ${unit}`;
}

function MetricCard({
  label, metric, icon: Icon, tone, demo = false,
}: {
  label: string;
  metric: DashboardMetric;
  icon: typeof Activity;
  tone: string;
  demo?: boolean;
}) {
  const change = metric.value - metric.previous_period_value;
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={19} strokeWidth={2} /></div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{formatMetric(metric.value, metric.unit)}</div>
      <div className={`metric-change ${!demo && metric.has_data && change > 0 ? "positive" : !demo && metric.has_data && change < 0 ? "negative" : ""}`}>
        {demo || !metric.has_data || change === 0 ? <Minus size={14} /> : change > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {demo ? "Calculated from sample records" : metric.has_data ? formatMetric(Math.abs(change), metric.unit) + " vs prior period" : "No recorded data yet"}
      </div>
    </article>
  );
}

function LoginScreen({
  onLogin, notice,
}: {
  onLogin: (token: string, mustChange: boolean) => void;
  notice: string;
}) {
  const {
    register, handleSubmit, setError, formState: { errors, isSubmitting },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) });

  async function submit(fields: LoginFields) {
    try {
      const result = await login(fields.email, fields.password);
      onLogin(result.access_token, result.must_change_password);
    } catch (reason) {
      setError("root.server", {
        type: "server",
        message: reason instanceof Error ? reason.message : "Unable to sign in.",
      });
    }
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <img className="company-logo login-company-logo" src="/byan-technologies-logo.png" alt="BYAN Technologies" />
        <p>Crusher ERP + HR</p>
        <div className="login-brand-note">One clear view of your operations.</div>
      </section>
      <form className="login-card" onSubmit={handleSubmit(submit)} noValidate>
        <span className="eyebrow">WELCOME BACK</span>
        <h1>Sign in to your workspace</h1>
        <p className="muted">Use your QUARRY ONE account credentials.</p>
        {notice && <div className="notice info" role="status">{notice}</div>}
        <label htmlFor="email">Email address</label>
        <input id="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} {...register("email")} />
        {errors.email && <div className="form-error" role="alert">{errors.email.message}</div>}
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
        {errors.password && <div className="form-error" role="alert">{errors.password.message}</div>}
        {errors.root?.server?.message && <div className="form-error" role="alert">{errors.root.server.message}</div>}
        <button className="primary-button login-button" disabled={isSubmitting}>{isSubmitting ? "Signing in..." : "Sign in"}</button>
        <div className="login-secure"><ShieldCheck size={15} /> Your connection is protected</div>
      </form>
    </main>
  );
}

function PasswordChange({
  token, onComplete,
}: {
  token: string;
  onComplete: () => void;
}) {
  const {
    register, handleSubmit, setError, formState: { errors, isSubmitting },
  } = useForm<PasswordChangeFields>({ resolver: zodResolver(passwordChangeSchema) });

  async function submit(fields: PasswordChangeFields) {
    try {
      await changePassword(token, fields.currentPassword, fields.newPassword);
      onComplete();
    } catch (reason) {
      setError("root.server", {
        type: "server",
        message: reason instanceof Error ? reason.message : "Unable to update password.",
      });
    }
  }

  return (
    <main className="password-shell">
      <form className="login-card" onSubmit={handleSubmit(submit)} noValidate>
        <img className="company-logo password-company-logo" src="/byan-technologies-logo.png" alt="BYAN Technologies" />
        <span className="eyebrow">ACCOUNT SECURITY</span>
        <h1>Change your password</h1>
        <p className="muted">Set a new password before continuing. Use at least 12 characters.</p>
        <label htmlFor="current-password">Current password</label>
        <input id="current-password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.currentPassword)} {...register("currentPassword")} />
        {errors.currentPassword && <div className="form-error" role="alert">{errors.currentPassword.message}</div>}
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.newPassword)} {...register("newPassword")} />
        {errors.newPassword && <div className="form-error" role="alert">{errors.newPassword.message}</div>}
        <label htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmation)} {...register("confirmation")} />
        {errors.confirmation && <div className="form-error" role="alert">{errors.confirmation.message}</div>}
        {errors.root?.server?.message && <div className="form-error" role="alert">{errors.root.server.message}</div>}
        <button className="primary-button login-button" disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Update password"}</button>
      </form>
    </main>
  );
}

function Dashboard({
  token, onLogout, demoRecords, onDemoRecordsChange,
}: {
  token: string;
  onLogout: () => void;
  demoRecords: DemoRecord[];
  onDemoRecordsChange: (records: DemoRecord[]) => void;
}) {
  const [plantId, setPlantId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const profile = useQuery({ queryKey: ["profile", token], queryFn: () => getProfile(token) });
  const plants = useQuery({ queryKey: ["plants", token], queryFn: () => getPlants(token) });
  const summary = useQuery({
    queryKey: ["dashboard", token, plantId],
    queryFn: () => getDashboard(token, plantId || undefined),
  });
  const selectedPlantName = useMemo(
    () => plants.data?.find((plant) => plant.id === plantId)?.name ?? "All Plants",
    [plants.data, plantId],
  );
  const activePage = [...navigation, ...extraRoutes].find((item) => item.path === pathname)?.label ?? "Dashboard";
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date());

  if (profile.data?.must_change_password) {
    return <PasswordChange token={token} onComplete={onLogout} />;
  }

  if (summary.isError || plants.isError || profile.isError) {
    return (
      <div className="connection-error">
        <CircleHelp size={30} />
        <h1>Couldn’t load your workspace</h1>
        <p>{(summary.error ?? plants.error ?? profile.error)?.message}</p>
        <button className="secondary-button" onClick={() => { void summary.refetch(); void plants.refetch(); void profile.refetch(); }}>Try again</button>
        <button className="text-button" onClick={onLogout}>Sign out</button>
      </div>
    );
  }

  const total = (module: string, key: string) => demoRecords
    .filter((record) => record.module === module)
    .reduce((sum, record) => sum + Number(record.values[key] ?? 0), 0);
  const metrics = {
    production_tonnes: { value: total("production", "tonnes"), unit: "t", previous_period_value: 0, has_data: true },
    dispatches: { value: demoRecords.filter((record) => record.module === "dispatch").length, unit: "count", previous_period_value: 0, has_data: true },
    sales_revenue_inr: { value: total("sales", "amount_inr"), unit: "INR", previous_period_value: 0, has_data: true },
    stock_tonnes: { value: demoRecords.filter((record) => record.module === "stock").reduce((sum, record) => sum + stockAvailable(record), 0), unit: "t", previous_period_value: 0, has_data: true },
    diesel_litres: { value: total("diesel_fuel", "litres"), unit: "L", previous_period_value: 0, has_data: true },
  };
  const productionEntries = demoRecords.filter((record) => record.module === "production").slice(0, 4);
  const activityEntries = [...demoRecords]
    .filter((record) => record.values.date)
    .sort((left, right) => String(right.values.date).localeCompare(String(left.values.date)))
    .slice(0, 4);
  const employeeEntries = demoRecords.filter((record) => record.module === "hr");

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="sidebar-brand">
            <img className="company-logo sidebar-company-logo" src="/byan-technologies-logo.png" alt="BYAN Technologies" />
            <div className="brand-subtitle">QUARRY ONE · Crusher ERP + HR</div>
          </div>
          <button className="icon-button sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activePage === label ? "selected" : ""}`} onClick={() => { navigate(navigation.find((item) => item.label === label)?.path ?? "/"); setSidebarOpen(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === "Operations" && <ChevronDown className="nav-chevron" size={14} />}
            </button>
          ))}
          <button className={`nav-item ai-nav ${activePage === "AI Assistant" ? "selected" : ""}`} onClick={() => { navigate("/ai-assistant"); setSidebarOpen(false); }}>
            <Sparkles size={18} /><span>AI Assistant</span><span className="new-badge">NEW</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${activePage === "Settings" ? "selected" : ""}`} onClick={() => navigate("/settings")}><Settings size={18} /><span>Settings</span></button>
          <div className="profile">
            <div className="avatar">Q</div>
            <div className="profile-copy"><strong>{profile.data?.full_name ?? "Loading profile..."}</strong><span>{profile.data?.roles.join(", ") ?? "Signed in"}</span></div>
            <button className="icon-button profile-action" aria-label="Sign out" onClick={onLogout}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
            <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activePage}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="plant-select"><span className="plant-indicator" /><select value={plantId} aria-label="Select plant" onChange={(event) => setPlantId(event.target.value)}><option value="">All Plants</option>{plants.data?.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}</select><ChevronDown size={14} /></label>
            <span className="top-date"><CalendarDays size={15} />{dateLabel}</span>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button>
          </div>
        </header>
        <div className="page-content">
          {activePage === "Dashboard" ? <>
          <section className="welcome-row">
            <div><div className="eyebrow">OVERVIEW <span className="live-dot" /> LIVE WORKSPACE</div><h1>Good day, {profile.data?.full_name ?? "..."}</h1><p>Here’s what’s happening across <strong>{selectedPlantName}</strong>.</p></div>
            <button className="secondary-button" onClick={() => { void summary.refetch(); void plants.refetch(); }}><Activity size={16} /> Refresh data</button>
          </section>
          <section className="metric-grid" aria-label="Business metrics">
            {!metrics ? <div className="loading-card">Loading authorized business data...</div> : <>
              <MetricCard label="Total Production" metric={metrics.production_tonnes} icon={Gauge} tone="blue" demo />
              <MetricCard label="Dispatches" metric={metrics.dispatches} icon={Truck} tone="violet" demo />
              <MetricCard label="Sales Revenue" metric={metrics.sales_revenue_inr} icon={Wallet} tone="green" demo />
              <MetricCard label="Stock Available" metric={metrics.stock_tonnes} icon={Boxes} tone="orange" demo />
              <MetricCard label="Diesel Consumption" metric={metrics.diesel_litres} icon={Fuel} tone="cyan" demo />
            </>}
          </section>
          <div className="notice info demo-dashboard-note"><Sparkles size={16} /><span>Sample workspace is active. Module edits are saved in this browser and are not posted to the company database.</span></div>
          <Suspense fallback={<div className="loading-card">Loading sales and production charts...</div>}>
            <DashboardCharts records={demoRecords} userName={profile.data?.full_name ?? "current user"} />
          </Suspense>
          <div className="content-grid">
            <section className="panel production-panel">
              <div className="panel-heading"><div><h2>Production overview</h2><p>Daily output across your authorized plants</p></div><button className="select-pill">Today <ChevronDown size={14} /></button></div>
              <div className="demo-production-list">
                {productionEntries.map((record) => <div key={record.id}><span><strong>{String(record.values.product)}</strong><small>{String(record.values.shift)} shift · {String(record.values.date)}</small></span><b>{numberFormatter.format(Number(record.values.tonnes))} t</b></div>)}
                {!productionEntries.length && <div className="compact-empty">No production entries yet. Add a shift record in Production.</div>}
              </div>
            </section>
            <section className="panel plant-panel">
              <div className="panel-heading"><div><h2>Plant status</h2><p>Operating status and capacity</p></div><button className="icon-button subtle" aria-label="Plant status details"><ChevronDown size={17} /></button></div>
              <div className="plant-empty"><div className="plant-illustration"><Gauge size={29} /></div><strong>{plants.data?.length ? "Plant monitoring is not configured" : "No plants configured"}</strong><span>{plants.data?.length ? "Equipment status will appear after equipment setup." : "Create a plant to start organizing operations."}</span></div>
              <div className="panel-footer"><span>{plants.data?.length ?? 0} authorized plants</span><span className="status-dot neutral" /> Awaiting setup</div>
            </section>
          </div>
          <div className="content-grid lower-grid">
            <section className="panel ai-panel">
              <div className="ai-heading"><div className="ai-spark"><Sparkles size={18} /></div><div><h2>Ask Quarry AI</h2><p>Answers based on your authorized business data</p></div><span className="new-badge">PREVIEW</span></div>
              <div className="ai-empty"><Sparkles size={22} /><span>Rule-based demo insights are available.</span><small>Answers use only sample records in this browser; no AI provider is connected.</small></div>
              <button className="secondary-button ai-open-button" onClick={() => navigate("/ai-assistant")}>Open demo assistant <ArrowUpRight size={14} /></button>
            </section>
            <section className="panel quick-panel">
              <div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks for your team</p></div></div>
              <div className="quick-grid">
                {[
                  ["New weighment", Gauge, "blue", "/weighbridge"], ["Create dispatch", Truck, "violet", "/dispatch-transport"],
                  ["Add stock entry", Boxes, "orange", "/stock-inventory"], ["Create invoice", CreditCard, "green", "/sales-billing"],
                  ["Record fuel fill", Fuel, "cyan", "/diesel-fuel"], ["Mark attendance", Users, "cyan", "/hr-payroll"],
                  ["Apply leave", CalendarDays, "rose", "/hr-payroll"],
                ].map(([label, Icon, tone, path]) => {
                  const ActionIcon = Icon as typeof Plus;
                  return <button key={label as string} className="quick-action" onClick={() => navigate(path as string)}><span className={`quick-icon ${tone as string}`}><ActionIcon size={17} /></span><span>{label as string}</span><Plus size={14} className="quick-plus" /></button>;
                })}
              </div>
            </section>
          </div>
          <div className="content-grid operations-grid">
            <section className="panel recent-panel">
              <div className="panel-heading"><div><h2>Recent activity</h2><p>Latest activity in this workspace</p></div><button className="select-pill">View all <ArrowUpRight size={13} /></button></div>
              <div className="dashboard-activity-list">{activityEntries.map((record) => <div key={record.id}><span className="mini-empty-icon"><Clock3 size={15} /></span><span><strong>{String(record.values.ticket ?? record.values.dispatch_no ?? record.values.description ?? record.values.product ?? "Demo activity")}</strong><small>{String(record.values.date)} · {String(record.values.status ?? record.module)}</small></span></div>)}</div>
            </section>
            <section className="panel workforce-panel">
              <div className="panel-heading"><div><h2>HR overview</h2><p>People and attendance</p></div><Users size={17} className="panel-trailing-icon" /></div>
              <div className="dashboard-summary"><Users size={22} /><strong>{employeeEntries.length} sample employee records</strong><span>{numberFormatter.format(employeeEntries.reduce((sum, record) => sum + Number(record.values.attendance_days ?? 0), 0))} attendance days across current examples.</span><button className="text-button" onClick={() => navigate("/hr-payroll")}>Open HR & Payroll</button></div>
            </section>
            <section className="panel payroll-panel">
              <div className="panel-heading"><div><h2>Payroll status</h2><p>Current payroll cycle</p></div><Wallet size={16} className="panel-trailing-icon" /></div>
              <div className="dashboard-summary"><ShieldCheck size={22} /><strong>{inrFormatter.format(employeeEntries.reduce((sum, record) => sum + Number(record.values.net_salary ?? 0), 0))} sample net pay</strong><span>Values are examples only and are not statutory payroll calculations.</span><button className="text-button" onClick={() => navigate("/hr-payroll")}>Review payroll examples</button></div>
            </section>
          </div>
          <section className="plant-photo-placeholder">
            <div className="photo-placeholder-icon"><ImageOff size={20} /></div>
            <div><strong>Plant photo and equipment monitoring are not configured</strong><span>Plant images, machine state, and production indicators will be shown when equipment data is connected.</span></div>
            <span className="photo-status"><span className="status-dot neutral" /> No equipment data</span>
          </section>
          <div className="ai-insight-banner"><div className="ai-spark"><Sparkles size={17} /></div><div><strong>AI operational insights are disabled</strong><span>Insights will be enabled only after a provider and permission-checked data tools are configured.</span></div><span className="disabled-label">NOT CONFIGURED</span></div>
          <footer className="page-footer"><span>QUARRY ONE <i /> Local demo workspace</span><span>Dashboard values are calculated from browser sample records</span></footer>
          </> : <ModuleWorkspace page={activePage} records={demoRecords} onRecordsChange={onDemoRecordsChange} onNavigate={navigate} />}
        </div>
      </main>
    </div>
  );
}

function AppContent() {
  const [token, setToken] = useState(() => sessionStorage.getItem("quarry_access_token"));
  const [mustChange, setMustChange] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [demoRecords, setDemoRecords] = useState(() => readDemoRecords());
  useEffect(() => {
    localStorage.setItem(demoStorageKey, JSON.stringify(demoRecords));
  }, [demoRecords]);
  function handleLogin(accessToken: string, passwordChangeRequired: boolean) {
    sessionStorage.setItem("quarry_access_token", accessToken);
    setAuthNotice("");
    setMustChange(passwordChangeRequired);
    setToken(accessToken);
  }
  function clearSession() {
    sessionStorage.removeItem("quarry_access_token");
    setToken(null);
    setMustChange(false);
  }
  function handleLogout() {
    const activeToken = token;
    clearSession();
    if (activeToken) {
      void logout(activeToken).catch((reason: unknown) => {
        setAuthNotice(`Local sign-out completed, but server revocation could not be confirmed: ${reason instanceof Error ? reason.message : "request failed"}`);
      });
    }
  }
  if (!token) return <LoginScreen onLogin={handleLogin} notice={authNotice} />;
  if (mustChange) return <PasswordChange token={token} onComplete={clearSession} />;
  return <Dashboard token={token} onLogout={handleLogout} demoRecords={demoRecords} onDemoRecordsChange={setDemoRecords} />;
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>;
}
