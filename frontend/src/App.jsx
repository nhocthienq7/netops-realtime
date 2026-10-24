
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bell, Building2, Cable, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Cpu, Download,
  Gauge, Globe, HardDrive, LayoutDashboard, LoaderCircle, LockKeyhole,
  LogOut, Monitor, Network, Pencil, Plus, RefreshCw, Router, Search,
  Server, Settings, ShieldCheck, Trash2, Wifi, X, XCircle, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Topology", icon: Network },
  { label: "Devices", icon: Server },
  { label: "Incidents", icon: AlertTriangle },
  { label: "Monitoring", icon: Activity },
  { label: "Sites", icon: Building2 },
  { label: "Automation", icon: Zap },
  { label: "Settings", icon: Settings },
];

const EMPTY_DEVICE = {
  site_id: "", name: "", vendor: "", model: "", device_type: "Router",
  address: "", ping_enabled: true, snmp_enabled: false, snmp_port: 161,
  snmp_version: "2c", snmp_community: "public",
};

const emptyArray = value => {
  if (Array.isArray(value)) return value;
  for (const key of ["items", "devices", "sites", "events"]) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
};

function tokenNow() {
  return localStorage.getItem("netops_token") || "";
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = tokenNow();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; }
  catch { data = raw; }

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `API trả về lỗi HTTP ${response.status}`
    );
  }
  return data;
}

function statusOf(device) {
  const value = String(device?.status || "unknown").toLowerCase();
  if (["online", "up", "healthy"].includes(value)) return "online";
  if (["offline", "down", "unreachable"].includes(value)) return "offline";
  return "unknown";
}

function typeOf(device) {
  return String(device?.device_type || device?.type || "Other");
}

function DeviceIcon({ type, size = 19 }) {
  const t = String(type || "").toLowerCase();
  if (t.includes("router") || t.includes("gateway") || t.includes("firewall"))
    return <Router size={size} />;
  if (t.includes("switch")) return <Network size={size} />;
  if (t.includes("wifi") || t.includes("wi-fi") || t.includes("access point") || t === "ap")
    return <Wifi size={size} />;
  if (t.includes("server") || t.includes("nvr")) return <Server size={size} />;
  return <Monitor size={size} />;
}

function Status({ value }) {
  const status = statusOf({ status: value });
  const Icon = status === "online" ? CheckCircle2 :
    status === "offline" ? XCircle : CircleHelp;
  const label = status === "online" ? "Online" :
    status === "offline" ? "Offline" : "Unknown";
  return <span className={`status-pill ${status}`}><Icon size={13} />{label}</span>;
}

function Panel({ title, icon: Icon, action, className = "", children }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div className="panel-title"><Icon size={17} /><h3>{title}</h3></div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({ title, value, note, icon: Icon, tone }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={23} /></div>
      <div className="metric-copy">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function Empty({ title, detail, icon: Icon = CircleHelp }) {
  return (
    <div className="empty-state">
      <Icon size={27} />
      <b>{title}</b>
      <span>{detail}</span>
    </div>
  );
}

function dateLabel(value) {
  if (!value) return "Chưa có thời gian";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) :
    date.toLocaleString("vi-VN");
}

export default function App() {
  const [token, setToken] = useState(tokenNow);
  const [page, setPage] = useState("Dashboard");
  const [me, setMe] = useState(null);
  const [sites, setSites] = useState([]);
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [auth, setAuth] = useState({ organization: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState("");
  const [editingDevice, setEditingDevice] = useState(null);
  const [editingSite, setEditingSite] = useState(null);
  const [deviceForm, setDeviceForm] = useState(EMPTY_DEVICE);
  const [siteForm, setSiteForm] = useState({ name: "", address: "" });

  const loadData = useCallback(async (quiet = false) => {
    if (!tokenNow()) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      api("/api/me"), api("/api/devices"), api("/api/sites"),
      api("/api/events"), api("/api/dashboard"),
    ]);

    const [meResult, deviceResult, siteResult, eventResult, dashResult] = results;
    if (meResult.status === "rejected") {
      setError(meResult.reason?.message || "Không thể kết nối API.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setMe(meResult.value);
    if (deviceResult.status === "fulfilled") setDevices(emptyArray(deviceResult.value));
    else setError(deviceResult.reason?.message || "Không tải được thiết bị.");
    if (siteResult.status === "fulfilled") setSites(emptyArray(siteResult.value));
    if (eventResult.status === "fulfilled") setEvents(emptyArray(eventResult.value));
    if (dashResult.status === "fulfilled") setDashboard(dashResult.value);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadData();
    const timer = setInterval(() => loadData(true), 15000);
    return () => clearInterval(timer);
  }, [token, loadData]);

  const online = devices.filter(d => statusOf(d) === "online").length;
  const offline = devices.filter(d => statusOf(d) === "offline").length;
  const unknown = devices.length - online - offline;
  const selectedSite = sites.find(s => String(s.id) === String(selectedSiteId));
  const visibleDevices = useMemo(() => devices.filter(d => {
    const matchesSite = selectedSiteId === "all" ||
      String(d.site_id) === String(selectedSiteId);
    const haystack = `${d.name || ""} ${d.address || ""} ${d.vendor || ""} ${d.model || ""} ${typeOf(d)}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    if (page === "Incidents") return matchesSite && matchesSearch && statusOf(d) === "offline";
    if (page === "Router") return matchesSite && matchesSearch && typeOf(d).toLowerCase().includes("router");
    if (page === "Switch") return matchesSite && matchesSearch && typeOf(d).toLowerCase().includes("switch");
    if (page === "Wi-Fi") return matchesSite && matchesSearch && /wifi|wi-fi|access point|\bap\b/i.test(typeOf(d));
    return matchesSite && matchesSearch;
  }), [devices, selectedSiteId, search, page]);

  const chartData = useMemo(() => {
    const raw = dashboard?.traffic_history || dashboard?.history || [];
    return raw.map((item, index) => ({
      time: item.time || item.timestamp || `${index + 1}`,
      inbound: Number(item.inbound ?? item.rx ?? 0),
      outbound: Number(item.outbound ?? item.tx ?? 0),
    }));
  }, [dashboard]);

  async function submitAuth(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const register = authMode === "register";
      const result = await api(register ? "/api/auth/register" : "/api/auth/login", {
        method: "POST", body: JSON.stringify(auth),
      });
      const newToken = result?.access_token || result?.token;
      if (!newToken) {
        if (register) {
          setAuthMode("login");
          setNotice("Đăng ký xong nếu backend yêu cầu đăng nhập lại.");
        } else setError("API đăng nhập chưa trả về access_token.");
      } else {
        localStorage.setItem("netops_token", newToken);
        setToken(newToken);
      }
    } catch (err) { setError(err.message || "Đăng nhập thất bại."); }
    finally { setSaving(false); }
  }

  function logout() {
    localStorage.removeItem("netops_token");
    setToken("");
    setMe(null);
    setSites([]);
    setDevices([]);
    setEvents([]);
    setDashboard(null);
  }

  function newDevice() {
    setEditingDevice(null);
    setDeviceForm({ ...EMPTY_DEVICE, site_id: sites[0]?.id ?? "" });
    setModal("device");
  }

  function editDevice(device) {
    setEditingDevice(device);
    setDeviceForm({ ...EMPTY_DEVICE, ...device, site_id: device.site_id ?? "", snmp_community: "public" });
    setModal("device");
  }

  async function saveDevice(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        ...deviceForm,
        site_id: Number(deviceForm.site_id),
        snmp_port: Number(deviceForm.snmp_port || 161),
      };
      if (!body.site_id) throw new Error("Chọn site cho thiết bị trước khi lưu.");
      await api(editingDevice ? `/api/devices/${editingDevice.id}` : "/api/devices", {
        method: editingDevice ? "PUT" : "POST", body: JSON.stringify(body),
      });
      setModal("");
      setNotice(editingDevice ? "Đã cập nhật thiết bị." : "Đã thêm thiết bị.");
      await loadData(true);
    } catch (err) { setError(err.message || "Không lưu được thiết bị."); }
    finally { setSaving(false); }
  }

  async function deleteDevice(device) {
    if (!window.confirm(`Xóa thiết bị "${device.name}"?`)) return;
    try {
      await api(`/api/devices/${device.id}`, { method: "DELETE" });
      setNotice("Đã xóa thiết bị.");
      await loadData(true);
    } catch (err) { setError(err.message || "Xóa thiết bị thất bại."); }
  }

  async function saveSite(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(editingSite ? `/api/sites/${editingSite.id}` : "/api/sites", {
        method: editingSite ? "PUT" : "POST", body: JSON.stringify(siteForm),
      });
      setModal("");
      setNotice(editingSite ? "Đã cập nhật site." : "Đã tạo site.");
      await loadData(true);
    } catch (err) { setError(err.message || "Không lưu được site."); }
    finally { setSaving(false); }
  }

  async function deleteSite(site) {
    if (!window.confirm(`Xóa site "${site.name}"?`)) return;
    try {
      await api(`/api/sites/${site.id}`, { method: "DELETE" });
      setNotice("Đã xóa site.");
      await loadData(true);
    } catch (err) { setError(err.message || "Xóa site thất bại."); }
  }

  function exportCsv() {
    const rows = [
      ["Tên thiết bị", "IP", "Loại", "Hãng", "Model", "Site", "Trạng thái"],
      ...visibleDevices.map(d => [
        d.name, d.address, typeOf(d), d.vendor, d.model,
        sites.find(s => String(s.id) === String(d.site_id))?.name || d.site_id,
        statusOf(d),
      ]),
    ];
    const csv = "\uFEFF" + rows.map(row =>
      row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")
    ).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "netops-devices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!token) return (
    <div className="auth-screen">
      <div className="auth-brand"><Activity size={27} /><b>NetOps <span>Realtime</span></b></div>
      <div className="auth-layout">
        <div className="auth-promo">
          <span className="eyebrow">NETWORK OPERATIONS CENTER</span>
          <h1>Toàn bộ hạ tầng mạng.<br /><em>Một nơi quản lý.</em></h1>
          <p>Giám sát tập trung router, switch, Wi-Fi và thiết bị tại nhiều địa điểm.</p>
          <div className="auth-benefits"><span><ShieldCheck /> Quản lý đa site</span><span><Activity /> Theo dõi trạng thái</span><span><Network /> Kiểm kê thiết bị mạng</span></div>
        </div>
        <form className="auth-card" onSubmit={submitAuth}>
          <div className="auth-card-icon"><LockKeyhole /></div>
          <h2>{authMode === "login" ? "Đăng nhập hệ thống" : "Tạo tổ chức"}</h2>
          <p>Đăng nhập để tiếp tục đến Network Command Center.</p>
          {authMode === "register" && <label>Tên tổ chức<input required value={auth.organization} onChange={e => setAuth({ ...auth, organization: e.target.value })} placeholder="Tên công ty" /></label>}
          <label>Email<input required type="email" value={auth.email} onChange={e => setAuth({ ...auth, email: e.target.value })} placeholder="admin@company.com" /></label>
          <label>Mật khẩu<input required type="password" value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} placeholder="Nhập mật khẩu" /></label>
          {error && <div className="error-banner">{error}</div>}
          <button className="primary-button auth-submit" disabled={saving}>{saving ? "Đang xử lý…" : authMode === "login" ? "Đăng nhập" : "Đăng ký"}</button>
          <button type="button" className="text-button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }}>{authMode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}</button>
          <small className="api-address">API: {API}</small>
        </form>
      </div>
    </div>
  );

  return (
    <div className="netops-app">
      <header className="topbar">
        <button className="brand" onClick={() => setPage("Dashboard")}><span className="brand-mark"><Activity /></span><b>NetOps <em>Realtime</em></b></button>
        <nav className="top-nav">
          {NAV.map(item => {
            const Icon = item.icon;
            return <button key={item.label} className={`top-nav-item ${page === item.label ? "active" : ""}`} onClick={() => setPage(item.label)}>
              <Icon size={17} /><span>{item.label}</span>
              {item.label === "Incidents" && offline > 0 && <i className="nav-badge">{offline}</i>}
            </button>;
          })}
        </nav>
        <div className="top-actions">
          <label className="site-select"><Globe size={16} /><select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)}><option value="all">All Sites</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={14} /></label>
          <button className="icon-button" title="Làm mới" onClick={() => loadData(true)}><RefreshCw size={17} className={refreshing ? "spin" : ""} /></button>
          <button className="avatar-button" title={me?.email || "Tài khoản"} onClick={logout}>{(me?.email || "AD").slice(0, 2).toUpperCase()}</button>
        </div>
      </header>

      <main className="page-shell">
        {error && <div className="error-banner"><AlertTriangle size={17} />{error}<button onClick={() => setError("")}><X size={15} /></button></div>}
        {notice && <div className="notice-banner">{notice}<button onClick={() => setNotice("")}><X size={15} /></button></div>}

        {page === "Dashboard" && <>
          <div className="metric-grid">
            <Metric title="Total Sites" value={loading ? "…" : sites.length} note={`${sites.length} site đã khai báo`} icon={Server} tone="green" />
            <Metric title="Total Devices" value={loading ? "…" : devices.length} note={`${online} Online / ${offline} Offline`} icon={Network} tone="blue" />
            <Metric title="Active Incidents" value={events.filter(e => !/resolved|clear|recovered/i.test(String(e.status || e.level || ""))).length} note={`${offline} thiết bị Offline`} icon={AlertTriangle} tone="red" />
            <Metric title="System Uptime" value={dashboard?.uptime ?? "—"} note="Chỉ hiển thị khi API cung cấp" icon={Clock3} tone="purple" />
          </div>

          <div className="dashboard-main-grid">
            <aside className="panel site-sidebar">
              <div className="panel-heading"><div className="panel-title"><Building2 size={17} /><h3>Sites</h3></div><button className="icon-button" onClick={() => { setEditingSite(null); setSiteForm({ name: "", address: "" }); setModal("site"); }} title="Thêm site"><Plus size={17} /></button></div>
              <div className="site-search"><Search size={15} /><input placeholder="Search site..." value={search} onChange={e => setSearch(e.target.value)} /></div>
              <div className="site-list">
                {sites.filter(s => String(s.name || "").toLowerCase().includes(search.toLowerCase())).map(site => {
                  const ds = devices.filter(d => String(d.site_id) === String(site.id));
                  const up = ds.filter(d => statusOf(d) === "online").length;
                  const down = ds.filter(d => statusOf(d) === "offline").length;
                  const siteStatus = down ? "offline" : ds.length && up === ds.length ? "online" : "unknown";
                  return <button key={site.id} className={`site-item ${String(selectedSiteId) === String(site.id) ? "selected" : ""}`} onClick={() => setSelectedSiteId(String(site.id))}>
                    <i className={`site-dot ${siteStatus}`} /><span className="site-item-copy"><b>{site.name}</b><small>{site.address || "Chưa có địa chỉ"}</small><small>{up} online · {ds.length} thiết bị</small></span><ChevronRight size={16} />
                  </button>;
                })}
                {!sites.length && <Empty title="Chưa có site" detail="Thêm site để bắt đầu." icon={Building2} />}
              </div>
            </aside>

            <Panel title="Network Topology" icon={Cable} className="topology-panel" action={<span className="live-tag"><i /> Live</span>}>
              <div className="topology-canvas">
                <div className="internet-node"><Globe size={30} /><b>Internet / WAN</b></div>
                <div className="topology-stem" />
                <div className="core-node"><Router size={28} /><b>{selectedSite ? selectedSite.name : "All Sites"}</b><small>Site gateway / router</small></div>
                <div className="topology-branches">
                  {sites.filter(s => selectedSiteId === "all" || String(s.id) === String(selectedSiteId)).map(site => {
                    const ds = devices.filter(d => String(d.site_id) === String(site.id));
                    const up = ds.filter(d => statusOf(d) === "online").length;
                    const down = ds.filter(d => statusOf(d) === "offline").length;
                    const state = down ? "offline" : ds.length && up === ds.length ? "online" : "unknown";
                    return <button key={site.id} className={`topology-site-node ${state}`} onClick={() => setSelectedSiteId(String(site.id))}>
                      <Building2 size={24} /><b>{site.name}</b><small>{ds.length} devices</small><Status value={state} />
                    </button>;
                  })}
                </div>
                <div className="topology-legend"><span><i className="site-dot online" />Normal</span><span><i className="site-dot unknown" />Unknown</span><span><i className="site-dot offline" />Offline</span></div>
                <p className="topology-note">Các node biểu diễn site và trạng thái thiết bị từ API, không khẳng định đường nối vật lý.</p>
              </div>
            </Panel>

            <Panel title="Recent Incidents" icon={AlertTriangle} className="incidents-panel" action={<button className="link-button" onClick={() => setPage("Incidents")}>View all <ChevronRight size={14} /></button>}>
              <div className="incident-list">
                {events.slice(0, 6).map((event, i) => <div className="incident-row" key={event.id ?? i}>
                  <span className={`incident-symbol ${String(event.level || "").toLowerCase()}`}><AlertTriangle size={15} /></span>
                  <div className="incident-copy"><b>{event.device_name || `Device #${event.device_id ?? "—"}`}</b><small>{event.message || event.event_type || "Monitoring event"}</small><time>{dateLabel(event.created_at)}</time></div>
                </div>)}
                {!events.length && <Empty title="Chưa có sự kiện" detail="Sự kiện sẽ hiển thị khi backend ghi nhận." icon={CheckCircle2} />}
              </div>
            </Panel>

            <Panel title="Site Status" icon={Activity} className="site-status-panel" action={<button className="link-button" onClick={() => setPage("Sites")}>View all <ChevronRight size={14} /></button>}>
              <div className="site-status-list">
                {sites.map(site => {
                  const ds = devices.filter(d => String(d.site_id) === String(site.id));
                  const up = ds.filter(d => statusOf(d) === "online").length;
                  const pct = ds.length ? up / ds.length * 100 : 0;
                  return <div className="site-status-row" key={site.id}><span>{site.name}</span><div className="progress-track"><i style={{ width: `${pct}%` }} /></div><small>{up}/{ds.length}</small></div>;
                })}
                {!sites.length && <Empty title="Chưa có site" detail="Dữ liệu sẽ xuất hiện sau khi thêm site." icon={Building2} />}
              </div>
            </Panel>
          </div>

          <div className="bottom-grid">
            <Panel title="Traffic Overview" icon={Activity} className="traffic-panel">
              {chartData.length ? <div className="traffic-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="rxFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#159cff" stopOpacity={0.28} /><stop offset="95%" stopColor="#159cff" stopOpacity={0} /></linearGradient><linearGradient id="txFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#12d6a0" stopOpacity={0.2} /><stop offset="95%" stopColor="#12d6a0" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#18304a" strokeDasharray="3 3" /><XAxis dataKey="time" stroke="#7188a4" tick={{ fontSize: 10 }} /><YAxis stroke="#7188a4" tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ background: "#08172a", border: "1px solid #203a57", borderRadius: 8 }} /><Area type="monotone" dataKey="inbound" name="Inbound" stroke="#159cff" fill="url(#rxFill)" /><Area type="monotone" dataKey="outbound" name="Outbound" stroke="#12d6a0" fill="url(#txFill)" /></AreaChart></ResponsiveContainer></div> : <Empty title="Chưa có lịch sử traffic" detail="Backend chưa trả về traffic_history/history. Không tạo dữ liệu giả." icon={Activity} />}
            </Panel>

            <Panel title="Device Health" icon={ShieldCheck} className="health-panel">
              <div className="health-ring" style={{ "--online-pct": `${devices.length ? online / devices.length * 100 : 0}%` }}><div><b>{devices.length}</b><small>Total</small></div></div>
              <div className="health-legend"><span><i className="site-dot online" />Online <b>{online}</b></span><span><i className="site-dot unknown" />Unknown <b>{unknown}</b></span><span><i className="site-dot offline" />Offline <b>{offline}</b></span></div>
            </Panel>

            <Panel title="Top Devices by CPU" icon={Cpu} className="cpu-panel" action={<button className="link-button" onClick={() => setPage("Devices")}>View all <ChevronRight size={14} /></button>}>
              <div className="table-scroll"><table className="mini-table"><thead><tr><th>Device / Site</th><th>Status</th></tr></thead><tbody>
                {devices.slice(0, 5).map(d => <tr key={d.id}><td><b>{d.name}</b><small>{d.address || "No IP"} · {sites.find(s => String(s.id) === String(d.site_id))?.name || "Unknown site"}</small></td><td><Status value={d.status} /></td></tr>)}
              </tbody></table></div>
              <small className="muted-note">CPU chưa hiển thị vì API hiện tại chưa có chỉ số CPU cho từng thiết bị.</small>
            </Panel>

            <Panel title="System Resources" icon={Gauge} className="resources-panel">
              <div className="resource-placeholder"><div><Cpu /><b>—</b><small>CPU</small></div><div><Activity /><b>—</b><small>Memory</small></div><div><HardDrive /><b>—</b><small>Disk</small></div></div>
              <p className="muted-note">Chưa có số liệu tài nguyên hệ thống từ API.</p>
            </Panel>
          </div>
        </>}

        {page === "Topology" && <Panel title={`Topology ${selectedSite ? `— ${selectedSite.name}` : "— All Sites"}`} icon={Cable}>
          <p className="section-description">Sơ đồ tổng quan site và thiết bị hiện có. Đường kết nối vật lý cần dữ liệu topology hoặc LLDP/CDP.</p>
          <div className="topology-inventory">{sites.filter(s => selectedSiteId === "all" || String(s.id) === String(selectedSiteId)).map(site => <div className="topology-inventory-site" key={site.id}><h4><Building2 size={17} />{site.name}</h4><div className="inventory-nodes">{devices.filter(d => String(d.site_id) === String(site.id)).map(d => <article className="inventory-node" key={d.id}><DeviceIcon type={typeOf(d)} /><span><b>{d.name}</b><small>{d.address || "Chưa có IP"}</small></span><Status value={d.status} /></article>)}</div></div>)}</div>
        </Panel>}

        {["Devices", "Router", "Switch", "Wi-Fi", "Incidents"].includes(page) && <Panel title={page === "Incidents" ? "Thiết bị Offline / cần chú ý" : `${page} Inventory`} icon={page === "Incidents" ? AlertTriangle : Server} action={<div className="heading-actions"><button className="secondary-button" onClick={exportCsv}><Download size={15} /> Export CSV</button>{page !== "Incidents" && <button className="primary-button" onClick={newDevice}><Plus size={15} /> Add Device</button>}</div>}>
          <div className="filter-toolbar"><div className="search-input"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên thiết bị, IP, hãng..." /></div><span className="muted-note">{visibleDevices.length} thiết bị</span></div>
          <div className="table-scroll"><table className="device-table"><thead><tr><th>Device</th><th>Site</th><th>Type</th><th>Vendor / Model</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {visibleDevices.map(d => <tr key={d.id}><td><div className="device-name"><DeviceIcon type={typeOf(d)} /><span><b>{d.name}</b><small>{d.address || "Chưa có IP"}</small></span></div></td><td>{sites.find(s => String(s.id) === String(d.site_id))?.name || "—"}</td><td>{typeOf(d)}</td><td>{[d.vendor, d.model].filter(Boolean).join(" / ") || "—"}</td><td><Status value={d.status} /></td><td><div className="row-actions"><button className="icon-button" title="Sửa" onClick={() => editDevice(d)}><Pencil size={15} /></button><button className="icon-button danger" title="Xóa" onClick={() => deleteDevice(d)}><Trash2 size={15} /></button></div></td></tr>)}
          </tbody></table></div>
          {!visibleDevices.length && <Empty title="Không có thiết bị phù hợp" detail="Thử đổi site hoặc từ khóa tìm kiếm." icon={Server} />}
        </Panel>}

        {page === "Sites" && <Panel title="Site Management" icon={Building2} action={<button className="primary-button" onClick={() => { setEditingSite(null); setSiteForm({ name: "", address: "" }); setModal("site"); }}><Plus size={15} /> Add Site</button>}>
          <div className="site-management-grid">{sites.map(site => { const ds = devices.filter(d => String(d.site_id) === String(site.id)); return <article className="site-management-card" key={site.id}><div className="site-management-icon"><Building2 /></div><h3>{site.name}</h3><p>{site.address || "Chưa có địa chỉ"}</p><div className="site-card-stats"><span><b>{ds.length}</b> Devices</span><span><b>{ds.filter(d => statusOf(d) === "online").length}</b> Online</span></div><div className="row-actions"><button className="secondary-button" onClick={() => { setEditingSite(site); setSiteForm({ name: site.name || "", address: site.address || "" }); setModal("site"); }}><Pencil size={14} /> Edit</button><button className="secondary-button danger-text" onClick={() => deleteSite(site)}><Trash2 size={14} /> Delete</button></div></article>; })}</div>
          {!sites.length && <Empty title="Chưa có site" detail="Tạo site đầu tiên để bắt đầu giám sát." icon={Building2} />}
        </Panel>}

        {page === "Monitoring" && <div className="monitoring-grid"><Panel title="Device Availability" icon={Activity}><div className="monitor-big-number">{devices.length ? Math.round(online / devices.length * 100) : 0}%</div><p className="muted-note">Tỷ lệ online dựa trên trạng thái backend hiện có.</p><div className="availability-track"><i style={{ width: `${devices.length ? online / devices.length * 100 : 0}%` }} /></div><div className="legend-list"><span>Online <b>{online}</b></span><span>Offline <b>{offline}</b></span><span>Unknown <b>{unknown}</b></span></div></Panel><Panel title="Latency" icon={Zap}><div className="latency-list">{devices.filter(d => d.latency_ms != null).slice(0, 10).map(d => <div className="latency-row" key={d.id}><span>{d.name}</span><b>{Number(d.latency_ms).toFixed(1)} ms</b></div>)}</div>{!devices.some(d => d.latency_ms != null) && <Empty title="Chưa có latency" detail="Worker cần trả về latency_ms để hiển thị." icon={Zap} />}</Panel></div>}

        {page === "Automation" && <Panel title="Automation" icon={Zap}><Empty title="Chưa cấu hình automation" detail="Phần này cần API backend cho tác vụ tự động và lịch chạy." icon={Zap} /></Panel>}

        {page === "Settings" && <div className="settings-grid"><Panel title="API Connection" icon={Globe}><div className="setting-line"><span>API Base URL</span><b>{API}</b></div><div className="setting-line"><span>Refresh interval</span><b>15 seconds</b></div><button className="secondary-button" onClick={() => loadData(true)}><RefreshCw size={15} /> Test / Refresh</button></Panel><Panel title="Account" icon={ShieldCheck}><div className="setting-line"><span>Email</span><b>{me?.email || "—"}</b></div><div className="setting-line"><span>Role</span><b>{me?.role || "Theo backend"}</b></div><button className="secondary-button" onClick={logout}><LogOut size={15} /> Sign out</button></Panel><Panel title="Data Summary" icon={HardDrive}><div className="setting-line"><span>Sites</span><b>{sites.length}</b></div><div className="setting-line"><span>Devices</span><b>{devices.length}</b></div><div className="setting-line"><span>Events</span><b>{events.length}</b></div></Panel></div>}
      </main>

      <footer className="app-footer"><span><i className="site-dot online" /> NetOps Realtime</span><span>{refreshing ? "Đang cập nhật…" : "Auto refresh 15s"}</span><span>API: {API}</span></footer>

      {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(""); }}><section className="modal-card">
        <header className="modal-header"><h2>{modal === "device" ? (editingDevice ? "Edit Device" : "Add Device") : (editingSite ? "Edit Site" : "Add Site")}</h2><button className="icon-button" onClick={() => setModal("")}><X size={18} /></button></header>
        {modal === "device" ? <form className="modal-form" onSubmit={saveDevice}>
          <label>Site<select required value={deviceForm.site_id} onChange={e => setDeviceForm({ ...deviceForm, site_id: e.target.value })}><option value="">Chọn site</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Tên thiết bị<input required value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} /></label>
          <div className="form-grid"><label>Địa chỉ IP / Host<input required value={deviceForm.address} onChange={e => setDeviceForm({ ...deviceForm, address: e.target.value })} /></label><label>Loại thiết bị<select value={deviceForm.device_type} onChange={e => setDeviceForm({ ...deviceForm, device_type: e.target.value })}>{["Router", "Switch", "Wi-Fi", "Firewall", "Server", "Camera", "Other"].map(x => <option key={x}>{x}</option>)}</select></label></div>
          <div className="form-grid"><label>Hãng<input value={deviceForm.vendor || ""} onChange={e => setDeviceForm({ ...deviceForm, vendor: e.target.value })} /></label><label>Model<input value={deviceForm.model || ""} onChange={e => setDeviceForm({ ...deviceForm, model: e.target.value })} /></label></div>
          <label className="check-label"><input type="checkbox" checked={!!deviceForm.ping_enabled} onChange={e => setDeviceForm({ ...deviceForm, ping_enabled: e.target.checked })} /> Enable Ping monitoring</label>
          <label className="check-label"><input type="checkbox" checked={!!deviceForm.snmp_enabled} onChange={e => setDeviceForm({ ...deviceForm, snmp_enabled: e.target.checked })} /> Enable SNMP</label>
          {deviceForm.snmp_enabled && <div className="form-grid"><label>SNMP version<select value={deviceForm.snmp_version || "2c"} onChange={e => setDeviceForm({ ...deviceForm, snmp_version: e.target.value })}><option value="2c">v2c</option><option value="3">v3</option></select></label><label>SNMP port<input type="number" value={deviceForm.snmp_port || 161} onChange={e => setDeviceForm({ ...deviceForm, snmp_port: e.target.value })} /></label><label>Community<input value={deviceForm.snmp_community || "public"} onChange={e => setDeviceForm({ ...deviceForm, snmp_community: e.target.value })} /></label></div>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal("")}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save Device"}</button></div>
        </form> : <form className="modal-form" onSubmit={saveSite}><label>Tên site<input required value={siteForm.name} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} /></label><label>Địa chỉ / vị trí<input value={siteForm.address} onChange={e => setSiteForm({ ...siteForm, address: e.target.value })} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal("")}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save Site"}</button></div></form>}
      </section></div>}
    </div>
  );
}
