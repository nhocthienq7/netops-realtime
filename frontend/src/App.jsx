
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bell, Building2, Cable, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Cpu, Database,
  Download, Eye, Filter, Globe, HardDrive, LayoutDashboard,
  LoaderCircle, LockKeyhole, LogOut, Menu, Monitor, Network,
  Plus, RefreshCw, Router, Search, Server, Settings, ShieldCheck,
  Trash2, Wifi, X, XCircle, Pencil, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip,
  XAxis, YAxis
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
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) return null;

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : detail
          ? JSON.stringify(detail)
          : `API trả về lỗi HTTP ${response.status}`
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
  const value = String(device?.status || "unknown").toLowerCase();
  if (["online", "up", "healthy"].includes(value)) return "online";
  if (["offline", "down", "unreachable"].includes(value)) return "offline";
  if (["degraded", "warning"].includes(value)) return "degraded";
  if (value === "maintenance") return "maintenance";
  return "unknown";
}

function statusLabel(status) {
  return {
    online: "Online",
    offline: "Offline",
    degraded: "Degraded",
    maintenance: "Bảo trì",
    unknown: "Chưa rõ",
  }[statusOf({ status })] || "Chưa rõ";
}

function typeOf(device) {
  return String(device?.device_type || device?.type || "Other");
}

function formatDate(value) {
  if (!value) return "Chưa có dữ liệu";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("vi-VN");
}

function formatNumber(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("vi-VN");
}

function IconForType({ type, size = 18 }) {
  const value = String(type || "").toLowerCase();
  if (value.includes("router") || value.includes("gateway")) return <Router size={size} />;
  if (value.includes("firewall")) return <ShieldCheck size={size} />;
  if (value.includes("switch")) return <Network size={size} />;
  if (value.includes("wi-fi") || value.includes("wifi") || value.includes("access point")) return <Wifi size={size} />;
  if (value.includes("server") || value.includes("nvr")) return <Server size={size} />;
  if (value.includes("camera")) return <Eye size={size} />;
  return <Monitor size={size} />;
}

function StatusBadge({ status }) {
  const normalized = statusOf({ status });
  const Icon = normalized === "online"
    ? CheckCircle2
    : normalized === "offline"
      ? XCircle
      : normalized === "degraded"
        ? AlertTriangle
        : CircleHelp;

  return (
    <span className={`status-badge ${normalized}`}>
      <Icon size={13} />
      {statusLabel(status)}
    </span>
  );
}

function Metric({ title, value, description, icon: Icon, tone = "blue" }) {
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
      <Icon size={28} />
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
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng">
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function DeviceTable({ devices, sites, onEdit, onDelete }) {
  if (!devices.length) {
    return <Empty icon={Monitor} title="Không có thiết bị" detail="Không có thiết bị phù hợp với bộ lọc hiện tại." />;
  }

  return (
    <div className="table-wrap">
      <table className="device-table">
        <thead>
          <tr>
            <th>Thiết bị</th>
            <th>Địa chỉ IP</th>
            <th>Loại</th>
            <th>Site</th>
            <th>Trạng thái</th>
            <th>Latency</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {devices.map(device => (
            <tr key={device.id}>
              <td>
                <div className="device-cell">
                  <IconForType type={typeOf(device)} size={18} />
                  <div>
                    <b>{device.name || `Thiết bị #${device.id}`}</b>
                    <small>{[device.vendor, device.model].filter(Boolean).join(" · ") || "Chưa có thông tin model"}</small>
                  </div>
                </div>
              </td>
              <td>{device.address || "—"}</td>
              <td>{typeOf(device)}</td>
              <td>{sites.find(s => String(s.id) === String(device.site_id))?.name || "—"}</td>
              <td><StatusBadge status={device.status} /></td>
              <td>{device.latency_ms == null ? "—" : `${device.latency_ms} ms`}</td>
              <td>
                <div className="row-actions">
                  <button className="icon-btn" title="Sửa thiết bị" onClick={() => onEdit(device)}><Pencil size={15} /></button>
                  <button className="icon-btn danger-button" title="Xóa thiết bị" onClick={() => onDelete(device)}><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("Tổng quan");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [token, setToken] = useState(getToken);
  const [authMode, setAuthMode] = useState("login");
  const [auth, setAuth] = useState({ organization: "", email: "", password: "" });
  const [me, setMe] = useState(null);

  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);
  const [events, setEvents] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState("");
  const [editingSite, setEditingSite] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [siteForm, setSiteForm] = useState({ name: "", address: "" });
  const [deviceForm, setDeviceForm] = useState(EMPTY_DEVICE);

  const loadData = useCallback(async (quiet = false) => {
    if (!getToken()) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
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
      setError(meResult.reason?.message || "Không kết nối được API.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setMe(meResult.value);

    if (deviceResult.status === "fulfilled") {
      setDevices(arrayOf(deviceResult.value));
    } else {
      setError(deviceResult.reason?.message || "Không tải được thiết bị.");
    }

    if (siteResult.status === "fulfilled") setSites(arrayOf(siteResult.value));
    else setError(siteResult.reason?.message || "Không tải được site.");

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

  useEffect(() => {
    if (!sites.length) {
      setSelectedSiteId("");
      return;
    }
    const exists = sites.some(s => String(s.id) === String(selectedSiteId));
    if (!exists) setSelectedSiteId(String(sites[0].id));
  }, [sites, selectedSiteId]);

  const selectedSite = sites.find(s => String(s.id) === String(selectedSiteId)) || null;

  const selectedSiteDevices = useMemo(() => {
    if (!selectedSite) return [];
    return devices.filter(d => String(d.site_id) === String(selectedSite.id));
  }, [devices, selectedSite]);

  const online = devices.filter(d => statusOf(d) === "online").length;
  const offline = devices.filter(d => statusOf(d) === "offline").length;
  const degraded = devices.filter(d => statusOf(d) === "degraded").length;
  const unknown = devices.filter(d => ["unknown", "maintenance"].includes(statusOf(d))).length;

  const siteOnline = selectedSiteDevices.filter(d => statusOf(d) === "online").length;
  const siteOffline = selectedSiteDevices.filter(d => statusOf(d) === "offline").length;
  const siteUnknown = selectedSiteDevices.filter(d => ["unknown", "degraded", "maintenance"].includes(statusOf(d))).length;

  const filteredDevices = useMemo(() => devices.filter(d => {
    const text = `${d.name || ""} ${d.address || ""} ${d.vendor || ""} ${d.model || ""} ${typeOf(d)}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || statusOf(d) === statusFilter;
    const matchesSite = siteFilter === "all" || String(d.site_id) === String(siteFilter);

    const pageType = {
      Router: ["router", "gateway", "firewall"],
      Switch: ["switch"],
      "Wi-Fi": ["wifi", "wi-fi", "access point", "ap"],
    }[page];

    const matchesType = !pageType || pageType.some(t => typeOf(d).toLowerCase().includes(t));
    const matchesAlert = page !== "Cảnh báo" || statusOf(d) === "offline" || statusOf(d) === "degraded";
    return matchesQuery && matchesStatus && matchesSite && matchesType && matchesAlert;
  }), [devices, query, statusFilter, siteFilter, page]);

  const pageDevices = ["Router", "Switch", "Wi-Fi", "Thiết bị", "Cảnh báo"].includes(page);

  async function submitAuth(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const isRegister = authMode === "register";
      const result = await api(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(auth),
      });
      const newToken = result?.access_token || result?.token;
      if (newToken) {
        localStorage.setItem("netops_token", newToken);
        setToken(newToken);
        setNotice("Đăng nhập thành công.");
      } else if (isRegister) {
        setAuthMode("login");
        setNotice("Đăng ký thành công. Hãy đăng nhập.");
      } else {
        setError("API đăng nhập chưa trả về access_token.");
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

  function openNewSite() {
    setEditingSite(null);
    setSiteForm({ name: "", address: "" });
    setError("");
    setModal("site");
  }

  function openEditSite(site) {
    setEditingSite(site);
    setSiteForm({ name: site.name || "", address: site.address || "" });
    setError("");
    setModal("site");
  }

  async function saveSite(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { name: siteForm.name.trim(), address: siteForm.address.trim() };
      if (!body.name) throw new Error("Tên site không được để trống.");

      let created = null;
      if (editingSite) {
        await api(`/api/sites/${editingSite.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        created = await api("/api/sites", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setModal("");
      setNotice(editingSite ? "Đã cập nhật site." : "Đã tạo site.");
      await loadData(true);

      if (created?.id != null) setSelectedSiteId(String(created.id));
    } catch (err) {
      setError(err.message || "Lưu site thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSite(site) {
    if (!window.confirm(`Xóa site "${site.name}"? Hãy kiểm tra thiết bị liên quan trước khi xác nhận.`)) return;
    setError("");
    try {
      await api(`/api/sites/${site.id}`, { method: "DELETE" });
      setNotice("Đã xóa site.");
      if (String(selectedSiteId) === String(site.id)) setSelectedSiteId("");
      await loadData(true);
    } catch (err) {
      setError(err.message || "Xóa site thất bại.");
    }
  }

  function openNewDevice() {
    if (!sites.length) {
      setError("Hãy tạo site trước khi thêm thiết bị.");
      setPage("Site");
      return;
    }
    setEditingDevice(null);
    setDeviceForm({ ...EMPTY_DEVICE, site_id: selectedSite?.id ?? sites[0].id });
    setError("");
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
    setError("");
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
      if (!body.site_id) throw new Error("Hãy chọn site.");
      if (!body.name.trim()) throw new Error("Tên thiết bị không được để trống.");

      if (editingDevice) {
        await api(`/api/devices/${editingDevice.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await api("/api/devices", {
          method: "POST",
          body: JSON.stringify(body),
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
    if (!window.confirm(`Xóa thiết bị "${device.name}" (${device.address || "chưa có IP"})?`)) return;
    setError("");
    try {
      await api(`/api/devices/${device.id}`, { method: "DELETE" });
      setNotice("Đã xóa thiết bị.");
      await loadData(true);
    } catch (err) {
      setError(err.message || "Xóa thiết bị thất bại.");
    }
  }

  function exportCsv() {
    const rows = [
      ["Tên thiết bị", "IP", "Loại", "Hãng", "Model", "Site", "Trạng thái"],
      ...filteredDevices.map(d => [
        d.name, d.address, typeOf(d), d.vendor, d.model,
        sites.find(s => String(s.id) === String(d.site_id))?.name || d.site_id,
        statusLabel(d.status),
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
          <div className="auth-brand"><Activity size={26} /> NetOps Realtime</div>
          <div className="auth-hero">
            <span className="eyebrow">NETWORK OPERATIONS CENTER</span>
            <h1>Toàn bộ hạ tầng mạng.<br /><span>Một nơi quản lý.</span></h1>
            <p>Quản lý nhiều site và giám sát thiết bị từ một giao diện tập trung.</p>
          </div>
        </div>
        <form className="auth-card" onSubmit={submitAuth}>
          <div className="auth-card-icon"><LockKeyhole size={22} /></div>
          <h2>{authMode === "login" ? "Đăng nhập hệ thống" : "Tạo tài khoản"}</h2>
          {authMode === "register" && (
            <label>Tên tổ chức
              <input required value={auth.organization} onChange={e => setAuth({ ...auth, organization: e.target.value })} placeholder="Tên công ty" />
            </label>
          )}
          <label>Email
            <input type="email" required value={auth.email} onChange={e => setAuth({ ...auth, email: e.target.value })} placeholder="admin@company.com" />
          </label>
          <label>Mật khẩu
            <input type="password" required value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} placeholder="Nhập mật khẩu" />
          </label>
          {error && <div className="inline-error"><AlertTriangle size={16} /> {error}</div>}
          <button className="primary-button auth-submit" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={17} />}
            {saving ? "Đang xử lý..." : authMode === "login" ? "Đăng nhập" : "Đăng ký"}
          </button>
          <button type="button" className="text-button" onClick={() => {
            setAuthMode(authMode === "login" ? "register" : "login");
            setError("");
          }}>
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
          {sidebarOpen && <div className="brand-text"><b>NetOps Realtime</b><small>NETWORK OPERATIONS</small></div>}
        </div>

        {sidebarOpen && <div className="nav-section-title">WORKSPACE</div>}
        <nav className="nav-list">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.label} className={`nav-item ${page === item.label ? "active" : ""}`} onClick={() => setPage(item.label)}>
                <Icon size={18} />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && item.label === "Cảnh báo" && offline > 0 && <b className="nav-count">{offline}</b>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          {sidebarOpen && (
            <div className="side-status">
              <span className="pulse-dot" />
              <div><b>API Monitor</b><small>{error ? "Có lỗi kết nối" : refreshing ? "Đang cập nhật..." : "Đang hoạt động"}</small></div>
            </div>
          )}
          <div className="profile-row">
            <div className="profile-avatar">{(me?.email || "N").slice(0, 1).toUpperCase()}</div>
            {sidebarOpen && <div className="profile-copy"><b>{me?.email || "Tài khoản"}</b><small>{me?.role || "Người dùng"}</small></div>}
            <button className="icon-btn" title="Đăng xuất" onClick={logout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <button className="icon-btn" onClick={() => setSidebarOpen(v => !v)}><Menu size={17} /></button>
            <span>NetOps</span><ChevronRight size={14} /><b>{page}</b>
          </div>
          <div className="topbar-actions">
            <span className="monitor-pill"><span className="pulse-dot" /> API {error ? "ERROR" : "CONNECTED"}</span>
            <button className="icon-btn" title="Làm mới dữ liệu" onClick={() => loadData(true)}><RefreshCw size={16} /></button>
            <button className="icon-btn" title="Đăng xuất" onClick={logout}><LogOut size={16} /></button>
          </div>
        </header>

        <div className="content-area">
          {error && <div className="inline-error"><AlertTriangle size={16} /> {error} <button className="text-button" onClick={() => setError("")}>Đóng</button></div>}
          {notice && <div className="notice-banner"><CheckCircle2 size={16} /> {notice} <button className="text-button" onClick={() => setNotice("")}>Đóng</button></div>}

          <div className="page-heading">
            <div>
              <div className="eyebrow">NETWORK OPERATIONS CENTER</div>
              <h1>{page === "Tổng quan" ? "Network Overview" : page}</h1>
              <p>Giám sát hạ tầng mạng từ dữ liệu backend hiện có.</p>
            </div>
            <div className="heading-actions">
              {page === "Tổng quan" && (
                <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)}>
                  <option value="">Tất cả site</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <button className="secondary-button" onClick={() => loadData(true)}><RefreshCw size={15} /> Làm mới</button>
              {page === "Site" && <button className="primary-button" onClick={openNewSite}><Plus size={16} /> Thêm Site</button>}
              {pageDevices && page !== "Cảnh báo" && <button className="primary-button" onClick={openNewDevice}><Plus size={16} /> Thêm thiết bị</button>}
            </div>
          </div>

          {page === "Tổng quan" && (
            <>
              <div className="metrics-grid">
                <Metric title="Tổng thiết bị" value={selectedSite ? selectedSiteDevices.length : devices.length} description={selectedSite ? selectedSite.name : `${sites.length} site đã khai báo`} icon={Server} tone="blue" />
                <Metric title="Online" value={selectedSite ? siteOnline : online} description="Trạng thái backend báo" icon={CheckCircle2} tone="green" />
                <Metric title="Offline" value={selectedSite ? siteOffline : offline} description="Thiết bị báo mất kết nối" icon={XCircle} tone="red" />
                <Metric title="Chưa rõ / khác" value={selectedSite ? siteUnknown : unknown + degraded} description="Cần dữ liệu hoặc kiểm tra thêm" icon={AlertTriangle} tone="orange" />
              </div>

              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div><h3><Activity size={18} /> Network Health</h3><p>Phân bố trạng thái thiết bị</p></div>
                    <span className="small-tag">LIVE DATA</span>
                  </div>
                  <div className="health-bars">
                    <div className="health-summary">
                      <strong>{(selectedSite ? selectedSiteDevices.length : devices.length) ? Math.round((selectedSite ? siteOnline : online) / (selectedSite ? selectedSiteDevices.length : devices.length) * 100) : 0}%</strong>
                      <span>Online theo dữ liệu hiện có</span>
                    </div>
                    <div className="stacked-bar">
                      <span className="bar-online" style={{ width: `${(selectedSite ? selectedSiteDevices.length : devices.length) ? (selectedSite ? siteOnline : online) / (selectedSite ? selectedSiteDevices.length : devices.length) * 100 : 0}%` }} />
                      <span className="bar-offline" style={{ width: `${(selectedSite ? selectedSiteDevices.length : devices.length) ? (selectedSite ? siteOffline : offline) / (selectedSite ? selectedSiteDevices.length : devices.length) * 100 : 0}%` }} />
                    </div>
                    <div className="legend-row">
                      <span><i className="legend-dot green" />Online <b>{selectedSite ? siteOnline : online}</b></span>
                      <span><i className="legend-dot red" />Offline <b>{selectedSite ? siteOffline : offline}</b></span>
                      <span><i className="legend-dot gray" />Chưa rõ / khác <b>{selectedSite ? siteUnknown : unknown + degraded}</b></span>
                    </div>
                  </div>
                  <div className="panel-divider" />
                  <div className="panel-heading"><div><h3><Zap size={18} /> Độ trễ gần nhất</h3><p>Chỉ hiện khi backend cung cấp latency</p></div></div>
                  <div className="latency-list">
                    {(selectedSite ? selectedSiteDevices : devices)
                      .filter(d => d.latency_ms != null && statusOf(d) === "online")
                      .slice(0, 6).map(d => (
                        <div className="latency-row" key={d.id}>
                          <span className="latency-name"><IconForType type={typeOf(d)} size={16} />{d.name}</span>
                          <div className="latency-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(d.latency_ms) / 2))}%` }} /></div>
                          <b>{Number(d.latency_ms).toFixed(1)} ms</b>
                        </div>
                      ))}
                    {!(selectedSite ? selectedSiteDevices : devices).some(d => d.latency_ms != null && statusOf(d) === "online") && <p className="muted-note">Chưa có dữ liệu latency từ backend.</p>}
                  </div>
                </section>

                <section className="panel alerts-panel">
                  <div className="panel-heading">
                    <div><h3><Bell size={18} /> Sự kiện gần đây</h3><p>Sự kiện trả về từ API</p></div>
                    <button className="text-button" onClick={() => setPage("Cảnh báo")}>Xem tất cả <ChevronRight size={15} /></button>
                  </div>
                  <div className="event-list">
                    {events.slice(0, 6).map((event, i) => (
                      <div className="event-row" key={event.id ?? i}>
                        <div className={`event-symbol ${String(event.level || event.severity || "").toLowerCase()}`}>
                          <AlertTriangle size={16} />
                        </div>
                        <div className="event-copy">
                          <b>{event.device_name || `Thiết bị #${event.device_id ?? "—"}`}</b>
                          <span>{event.message || event.description || "Sự kiện giám sát"}</span>
                          <small>{formatDate(event.created_at || event.timestamp)}</small>
                        </div>
                      </div>
                    ))}
                    {!events.length && <Empty icon={CheckCircle2} title="Chưa có sự kiện" detail="Backend chưa trả về sự kiện nào." />}
                  </div>
                </section>
              </div>

              <section className="panel table-panel">
                <div className="panel-heading">
                  <div><h3><AlertTriangle size={18} /> Thiết bị cần chú ý</h3><p>Thiết bị không ở trạng thái Online</p></div>
                  <button className="secondary-button" onClick={() => setPage("Thiết bị")}>Quản lý thiết bị <ChevronRight size={15} /></button>
                </div>
                <DeviceTable
                  devices={(selectedSite ? selectedSiteDevices : devices).filter(d => statusOf(d) !== "online").slice(0, 8)}
                  sites={sites}
                  onEdit={openEditDevice}
                  onDelete={deleteDevice}
                />
              </section>
            </>
          )}

          {page === "Site" && (
            <div className="site-workspace">
              <section className="panel site-picker">
                <div className="panel-heading">
                  <div><h3><Building2 size={18} /> Danh sách Site</h3><p>Chọn địa điểm cần quản lý</p></div>
                  <span className="small-tag">{sites.length} SITE</span>
                </div>
                <div className="site-picker-list">
                  {sites.map(site => {
                    const count = devices.filter(d => String(d.site_id) === String(site.id)).length;
                    return (
                      <button type="button" key={site.id} className={`site-picker-item ${String(site.id) === String(selectedSiteId) ? "selected" : ""}`} onClick={() => setSelectedSiteId(String(site.id))}>
                        <Building2 size={19} />
                        <div className="site-picker-copy">
                          <b>{site.name}</b>
                          <span>{site.address || "Chưa có địa chỉ"}</span>
                          <small>{count} thiết bị</small>
                        </div>
                        <ChevronRight size={18} />
                      </button>
                    );
                  })}
                  {!sites.length && <Empty icon={Building2} title="Chưa có Site" detail="Bấm Thêm Site để tạo địa điểm đầu tiên." />}
                </div>
              </section>

              <div className="site-detail-column">
                {!selectedSite ? (
                  <section className="panel"><Empty icon={Network} title="Chưa chọn Site" detail="Tạo site hoặc chọn một site ở danh sách bên trái." /></section>
                ) : (
                  <>
                    <section className="panel site-detail-header">
                      <div>
                        <div className="eyebrow">SITE-{String(selectedSite.id).padStart(3, "0")}</div>
                        <h2>{selectedSite.name}</h2>
                        <p>{selectedSite.address || "Chưa cập nhật địa chỉ"}</p>
                      </div>
                      <div className="heading-actions">
                        <button className="secondary-button" onClick={() => openEditSite(selectedSite)}><Pencil size={15} /> Sửa Site</button>
                        <button className="secondary-button danger-button" onClick={() => deleteSite(selectedSite)}><Trash2 size={15} /> Xóa Site</button>
                        <button className="secondary-button" onClick={() => { setSiteFilter(String(selectedSite.id)); setPage("Thiết bị"); }}><Eye size={15} /> Thiết bị</button>
                      </div>
                    </section>

                    <div className="site-detail-metrics">
                      <Metric title="Tổng thiết bị" value={selectedSiteDevices.length} description="Đã khai báo trong site" icon={Server} tone="blue" />
                      <Metric title="Online" value={siteOnline} description="Backend báo Online" icon={CheckCircle2} tone="green" />
                      <Metric title="Offline" value={siteOffline} description="Backend báo Offline" icon={AlertTriangle} tone="red" />
                    </div>

                    <section className="panel">
                      <div className="panel-heading"><div><h3><Network size={18} /> Thiết bị theo loại</h3><p>Thống kê từ danh sách thiết bị API</p></div></div>
                      <div className="site-type-grid">
                        {[
                          { label: "Router", types: ["router", "gateway"] },
                          { label: "Firewall", types: ["firewall"] },
                          { label: "Switch", types: ["switch"] },
                          { label: "Wi-Fi / AP", types: ["wifi", "wi-fi", "access point"] },
                          { label: "Server / NVR", types: ["server", "nvr"] },
                          { label: "Camera", types: ["camera"] },
                        ].map(item => {
                          const count = selectedSiteDevices.filter(d => item.types.some(t => typeOf(d).toLowerCase().includes(t))).length;
                          return <div className="site-type-card" key={item.label}><Network size={19} /><span>{item.label}</span><b>{count}</b></div>;
                        })}
                      </div>
                    </section>

                    <section className="panel site-network-panel">
                      <div className="panel-heading">
                        <div><h3><Cable size={18} /> Sơ đồ thiết bị — {selectedSite.name}</h3><p>Danh sách nhóm thiết bị thuộc site đang chọn</p></div>
                        <span className="small-tag">{selectedSiteDevices.length} THIẾT BỊ</span>
                      </div>
                      <div className="topology-notice"><CircleHelp size={17} /><span>Đây là nhóm thiết bị theo loại. Không hiển thị đường nối vật lý khi backend chưa cung cấp dữ liệu topology đã xác minh.</span></div>
                      {selectedSiteDevices.length ? (
                        <div className="site-network-nodes">
                          {selectedSiteDevices.map(device => (
                            <article className="site-network-node" key={device.id}>
                              <div className={`site-network-node-icon ${statusOf(device)}`}><IconForType type={typeOf(device)} size={22} /></div>
                              <div className="site-network-node-info">
                                <b>{device.name}</b>
                                <span>{device.address || "Chưa có IP"}</span>
                                <small>{[device.vendor, device.model].filter(Boolean).join(" · ") || typeOf(device)}</small>
                              </div>
                              <StatusBadge status={device.status} />
                              <button className="icon-btn" onClick={() => openEditDevice(device)} title="Sửa thiết bị"><Pencil size={14} /></button>
                            </article>
                          ))}
                        </div>
                      ) : <Empty icon={Network} title="Site chưa có thiết bị" detail="Bấm Thêm thiết bị để bắt đầu." />}
                    </section>
                  </>
                )}
              </div>
            </div>
          )}

          {pageDevices && (
            <section className="panel table-panel">
              <div className="panel-heading">
                <div><h3><IconForType type={page === "Thiết bị" ? "device" : page} /> {page === "Cảnh báo" ? "Thiết bị cần kiểm tra" : `Danh sách ${page.toLowerCase()}`}</h3><p>Dữ liệu lấy từ API backend</p></div>
                <div className="heading-actions">
                  <button className="secondary-button" onClick={exportCsv}><Download size={15} /> Xuất CSV</button>
                  {page !== "Cảnh báo" && <button className="primary-button" onClick={openNewDevice}><Plus size={15} /> Thêm thiết bị</button>}
                </div>
              </div>
              <div className="filter-toolbar">
                <div className="search-input"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên, IP, hãng, model..." /></div>
                <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}><option value="all">Tất cả site</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Mọi trạng thái</option><option value="online">Online</option><option value="offline">Offline</option><option value="unknown">Chưa rõ</option><option value="degraded">Degraded</option></select>
                <button className="icon-btn" title="Xóa bộ lọc" onClick={() => { setQuery(""); setSiteFilter("all"); setStatusFilter("all"); }}><Filter size={16} /></button>
              </div>
              {loading ? <Empty icon={LoaderCircle} title="Đang tải" detail="Đang lấy dữ liệu từ API." /> : <DeviceTable devices={filteredDevices} sites={sites} onEdit={openEditDevice} onDelete={deleteDevice} />}
              <div className="table-footer">Hiển thị <b>{filteredDevices.length}</b> / {devices.length} thiết bị <span>·</span> Tự cập nhật mỗi 15 giây</div>
            </section>
          )}

          {page === "Sơ đồ mạng" && (
            <section className="panel topology-panel">
              <div className="panel-heading"><div><h3><Cable size={18} /> Sơ đồ thiết bị theo Site</h3><p>Danh sách thiết bị hiện có từ backend</p></div></div>
              <div className="topology-notice"><CircleHelp size={17} /><span>Chưa có dữ liệu liên kết vật lý được xác minh. Giao diện không tự suy đoán đường nối từ địa chỉ IP.</span></div>
              {sites.map(site => {
                const siteDevices = devices.filter(d => String(d.site_id) === String(site.id));
                if (!siteDevices.length) return null;
                return (
                  <div className="topology-site" key={site.id}>
                    <button className="topology-site-heading" onClick={() => { setSelectedSiteId(String(site.id)); setPage("Site"); }}><Building2 size={18} /><b>{site.name}</b><span>{siteDevices.length} thiết bị</span><ChevronRight size={15} /></button>
                    <div className="topology-device-grid">
                      {siteDevices.map(d => <div className="topology-device" key={d.id}><div className={`topology-device-icon ${statusOf(d)}`}><IconForType type={typeOf(d)} size={22} /></div><div><b>{d.name}</b><span>{d.address || "Chưa có IP"}</span><small>{typeOf(d)}</small></div><StatusBadge status={d.status} /></div>)}
                    </div>
                  </div>
                );
              })}
              {!devices.length && <Empty icon={Cable} title="Chưa có thiết bị" detail="Thêm thiết bị trước khi xây dựng sơ đồ mạng." />}
            </section>
          )}

          {page === "Cài đặt" && (
            <div className="settings-grid">
              <section className="panel settings-card">
                <div className="settings-icon"><Globe size={20} /></div>
                <h3>Kết nối API</h3><p>Backend mà giao diện đang sử dụng.</p>
                <label>API Base URL<input value={API} readOnly /></label>
                <div className="settings-info"><span className="pulse-dot" /> Tự cập nhật mỗi 15 giây.</div>
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
                <h3>Dữ liệu hiện có</h3><p>Thống kê từ API, không phải số liệu giả.</p>
                <div className="account-detail"><span>Site</span><b>{sites.length}</b></div>
                <div className="account-detail"><span>Thiết bị</span><b>{devices.length}</b></div>
                <div className="account-detail"><span>Sự kiện</span><b>{events.length}</b></div>
              </section>
            </div>
          )}
        </div>
      </main>

      {modal === "site" && (
        <Modal title={editingSite ? "Sửa Site" : "Tạo Site mới"} onClose={() => setModal("")}>
          <form className="form-body" onSubmit={saveSite}>
            <label>Tên Site *
              <input required autoFocus value={siteForm.name} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} placeholder="Ví dụ: Văn phòng chính" />
            </label>
            <label>Địa chỉ / vị trí
              <input value={siteForm.address} onChange={e => setSiteForm({ ...siteForm, address: e.target.value })} placeholder="Địa chỉ hoặc khu vực" />
            </label>
            {error && <div className="inline-error"><AlertTriangle size={15} /> {error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModal("")}>Hủy</button>
              <button className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : editingSite ? "Lưu thay đổi" : "Tạo Site"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "device" && (
        <Modal title={editingDevice ? "Sửa thiết bị" : "Thêm thiết bị"} onClose={() => setModal("")}>
          <form className="form-body" onSubmit={saveDevice}>
            <label>Tên thiết bị *
              <input required value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} placeholder="Ví dụ: Router-MikroTik" />
            </label>
            <label>Site *
              <select required value={deviceForm.site_id} onChange={e => setDeviceForm({ ...deviceForm, site_id: e.target.value })}>
                <option value="">Chọn Site</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>Địa chỉ IP / hostname *
              <input required value={deviceForm.address} onChange={e => setDeviceForm({ ...deviceForm, address: e.target.value })} placeholder="192.168.1.1" />
            </label>
            <label>Loại thiết bị
              <select value={deviceForm.device_type} onChange={e => setDeviceForm({ ...deviceForm, device_type: e.target.value })}>
                {["Router", "Switch", "Wi-Fi", "Firewall", "Server", "Camera", "NVR", "Other"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>Hãng
              <input value={deviceForm.vendor || ""} onChange={e => setDeviceForm({ ...deviceForm, vendor: e.target.value })} placeholder="MikroTik, Cisco, Fortinet..." />
            </label>
            <label>Model
              <input value={deviceForm.model || ""} onChange={e => setDeviceForm({ ...deviceForm, model: e.target.value })} placeholder="Model thiết bị" />
            </label>
            <div className="form-checkboxes">
              <label><input type="checkbox" checked={Boolean(deviceForm.ping_enabled)} onChange={e => setDeviceForm({ ...deviceForm, ping_enabled: e.target.checked })} /> Giám sát Ping</label>
              <label><input type="checkbox" checked={Boolean(deviceForm.snmp_enabled)} onChange={e => setDeviceForm({ ...deviceForm, snmp_enabled: e.target.checked })} /> Bật SNMP</label>
            </div>
            {deviceForm.snmp_enabled && (
              <>
                <label>SNMP version
                  <select value={deviceForm.snmp_version || "2c"} onChange={e => setDeviceForm({ ...deviceForm, snmp_version: e.target.value })}><option value="2c">v2c</option><option value="3">v3</option></select>
                </label>
                <label>SNMP port
                  <input type="number" min="1" max="65535" value={deviceForm.snmp_port || 161} onChange={e => setDeviceForm({ ...deviceForm, snmp_port: e.target.value })} />
                </label>
                {deviceForm.snmp_version !== "3" && <label>Community
                  <input value={deviceForm.snmp_community || ""} onChange={e => setDeviceForm({ ...deviceForm, snmp_community: e.target.value })} />
                </label>}
              </>
            )}
            {error && <div className="inline-error"><AlertTriangle size={15} /> {error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModal("")}>Hủy</button>
              <button className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : editingDevice ? "Lưu thay đổi" : "Thêm thiết bị"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
