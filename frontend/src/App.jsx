
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bell, Building2, Cable, Check,
  CheckCircle2, ChevronRight, CircleHelp, Clock3, Cpu,
  Database, Download, Eye, Filter, Globe, HardDrive,
  LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, Menu,
  Monitor, Network, Plus, RefreshCw, Router, Search, Server,
  Settings, ShieldCheck, Trash2, Wifi, X, XCircle, Pencil,
  ArrowDownUp, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const NAV = [
  { label: "Tổng quan", icon: LayoutDashboard },
  { label: "Site", icon: Building2 },
  { label: "Router", icon: Router },
  { label: "Switch", icon: Network },
  { label: "Wi-Fi", icon: Wifi },
  { label: "Thiết bị", icon: Monitor },
  { label: "Cảnh báo", icon: Bell },
  { label: "Sơ đồ mạng", icon: Cable },
  { label: "Cài đặt", icon: Settings },
];

const TYPE_BY_PAGE = {
  Router: ["router"],
  Switch: ["switch"],
  "Wi-Fi": ["wi-fi", "wifi", "access point", "ap"],
};

const EMPTY_DEVICE = {
  site_id: "",
  name: "",
  vendor: "",
  model: "",
  device_type: "Router",
  address: "",
  ping_enabled: true,
  snmp_enabled: false,
  snmp_port: 161,
  snmp_version: "2c",
  snmp_community: "public",
};

function getToken() {
  return localStorage.getItem("netops_token") || "";
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (response.status === 204) return null;

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Phiên đăng nhập hết hạn hoặc chưa đăng nhập.");
    }
    const detail = data?.detail;
    throw new Error(
      typeof detail === "string" ? detail :
      detail ? JSON.stringify(detail) :
      `API trả về lỗi HTTP ${response.status}`
    );
  }
  return data;
}

function arrayOf(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.devices)) return value.devices;
  if (Array.isArray(value?.sites)) return value.sites;
  if (Array.isArray(value?.events)) return value.events;
  return [];
}

function statusOf(device) {
  const value = String(device.status || "unknown").toLowerCase();
  if (["online", "up", "healthy"].includes(value)) return "online";
  if (["offline", "down", "unreachable"].includes(value)) return "offline";
  return "unknown";
}

function typeOf(device) {
  return String(device.device_type || device.type || "Other");
}

function formatDate(value) {
  if (!value) return "Chưa có dữ liệu";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("vi-VN");
}

function IconForType({ type, size = 18 }) {
  const value = String(type || "").toLowerCase();
  if (value.includes("router") || value.includes("gateway")) return <Router size={size} />;
  if (value.includes("switch")) return <Network size={size} />;
  if (value.includes("wi-fi") || value.includes("wifi") || value.includes("access point")) return <Wifi size={size} />;
  if (value.includes("server")) return <Server size={size} />;
  return <Monitor size={size} />;
}

function StatusBadge({ status }) {
  const normalized = statusOf({ status });
  const config = {
    online: { label: "Online", icon: CheckCircle2 },
    offline: { label: "Offline", icon: XCircle },
    unknown: { label: "Chưa rõ", icon: CircleHelp },
  }[normalized];
  const Icon = config.icon;
  return (
    <span className={`status-badge ${normalized}`}>
      <Icon size={14} /> {config.label}
    </span>
  );
}

function Metric({ title, value, description, icon: Icon, tone }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={21} /></div>
      <div className="metric-copy">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}

function Empty({ icon: Icon = Database, title, detail }) {
  return (
    <div className="empty-panel">
      <Icon size={30} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <section className="modal-card">
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("Tổng quan");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [token, setToken] = useState(getToken);
  const [authMode, setAuthMode] = useState("login");
  const [auth, setAuth] = useState({
    organization: "", email: "", password: "",
  });
  const [me, setMe] = useState(null);

  const [devices, setDevices] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [sites, setSites] = useState([]);
  const [events, setEvents] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [modal, setModal] = useState("");
  const [editingDevice, setEditingDevice] = useState(null);
  const [editingSite, setEditingSite] = useState(null);
  const [deviceForm, setDeviceForm] = useState(EMPTY_DEVICE);
  const [siteForm, setSiteForm] = useState({ name: "", address: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (quiet = false) => {
    if (!getToken()) return;
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError("");

    const results = await Promise.allSettled([
      api("/api/me"),
      api("/api/devices"),
      api("/api/sites"),
      api("/api/events"),
      api("/api/dashboard"),
    ]);

    const [meResult, deviceResult, siteResult, eventResult, dashResult] = results;

    if (meResult.status === "rejected") {
      setError(meResult.reason?.message || "Không thể kết nối API.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setMe(meResult.value);

    if (deviceResult.status === "fulfilled") setDevices(arrayOf(deviceResult.value));
    else setError(deviceResult.reason?.message || "Không tải được thiết bị.");

    if (siteResult.status === "fulfilled") setSites(arrayOf(siteResult.value));
    if (eventResult.status === "fulfilled") setEvents(arrayOf(eventResult.value));
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
  const siteCount = sites.length;
const selectedSite =
  sites.find(s => String(s.id) === String(selectedSiteId)) ||
  sites[0] ||
  null;

const selectedSiteDevices = selectedSite
  ? devices.filter(
      d => String(d.site_id) === String(selectedSite.id)
    )
  : [];

const selectedSiteOnline = selectedSiteDevices.filter(
  d => statusOf(d) === "online"
).length;

const selectedSiteOffline = selectedSiteDevices.filter(
  d => statusOf(d) === "offline"
).length;

const countSiteType = (...types) =>
  selectedSiteDevices.filter(d => {
    const type = typeOf(d).toLowerCase();
    return types.some(t => type.includes(t));
  }).length;

const siteDeviceGroups = [
  {
    title: "Router / Firewall",
    types: ["router", "gateway", "firewall"],
  },
  {
    title: "Switch",
    types: ["switch"],
  },
  {
    title: "Wi-Fi / Access Point",
    types: ["wi-fi", "wifi", "access point", "ap"],
  },
  {
    title: "Server / NVR",
    types: ["server", "nvr"],
  },
  {
    title: "Camera",
    types: ["camera"],
  },
  {
    title: "Thiết bị khác",
    types: [],
  },
];
  const filteredDevices = useMemo(() => devices.filter(d => {
    const text = `${d.name || ""} ${d.address || ""} ${d.vendor || ""} ${d.model || ""} ${d.device_type || ""}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || statusOf(d) === statusFilter;
    const matchesSite = siteFilter === "all" || String(d.site_id) === String(siteFilter);
    const deviceType = typeOf(d).toLowerCase();
    const matchesPage =
      !TYPE_BY_PAGE[page] ||
      TYPE_BY_PAGE[page].some(type => deviceType.includes(type));
    const isAlertPage = page !== "Cảnh báo" || statusOf(d) === "offline";
    return matchesQuery && matchesStatus && matchesSite && matchesPage && isAlertPage;
  }), [devices, query, statusFilter, siteFilter, page]);

  const pageDevices = ["Router", "Switch", "Wi-Fi", "Thiết bị", "Cảnh báo"].includes(page);

  async function submitAuth(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const isRegister = authMode === "register";
      const result = await api(
        isRegister ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify(auth),
        }
      );
      const newToken = result?.access_token || result?.token;
      if (newToken) {
        localStorage.setItem("netops_token", newToken);
        setToken(newToken);
        setNotice(isRegister ? "Tạo tài khoản thành công." : "Đăng nhập thành công.");
      } else if (isRegister) {
        setAuthMode("login");
        setNotice("Đăng ký thành công. Hãy đăng nhập.");
      } else {
        setError("API đăng nhập chưa trả về access_token. Kiểm tra định dạng phản hồi backend.");
      }
    } catch (err) {
      setError(err.message || "Không thể đăng nhập.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem("netops_token");
    setToken("");
    setMe(null);
    setDevices([]);
    setSites([]);
    setEvents([]);
    setDashboard(null);
    setPage("Tổng quan");
  }

  function openNewDevice() {
    setEditingDevice(null);
    setDeviceForm({ ...EMPTY_DEVICE, site_id: sites[0]?.id ?? "" });
    setModal("device");
  }

  function openEditDevice(device) {
    setEditingDevice(device);
    setDeviceForm({
      ...EMPTY_DEVICE,
      ...device,
      site_id: device.site_id ?? "",
      address: device.address ?? "",
      snmp_community: "public",
    });
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
      if (!body.site_id) throw new Error("Hãy chọn site cho thiết bị.");
      if (editingDevice) {
        await api(`/api/devices/${editingDevice.id}`, {
          method: "PUT", body: JSON.stringify(body),
        });
      } else {
        await api("/api/devices", {
          method: "POST", body: JSON.stringify(body),
        });
      }
      setModal("");
      setNotice(editingDevice ? "Đã cập nhật thiết bị." : "Đã thêm thiết bị.");
      await loadData(true);
    } catch (err) {
      setError(err.message || "Lưu thiết bị thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDevice(device) {
    if (!window.confirm(`Xóa thiết bị "${device.name}" (${device.address})?`)) return;
    try {
      await api(`/api/devices/${device.id}`, { method: "DELETE" });
      setNotice("Đã xóa thiết bị.");
      await loadData(true);
    } catch (err) {
      setError(err.message || "Xóa thiết bị thất bại.");
    }
  }

  async function saveSite(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingSite) {
        await api(`/api/sites/${editingSite.id}`, {
          method: "PUT", body: JSON.stringify(siteForm),
        });
      } else {
        await api("/api/sites", {
          method: "POST", body: JSON.stringify(siteForm),
        });
      }
      setModal("");
      setNotice(editingSite ? "Đã cập nhật site." : "Đã tạo site.");
      await loadData(true);
    } catch (err) {
      setError(err.message || "Lưu site thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSite(site) {
    if (!window.confirm(`Xóa site "${site.name}"? Các thiết bị thuộc site có thể bị xóa theo backend.`)) return;
    try {
      await api(`/api/sites/${site.id}`, { method: "DELETE" });
      setNotice("Đã xóa site.");
      await loadData(true);
    } catch (err) {
      setError(err.message || "Xóa site thất bại.");
    }
  }

  function exportCsv() {
    const rows = [
      ["Tên thiết bị", "IP", "Loại", "Hãng", "Model", "Site", "Trạng thái"],
      ...filteredDevices.map(d => [
        d.name, d.address, typeOf(d), d.vendor, d.model,
        sites.find(s => s.id === d.site_id)?.name || d.site_id,
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

  if (!token) {
    return (
      <div className="auth-screen">
        <div className="auth-decoration">
          <div className="auth-brand"><Activity size={26} /> ChiThien <span>NETWORK MONITOR</span></div>
          <div className="auth-hero">
            <span className="eyebrow">INFRASTRUCTURE OBSERVABILITY</span>
            <h1>Toàn bộ hạ tầng mạng.<br /><span>Một nơi quản lý.</span></h1>
            <p>Giám sát tập trung thiết bị, chi nhánh và cảnh báo mạng trên cùng một nền tảng.</p>
            <div className="auth-points">
              <span><ShieldCheck size={17} /> Phân tách dữ liệu theo tổ chức</span>
              <span><Activity size={17} /> Giám sát trạng thái qua API</span>
              <span><Network size={17} /> Quản lý thiết bị đa site</span>
            </div>
          </div>
          <small className="auth-footnote">NETOPS · NETWORK OPERATIONS CENTER</small>
        </div>
        <form className="auth-card" onSubmit={submitAuth}>
          <div className="auth-card-icon"><LockKeyhole size={22} /></div>
          <h2>{authMode === "login" ? "Đăng nhập hệ thống" : "Tạo tổ chức mới"}</h2>
          <p>{authMode === "login" ? "Đăng nhập để quản lý hạ tầng mạng của mày." : "Tạo tài khoản quản trị NetOps."}</p>
          {authMode === "register" && (
            <label>Tên tổ chức
              <input required value={auth.organization} onChange={e => setAuth({ ...auth, organization: e.target.value })} placeholder="Tên công ty" />
            </label>
          )}
          <label>Email
            <input type="email" required value={auth.email} onChange={e => setAuth({ ...auth, email: e.target.value })} placeholder="admin@company.com" />
          </label>
          <label>Mật khẩu
            <input type="password" required minLength={authMode === "register" ? 12 : 1} value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} placeholder={authMode === "register" ? "Tối thiểu 12 ký tự" : "Nhập mật khẩu"} />
          </label>
          {error && <div className="inline-error"><AlertTriangle size={16} />{error}</div>}
          <button className="primary-button auth-submit" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={17} />}
            {saving ? "Đang xử lý..." : authMode === "login" ? "Đăng nhập" : "Đăng ký"}
          </button>
          <button type="button" className="text-button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }}>
            {authMode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
          </button>
          <small className="api-address">API: {API}</small>
        </form>
      </div>
    );
  }

  return (
    <div className="netops-app">
      <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={22} /></div>
          {sidebarOpen && <div className="brand-text"><b>NetOps</b><small>NETWORK MONITOR</small></div>}
        </div>

        {sidebarOpen && <div className="nav-section-title">WORKSPACE</div>}
        <nav className="nav-list">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.label} title={item.label}
                className={`nav-item ${page === item.label ? "active" : ""}`}
                onClick={() => { setPage(item.label); setError(""); }}>
                <Icon size={19} />
                {sidebarOpen && <span>{item.label}</span>}
                {item.label === "Cảnh báo" && offline > 0 && sidebarOpen && <b className="nav-count">{offline}</b>}
                {page === item.label && <span className="nav-active-bar" />}
              </button>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="sidebar-bottom">
            <div className="side-status"><span className="pulse-dot" /> API đã đăng nhập</div>
            <div className="profile-row">
              <div className="profile-avatar">{(me?.email || "AD").slice(0, 2).toUpperCase()}</div>
              <div className="profile-copy"><b>{me?.email || "NetOps Admin"}</b><small>Quản trị hệ thống</small></div>
              <button className="icon-btn" onClick={logout} title="Đăng xuất"><LogOut size={16} /></button>
            </div>
          </div>
        )}
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(v => !v)}><Menu size={20} /></button>
            <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><b>{page}</b></div>
          </div>
          <div className="topbar-actions">
            <span className="monitor-pill"><span className="pulse-dot" /> Live monitoring</span>
            <button className="icon-btn" onClick={() => loadData(true)} title="Làm mới"><RefreshCw size={17} className={refreshing ? "spin" : ""} /></button>
            <div className="topbar-avatar">{(me?.email || "AD").slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        <div className="content-area">
          {(error || notice) && (
            <div className={`notice-banner ${error ? "error" : "success"}`}>
              {error ? <AlertTriangle size={17} /> : <Check size={17} />}
              <span>{error || notice}</span>
              <button className="icon-btn" onClick={() => { setError(""); setNotice(""); }}><X size={16} /></button>
            </div>
          )}

          <div className="page-heading">
            <div>
              <div className="eyebrow">{page === "Tổng quan" ? "NETWORK OPERATIONS CENTER" : "MANAGEMENT CONSOLE"}</div>
              <h1>{page}</h1>
              <p>
                {page === "Tổng quan"
                  ? "Theo dõi sức khỏe hạ tầng và trạng thái các site theo thời gian thực."
                  : `Quản lý ${page.toLowerCase()} trong hệ thống NetOps.`}
              </p>
            </div>
            <div className="heading-actions">
              {page === "Thiết bị" && <button className="secondary-button" onClick={exportCsv}><Download size={16} /> Xuất CSV</button>}
              {page === "Thiết bị" && <button className="primary-button" onClick={openNewDevice}><Plus size={17} /> Thêm thiết bị</button>}
              {page === "Site" && <button className="primary-button" onClick={() => { setEditingSite(null); setSiteForm({ name: "", address: "" }); setModal("site"); }}><Plus size={17} /> Thêm site</button>}
              {page === "Tổng quan" && <button className="secondary-button" onClick={() => loadData(true)}><RefreshCw size={16} /> Làm mới</button>}
            </div>
          </div>

          <div className="metrics-grid">
            <Metric title="Tổng thiết bị" value={loading ? "…" : devices.length} description="Thiết bị đã khai báo" icon={Server} tone="blue" />
            <Metric title="Đang hoạt động" value={loading ? "…" : online} description="Trạng thái Online" icon={CheckCircle2} tone="green" />
            <Metric title="Mất kết nối" value={loading ? "…" : offline} description="Cần kiểm tra" icon={AlertTriangle} tone="red" />
            <Metric title="Site quản lý" value={loading ? "…" : siteCount} description="Địa điểm đã khai báo" icon={Building2} tone="purple" />
          </div>

          {page === "Tổng quan" && (
            <>
              <div className="section-title-row"><div><h2>Tổng quan hạ tầng</h2><p>Số liệu được tải từ API của hệ thống.</p></div><span className="updated-label"><Clock3 size={14} /> Tự làm mới mỗi 15 giây</span></div>
              <div className="dashboard-grid">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div><h3><Activity size={18} /> Sức khỏe thiết bị</h3><p>Phân bố trạng thái theo dữ liệu hiện tại</p></div>
                    <span className="small-tag">REAL DATA</span>
                  </div>
                  <div className="health-bars">
                    <div className="health-summary"><strong>{devices.length ? Math.round(online / devices.length * 100) : 0}%</strong><span>thiết bị Online</span></div>
                    <div className="stacked-bar">
                      <span className="bar-online" style={{ width: `${devices.length ? online / devices.length * 100 : 0}%` }} />
                      <span className="bar-offline" style={{ width: `${devices.length ? offline / devices.length * 100 : 0}%` }} />
                      <span className="bar-unknown" style={{ width: `${devices.length ? unknown / devices.length * 100 : 0}%` }} />
                    </div>
                    <div className="legend-row">
                      <span><i className="legend-dot green" />Online <b>{online}</b></span>
                      <span><i className="legend-dot red" />Offline <b>{offline}</b></span>
                      <span><i className="legend-dot gray" />Chưa rõ <b>{unknown}</b></span>
                    </div>
                  </div>
                  <div className="panel-divider" />
                  <div className="panel-heading"><div><h3><Zap size={18} /> Độ trễ gần nhất</h3><p>Giá trị latency do worker trả về</p></div></div>
                  <div className="latency-list">
                    {devices.filter(d => d.latency_ms != null && statusOf(d) === "online").slice(0, 5).map(d => (
                      <div className="latency-row" key={d.id}>
                        <span className="latency-name"><IconForType type={typeOf(d)} size={16} />{d.name}</span>
                        <div className="latency-track"><span style={{ width: `${Math.min(100, Number(d.latency_ms) / 2)}%` }} /></div>
                        <b>{Number(d.latency_ms).toFixed(1)} ms</b>
                      </div>
                    ))}
                    {!devices.some(d => d.latency_ms != null && statusOf(d) === "online") &&
                      <p className="muted-note">Chưa có dữ liệu latency. Worker cần kiểm tra thiết bị trước.</p>}
                  </div>
                </section>

                <section className="panel alerts-panel">
                  <div className="panel-heading">
                    <div><h3><Bell size={18} /> Cảnh báo gần đây</h3><p>Sự kiện nhận từ backend</p></div>
                    <button className="text-button compact" onClick={() => setPage("Cảnh báo")}>Xem tất cả <ChevronRight size={15} /></button>
                  </div>
                  <div className="event-list">
                    {events.slice(0, 6).map((event, index) => (
                      <div className="event-row" key={event.id ?? index}>
                        <div className={`event-symbol ${String(event.level).toLowerCase()}`}>
                          {String(event.level).toLowerCase() === "info" ? <Activity size={16} /> : <AlertTriangle size={16} />}
                        </div>
                        <div className="event-copy">
                          <b>{event.device_name || `Thiết bị #${event.device_id || "—"}`}</b>
                          <span>{event.message || "Sự kiện giám sát"}</span>
                          <small>{formatDate(event.created_at)}</small>
                        </div>
                      </div>
                    ))}
                    {!events.length && <Empty icon={CheckCircle2} title="Chưa có sự kiện" detail="Các sự kiện sẽ xuất hiện khi backend ghi nhận." />}
                  </div>
                </section>
              </div>

              <section className="panel table-panel">
                <div className="panel-heading">
                  <div><h3><Activity size={18} /> Thiết bị cần chú ý</h3><p>Thiết bị Offline hoặc chưa có trạng thái xác định</p></div>
                  <button className="secondary-button" onClick={() => setPage("Thiết bị")}>Quản lý thiết bị <ChevronRight size={15} /></button>
                </div>
                <DeviceTable devices={devices.filter(d => statusOf(d) !== "online").slice(0, 6)} sites={sites} onEdit={openEditDevice} onDelete={deleteDevice} />
              </section>
            </>
          )}

          
{page === "Site" && (
  <section className="site-workspace">
    {/* CỘT TRÁI: DANH SÁCH SITE */}
    <section className="panel site-picker">
      <div className="panel-heading">
        <div>
          <h3><Building2 size={18} /> Danh sách Site</h3>
          <p>Chọn địa điểm cần xem</p>
        </div>
        <span className="small-tag">{sites.length} SITE</span>
      </div>

      <div className="site-picker-list">
        {sites.map(site => {
          const siteDevices = devices.filter(
            d => String(d.site_id) === String(site.id)
          );
          const active = selectedSite &&
            String(selectedSite.id) === String(site.id);

          return (
            <button
              type="button"
              key={site.id}
              className={`site-picker-item ${active ? "selected" : ""}`}
              onClick={() => setSelectedSiteId(site.id)}
            >
              <div className="site-picker-icon">
                <Building2 size={19} />
              </div>

              <div className="site-picker-copy">
                <b>{site.name}</b>
                <span>{site.address || "Chưa có địa chỉ"}</span>
                <small>{siteDevices.length} thiết bị</small>
              </div>

              <ChevronRight size={18} />
            </button>
          );
        })}

        {!sites.length && (
          <Empty
            icon={Building2}
            title="Chưa có Site"
            detail="Tạo Site để bắt đầu quản lý."
          />
        )}
      </div>
    </section>

    {/* CỘT PHẢI: THỐNG KÊ VÀ SƠ ĐỒ */}
    <div className="site-detail-column">
      {!selectedSite ? (
        <section className="panel">
          <Empty
            icon={Network}
            title="Chưa chọn Site"
            detail="Thêm Site hoặc chọn một Site bên trái."
          />
        </section>
      ) : (
        <>
          <section className="panel site-detail-header">
            <div>
              <div className="eyebrow">
                SITE-{String(selectedSite.id).padStart(3, "0")}
              </div>
              <h2>{selectedSite.name}</h2>
              <p>{selectedSite.address || "Chưa cập nhật địa chỉ"}</p>
            </div>

            <div className="heading-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setEditingSite(selectedSite);
                  setSiteForm({
                    name: selectedSite.name || "",
                    address: selectedSite.address || "",
                  });
                  setModal("site");
                }}
              >
                <Pencil size={15} /> Sửa Site
              </button>

              <button
                className="secondary-button"
                onClick={() => {
                  setSiteFilter(String(selectedSite.id));
                  setPage("Thiết bị");
                }}
              >
                <Eye size={15} /> Danh sách thiết bị
              </button>
            </div>
          </section>

          <div className="site-detail-metrics">
            <Metric
              title="Tổng thiết bị"
              value={selectedSiteDevices.length}
              description="Thiết bị đã khai báo"
              icon={Server}
              tone="blue"
            />
            <Metric
              title="Online"
              value={selectedSiteOnline}
              description="Đang phản hồi"
              icon={CheckCircle2}
              tone="green"
            />
            <Metric
              title="Offline"
              value={selectedSiteOffline}
              description="Cần kiểm tra"
              icon={AlertTriangle}
              tone="red"
            />
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3><Network size={18} /> Thống kê theo loại</h3>
                <p>Chỉ tính thiết bị thuộc Site đang chọn</p>
              </div>
            </div>

            <div className="site-type-grid">
              {[
                { label: "Router", types: ["router", "gateway"], icon: Router },
                { label: "Firewall", types: ["firewall"], icon: ShieldCheck },
                { label: "Switch", types: ["switch"], icon: Network },
                { label: "Wi-Fi / AP", types: ["wi-fi", "wifi", "access point", "ap"], icon: Wifi },
                { label: "Server / NVR", types: ["server", "nvr"], icon: Server },
                { label: "Camera", types: ["camera"], icon: Eye },
              ].map(item => {
                const TypeIcon = item.icon;
                const count = selectedSiteDevices.filter(d => {
                  const type = typeOf(d).toLowerCase();
                  return item.types.some(t => type.includes(t));
                }).length;

                return (
                  <div className="site-type-card" key={item.label}>
                    <TypeIcon size={20} />
                    <span>{item.label}</span>
                    <b>{count}</b>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel site-network-panel">
            <div className="panel-heading">
              <div>
                <h3><Cable size={19} /> Sơ đồ mạng — {selectedSite.name}</h3>
                <p>
                  Thiết bị và trạng thái lấy từ API của Site đang chọn.
                </p>
              </div>
              <span className="small-tag">
                {selectedSiteDevices.length} THIẾT BỊ
              </span>
            </div>

            <div className="topology-notice">
              <CircleHelp size={17} />
              <span>
                Sơ đồ nhóm thiết bị để theo dõi. Đường nối chưa xác nhận
                là kết nối vật lý thực tế; cần dữ liệu topology hoặc
                LLDP/CDP để xác định kết nối chính xác.
              </span>
            </div>

            {selectedSiteDevices.length ? (
              <div className="site-network-groups">
                {siteDeviceGroups.map(group => {
                  const groupDevices = selectedSiteDevices.filter(d => {
                    const type = typeOf(d).toLowerCase();

                    if (!group.types.length) {
                      return !siteDeviceGroups
                        .filter(g => g.types.length)
                        .some(g => g.types.some(t => type.includes(t)));
                    }

                    return group.types.some(t => type.includes(t));
                  });

                  if (!groupDevices.length) return null;

                  return (
                    <div className="site-network-group" key={group.title}>
                      <div className="site-network-group-title">
                        <Network size={17} />
                        <b>{group.title}</b>
                        <span>{groupDevices.length}</span>
                      </div>

                      <div className="site-network-nodes">
                        {groupDevices.map(device => (
                          <article
                            className="site-network-node"
                            key={device.id}
                          >
                            <div
                              className={`site-network-node-icon ${statusOf(device)}`}
                            >
                              <IconForType type={typeOf(device)} size={22} />
                            </div>

                            <div className="site-network-node-info">
                              <b>{device.name}</b>
                              <span>{device.address || "Chưa có IP"}</span>
                              <small>
                                {[device.vendor, device.model]
                                  .filter(Boolean)
                                  .join(" · ") || typeOf(device)}
                              </small>
                            </div>

                            <StatusBadge status={device.status} />
                          </article>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                icon={Network}
                title="Site chưa có thiết bị"
                detail="Thêm thiết bị và gán vào Site này để hiển thị."
              />
            )}
          </section>
        </>
      )}
    </div>
  </section>
)}


          {pageDevices && (
            <section className="panel table-panel">
              <div className="panel-heading">
                <div><h3><IconForType type={page === "Thiết bị" ? "device" : page} /> {page === "Cảnh báo" ? "Thiết bị đang cảnh báo" : `Danh sách ${page.toLowerCase()}`}</h3><p>Dữ liệu thiết bị hiện có trong backend</p></div>
                <div className="heading-actions">
                  <button className="secondary-button" onClick={exportCsv}><Download size={15} /> CSV</button>
                  {page !== "Cảnh báo" && <button className="primary-button" onClick={openNewDevice}><Plus size={16} /> Thêm thiết bị</button>}
                </div>
              </div>
              <div className="filter-toolbar">
                <div className="search-input"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên, IP, hãng, model..." /><kbd> / </kbd></div>
                <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}><option value="all">Tất cả site</option>{sites.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Mọi trạng thái</option><option value="online">Online</option><option value="offline">Offline</option><option value="unknown">Chưa rõ</option></select>
                <button className="icon-btn" title="Xóa bộ lọc" onClick={() => { setQuery(""); setSiteFilter("all"); setStatusFilter("all"); }}><Filter size={17} /></button>
              </div>
              {loading ? <Empty icon={LoaderCircle} title="Đang tải thiết bị" detail="Đang lấy dữ liệu từ API." /> :
                <DeviceTable devices={filteredDevices} sites={sites} onEdit={openEditDevice} onDelete={deleteDevice} />}
              <div className="table-footer">Hiển thị <b>{filteredDevices.length}</b> / {devices.length} thiết bị <span>·</span> Cập nhật tự động mỗi 15 giây</div>
            </section>
          )}

          {page === "Sơ đồ mạng" && (
            <section className="panel topology-panel">
              <div className="panel-heading">
                <div><h3><Cable size={19} /> Sơ đồ kết nối mạng</h3><p>Thiết bị lấy từ API; liên kết vật lý chưa được khai báo hoặc tự phát hiện sẽ không được tự suy đoán.</p></div>
                <span className="small-tag">DEVICE INVENTORY</span>
              </div>
              <div className="topology-notice"><CircleHelp size={17} /><span>Đây là danh sách thiết bị theo site, chưa phải sơ đồ liên kết vật lý. Cần bổ sung API lưu topology và phát hiện LLDP/CDP để vẽ đường nối thật.</span></div>
              {sites.map(site => {
                const siteDevices = devices.filter(d => String(d.site_id) === String(site.id));
                if (!siteDevices.length) return null;
                return <div className="topology-site" key={site.id}>
                  <div className="topology-site-heading"><Building2 size={18} /><b>{site.name}</b><span>{siteDevices.length} thiết bị</span></div>
                  <div className="topology-device-grid">
                    {siteDevices.map(d => (
                      <div className="topology-device" key={d.id}>
                        <div className={`topology-device-icon ${statusOf(d)}`}><IconForType type={typeOf(d)} size={22} /></div>
                        <div><b>{d.name}</b><span>{d.address}</span><small>{d.vendor || "Chưa rõ hãng"} {d.model || ""}</small></div>
                        <StatusBadge status={d.status} />
                      </div>
                    ))}
                  </div>
                </div>;
              })}
              {!devices.length && <Empty icon={Cable} title="Chưa có thiết bị để hiển thị" detail="Thêm thiết bị trước khi xây dựng sơ đồ mạng." />}
            </section>
          )}

          {page === "Cài đặt" && (
            <div className="settings-grid">
              <section className="panel settings-card">
                <div className="settings-icon"><Globe size={20} /></div>
                <h3>Kết nối API</h3><p>Địa chỉ backend mà giao diện đang sử dụng.</p>
                <label>API Base URL<input value={API} readOnly /></label>
                <div className="settings-info"><span className="pulse-dot" /> Dữ liệu tự làm mới mỗi 15 giây khi đã đăng nhập.</div>
                <button className="secondary-button" onClick={() => loadData(true)}><RefreshCw size={15} /> Kiểm tra kết nối</button>
              </section>
              <section className="panel settings-card">
                <div className="settings-icon"><ShieldCheck size={20} /></div>
                <h3>Tài khoản</h3><p>Thông tin phiên hiện tại.</p>
                <div className="account-detail"><span>Email</span><b>{me?.email || "Chưa có thông tin"}</b></div>
                <div className="account-detail"><span>Vai trò</span><b>{me?.role || "Theo backend"}</b></div>
                <button className="secondary-button" onClick={logout}><LogOut size={15} /> Đăng xuất</button>
              </section>
              <section className="panel settings-card">
                <div className="settings-icon"><Database size={20} /></div>
                <h3>Dữ liệu giám sát</h3><p>Thống kê dữ liệu đang có, không phải dữ liệu giả lập.</p>
                <div className="account-detail"><span>Tổng thiết bị</span><b>{devices.length}</b></div>
                <div className="account-detail"><span>Sự kiện</span><b>{events.length}</b></div>
                <div className="account-detail"><span>Site</span><b>{sites.length}</b></div>
              </section>
            </div>
          )}

          <footer className="app-footer"><span><Activity size={15} /> NETOPS NETWORK MONITOR</span><span>Giám sát hạ tầng · Dữ liệu từ backend</span></footer>
        </div>
      </main>

      {modal === "device" && (
        <Modal title={editingDevice ? "Cập nhật thiết bị" : "Thêm thiết bị mới"} onClose={() => setModal("")}>
          <form className="form-body" onSubmit={saveDevice}>
            <div className="form-grid">
              <label>Tên thiết bị *<input required value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} placeholder="Ví dụ: Router Core" /></label>
              <label>Địa chỉ IP / hostname *<input required value={deviceForm.address} onChange={e => setDeviceForm({ ...deviceForm, address: e.target.value })} placeholder="192.168.1.1" /></label>
              <label>Site *<select required value={deviceForm.site_id} onChange={e => setDeviceForm({ ...deviceForm, site_id: e.target.value })}><option value="">Chọn site</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label>Loại thiết bị *<select value={deviceForm.device_type} onChange={e => setDeviceForm({ ...deviceForm, device_type: e.target.value })}>{["Router", "Switch", "Wi-Fi", "Server", "Camera", "Firewall", "Other"].map(t => <option key={t}>{t}</option>)}</select></label>
              <label>Hãng<input value={deviceForm.vendor} onChange={e => setDeviceForm({ ...deviceForm, vendor: e.target.value })} placeholder="MikroTik, Cisco, DrayTek..." /></label>
              <label>Model<input value={deviceForm.model} onChange={e => setDeviceForm({ ...deviceForm, model: e.target.value })} placeholder="Model thiết bị" /></label>
            </div>
            <div className="form-section-title">Phương thức giám sát</div>
            <label className="check-field"><input type="checkbox" checked={deviceForm.ping_enabled} onChange={e => setDeviceForm({ ...deviceForm, ping_enabled: e.target.checked })} /><span><b>Ping monitoring</b><small>Kiểm tra thiết bị có phản hồi mạng hay không.</small></span></label>
            <label className="check-field"><input type="checkbox" checked={deviceForm.snmp_enabled} onChange={e => setDeviceForm({ ...deviceForm, snmp_enabled: e.target.checked })} /><span><b>SNMP monitoring</b><small>Đọc thông tin thiết bị nếu SNMP được bật và cho phép truy cập.</small></span></label>
            {deviceForm.snmp_enabled && <>
              <div className="form-grid">
                <label>SNMP version<select value={deviceForm.snmp_version} onChange={e => setDeviceForm({ ...deviceForm, snmp_version: e.target.value })}><option value="2c">SNMP v2c</option></select></label>
                <label>UDP port<input type="number" min="1" max="65535" value={deviceForm.snmp_port} onChange={e => setDeviceForm({ ...deviceForm, snmp_port: e.target.value })} /></label>
                <label>Community<input value={deviceForm.snmp_community} onChange={e => setDeviceForm({ ...deviceForm, snmp_community: e.target.value })} /></label>
              </div>
              <p className="form-warning"><LockKeyhole size={15} /> Community cần được bảo vệ ở backend. Không dùng chuỗi mặc định trên thiết bị production.</p>
            </>}
            {error && <div className="inline-error"><AlertTriangle size={16} />{error}</div>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal("")}>Hủy</button><button className="primary-button" disabled={saving || !sites.length}>{saving ? "Đang lưu..." : <><Check size={16} /> Lưu thiết bị</>}</button></div>
          </form>
        </Modal>
      )}

      {modal === "site" && (
        <Modal title={editingSite ? "Cập nhật site" : "Thêm site mới"} onClose={() => setModal("")}>
          <form className="form-body" onSubmit={saveSite}>
            <label>Tên site *<input required value={siteForm.name} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} placeholder="Ví dụ: Văn phòng chính" /></label>
            <label>Địa chỉ / vị trí<input value={siteForm.address} onChange={e => setSiteForm({ ...siteForm, address: e.target.value })} placeholder="Địa chỉ chi nhánh" /></label>
            {error && <div className="inline-error"><AlertTriangle size={16} />{error}</div>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal("")}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : <><Check size={16} /> Lưu site</>}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function DeviceTable({ devices, sites, onEdit, onDelete }) {
  if (!devices.length) return <Empty icon={Monitor} title="Không có thiết bị phù hợp" detail="Thử đổi bộ lọc hoặc thêm thiết bị mới." />;

  return (
    <div className="table-scroll">
      <table className="device-table">
        <thead><tr><th>THIẾT BỊ</th><th>SITE</th><th>ĐỊA CHỈ IP</th><th>LOẠI</th><th>TRẠNG THÁI</th><th>LATENCY</th><th>CẬP NHẬT</th><th /></tr></thead>
        <tbody>
          {devices.map(d => (
            <tr key={d.id}>
              <td><div className="device-cell"><div className={`device-cell-icon ${statusOf(d)}`}><IconForType type={typeOf(d)} size={18} /></div><div><b>{d.name}</b><small>{[d.vendor, d.model].filter(Boolean).join(" · ") || "Chưa có thông tin model"}</small></div></div></td>
              <td>{sites.find(s => String(s.id) === String(d.site_id))?.name || `Site #${d.site_id ?? "—"}`}</td>
              <td><code>{d.address || "—"}</code></td>
              <td><span className="type-pill">{typeOf(d)}</span></td>
              <td><StatusBadge status={d.status} /></td>
              <td>{d.latency_ms == null ? "—" : `${Number(d.latency_ms).toFixed(1)} ms`}</td>
              <td className="date-cell">{formatDate(d.last_checked)}</td>
              <td><div className="row-actions"><button className="icon-btn" title="Sửa" onClick={() => onEdit(d)}><Pencil size={15} /></button><button className="icon-btn danger-icon" title="Xóa" onClick={() => onDelete(d)}><Trash2 size={15} /></button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
