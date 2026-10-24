
import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDown, ArrowDownUp, ArrowRight,
  ArrowUp, Bell, Cable, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, Cloud, Command, Cpu,
  Database, Download, EthernetPort, Eye, FileClock, Filter,
  Gauge, Globe, HardDrive, LayoutDashboard, LifeBuoy, ListFilter,
  LockKeyhole, Menu, Monitor, MoreHorizontal, Network, Plus,
  Radio, RefreshCw, Router, Search, Server, Settings, Shield,
  ShieldAlert, Signal, SlidersHorizontal, Smartphone, Terminal,
  Wifi, X, Zap
} from "lucide-react";
import "./App.css";

const initialSites = [
  { id: 1, name: "Võ Minh - Văn phòng", location: "TP. Hồ Chí Minh", devices: 18 },
  { id: 2, name: "Phúc Long - Site 01", location: "TP. Thủ Đức", devices: 24 },
  { id: 3, name: "Chi nhánh Long An", location: "Long An", devices: 12 }
];

const initialDevices = [
  { id: 1, name: "MikroTik CCR2004", ip: "192.168.10.1", type: "Router", siteId: 1, status: "Online", vendor: "MikroTik", method: "Chưa kết nối", uptime: "—" },
  { id: 2, name: "Core-SW-01", ip: "192.168.10.2", type: "Switch", siteId: 1, status: "Unknown", vendor: "Cisco", method: "Chưa kết nối", uptime: "—" },
  { id: 3, name: "AP-Office-01", ip: "192.168.10.10", type: "Wi-Fi", siteId: 1, status: "Unknown", vendor: "UniFi", method: "Chưa kết nối", uptime: "—" },
  { id: 4, name: "File-Server", ip: "192.168.10.20", type: "Server", siteId: 1, status: "Unknown", vendor: "Windows", method: "Chưa kết nối", uptime: "—" },
  { id: 5, name: "Router-PL-01", ip: "192.168.20.1", type: "Router", siteId: 2, status: "Unknown", vendor: "MikroTik", method: "Chưa kết nối", uptime: "—" },
  { id: 6, name: "SW-Access-01", ip: "192.168.20.2", type: "Switch", siteId: 2, status: "Unknown", vendor: "Cisco", method: "Chưa kết nối", uptime: "—" },
  { id: 7, name: "AP-Lobby-01", ip: "192.168.20.10", type: "Wi-Fi", siteId: 2, status: "Unknown", vendor: "Omada", method: "Chưa kết nối", uptime: "—" },
  { id: 8, name: "NVR-01", ip: "192.168.20.30", type: "Camera/NVR", siteId: 2, status: "Unknown", vendor: "NVR", method: "Chưa kết nối", uptime: "—" },
  { id: 9, name: "Router-LA-01", ip: "192.168.30.1", type: "Router", siteId: 3, status: "Unknown", vendor: "MikroTik", method: "Chưa kết nối", uptime: "—" }
];

const navGroups = [
  {
    title: "MONITORING",
    items: [
      ["Tổng quan", LayoutDashboard],
      ["Topology", Network],
      ["Thiết bị", Server],
      ["Interfaces & Ports", EthernetPort],
      ["Wi-Fi", Wifi],
      ["WAN & Internet", Globe]
    ]
  },
  {
    title: "OPERATIONS",
    items: [
      ["Cảnh báo", Bell],
      ["Sự cố", ShieldAlert],
      ["Lịch sử sự kiện", FileClock],
      ["Công cụ Network", Terminal]
    ]
  },
  {
    title: "ADMINISTRATION",
    items: [
      ["Sites", Database],
      ["VLAN & IP", Cable],
      ["Báo cáo", Activity],
      ["Cài đặt", Settings]
    ]
  }
];

const iconFor = (type) => {
  if (type === "Router") return Router;
  if (type === "Switch") return Network;
  if (type === "Wi-Fi") return Wifi;
  if (type === "Server") return Server;
  if (type === "Camera/NVR") return Eye;
  if (type === "Endpoint") return Monitor;
  return HardDrive;
};

function Status({ status }) {
  const cls = status === "Online" ? "online" :
    status === "Offline" ? "offline" : "unknown";
  return (
    <span className={`status-pill ${cls}`}>
      <i />{status === "Unknown" ? "Chưa xác định" : status}
    </span>
  );
}

function StatCard({ label, value, note, icon: Icon, tone }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}><Icon size={18} /></span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

function EmptyState({ icon: Icon = Database, title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={25} /></div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export default function App() {
  const [sites, setSites] = useState(initialSites);
  const [devices, setDevices] = useState(initialDevices);
  const [selectedSite, setSelectedSite] = useState("1");
  const [page, setPage] = useState("Tổng quan");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Tất cả");
  const [filterType, setFilterType] = useState("Tất cả");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState("");
  const [notice, setNotice] = useState("");
  const [newSite, setNewSite] = useState({ name: "", location: "" });
  const [newDevice, setNewDevice] = useState({
    name: "", ip: "", type: "Router", vendor: ""
  });

  const currentSite = sites.find(s => String(s.id) === selectedSite) || sites[0];

  const siteDevices = useMemo(
    () => devices.filter(d => String(d.siteId) === selectedSite),
    [devices, selectedSite]
  );

  const visibleDevices = useMemo(() => siteDevices.filter(d => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
      [d.name, d.ip, d.vendor, d.type].some(v => v.toLowerCase().includes(q));
    const matchStatus = filterStatus === "Tất cả" || d.status === filterStatus;
    const matchType = filterType === "Tất cả" || d.type === filterType;
    return matchSearch && matchStatus && matchType;
  }), [siteDevices, search, filterStatus, filterType]);

  const onlineCount = siteDevices.filter(d => d.status === "Online").length;
  const offlineCount = siteDevices.filter(d => d.status === "Offline").length;
  const unknownCount = siteDevices.filter(d => d.status === "Unknown").length;

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function addSite(e) {
    e.preventDefault();
    const name = newSite.name.trim();
    if (!name) return;
    const site = {
      id: Date.now(),
      name,
      location: newSite.location.trim() || "Chưa khai báo",
      devices: 0
    };
    setSites(prev => [...prev, site]);
    setSelectedSite(String(site.id));
    setNewSite({ name: "", location: "" });
    setModal("");
    setPage("Sites");
    showNotice("Đã tạo site trên giao diện.");
  }

  function addDevice(e) {
    e.preventDefault();
    if (!newDevice.name.trim() || !newDevice.ip.trim()) return;
    const device = {
      id: Date.now(),
      name: newDevice.name.trim(),
      ip: newDevice.ip.trim(),
      type: newDevice.type,
      vendor: newDevice.vendor.trim() || "Chưa xác định",
      siteId: Number(selectedSite),
      status: "Unknown",
      method: "Chưa kết nối",
      uptime: "—"
    };
    setDevices(prev => [...prev, device]);
    setSites(prev => prev.map(s => String(s.id) === selectedSite
      ? { ...s, devices: s.devices + 1 } : s));
    setNewDevice({ name: "", ip: "", type: "Router", vendor: "" });
    setModal("");
    setPage("Thiết bị");
    showNotice("Đã thêm thiết bị vào danh sách giao diện.");
  }

  function exportDevices() {
    const header = ["Name", "IP", "Type", "Vendor", "Status"];
    const rows = visibleDevices.map(d =>
      [d.name, d.ip, d.type, d.vendor, d.status]
    );
    const csv = [header, ...rows]
      .map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "netops-devices.csv";
    a.click();
    URL.revokeObjectURL(url);
    showNotice("Đã xuất danh sách thiết bị đang hiển thị.");
  }

  const isDevicePage = page === "Thiết bị" || page === "Interfaces & Ports";
  const isOverview = page === "Tổng quan";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={23} /></div>
          <div><strong>NETOPS<span> REALTIME</span></strong><small>NETWORK OPERATIONS</small></div>
          <button className="icon-btn mobile-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <div className="workspace">
          <div className="workspace-avatar">N</div>
          <div className="workspace-text"><strong>Network Operations</strong><small>Workspace · Admin</small></div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-scroll">
          {navGroups.map(group => (
            <div className="nav-group" key={group.title}>
              <div className="nav-label">{group.title}</div>
              {group.items.map(([label, Icon]) => (
                <button
                  key={label}
                  className={`nav-item ${page === label ? "active" : ""}`}
                  onClick={() => { setPage(label); setSidebarOpen(false); }}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{label}</span>
                  {label === "Cảnh báo" && offlineCount > 0 && (
                    <span className="nav-count">{offlineCount}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="connection-card">
            <div className="connection-heading"><span className="connection-dot" /> Backend status</div>
            <strong>Chưa kiểm tra kết nối</strong>
            <small>Chưa xác nhận API server</small>
          </div>
          <button className="nav-item" onClick={() => showNotice("Mở tài liệu vận hành khi được tích hợp.")}>
            <LifeBuoy size={17} /><span>Trợ giúp</span><ArrowUp size={14} className="muted-icon" />
          </button>
          <div className="user-profile">
            <div className="user-avatar">IT</div>
            <div className="user-details"><strong>Network Admin</strong><small>Administrator</small></div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu" />}

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>
            <span>NetOps</span><ChevronRight size={14} /><strong>{page}</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm thiết bị, IP..." />
              <kbd>⌘ K</kbd>
            </div>
            <button className="icon-btn" title="Trạng thái hệ thống" onClick={() => showNotice("Trạng thái backend chưa được xác minh.")}><Activity size={18} /></button>
            <button className="icon-btn notification-btn" title="Thông báo" onClick={() => setPage("Cảnh báo")}><Bell size={18} /><i /></button>
            <div className="top-avatar">IT</div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> NETWORK OPERATIONS CENTER</div>
              <h1>{page}</h1>
              <p className="page-description">
                {isOverview ? "Theo dõi hạ tầng mạng và tình trạng thiết bị theo từng site." :
                  page === "Topology" ? "Sơ đồ kết nối thiết bị mạng theo dữ liệu được khai báo." :
                  page === "Thiết bị" ? "Quản lý thiết bị mạng, địa chỉ IP và trạng thái giám sát." :
                  page === "Sites" ? "Quản lý địa điểm và nhóm thiết bị theo từng site." :
                  `Quản lý và theo dõi ${page.toLowerCase()} trong hạ tầng mạng.`}
              </p>
            </div>
            <div className="heading-actions">
              <div className="site-select-wrap">
                <Network size={16} />
                <select value={selectedSite} onChange={e => setSelectedSite(e.target.value)} aria-label="Chọn site">
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
              <button className="btn btn-secondary" onClick={() => showNotice("Chưa cấu hình API để đồng bộ dữ liệu thực.")}>
                <RefreshCw size={15} /> Đồng bộ
              </button>
              <button className="btn btn-primary" onClick={() => setModal(page === "Sites" ? "site" : "device")}>
                <Plus size={16} /> {page === "Sites" ? "Thêm site" : "Thêm thiết bị"}
              </button>
            </div>
          </section>

          <div className="demo-notice">
            <CircleHelp size={16} />
            <span><strong>Chế độ giao diện:</strong> Dữ liệu khởi tạo chỉ để minh họa bố cục. Chưa kết nối API/SNMP nên trạng thái thiết bị chưa được xác minh.</span>
            <button onClick={() => showNotice("Cần kết nối API backend và worker giám sát để lấy dữ liệu thật.")}>Chi tiết</button>
          </div>

          {isOverview && (
            <>
              <section className="stats-grid">
                <StatCard label="Tổng thiết bị" value={siteDevices.length} note={`${sites.length} site trong workspace`} icon={Server} tone="blue" />
                <StatCard label="Đang hoạt động" value={onlineCount} note="Đã được xác nhận online" icon={Check} tone="green" />
                <StatCard label="Mất kết nối" value={offlineCount} note="Thiết bị được xác nhận offline" icon={AlertTriangle} tone="red" />
                <StatCard label="Chưa giám sát" value={unknownCount} note="Chưa có dữ liệu kiểm tra" icon={Eye} tone="amber" />
              </section>

              <section className="overview-grid">
                <div className="panel network-panel">
                  <div className="panel-heading">
                    <div><h2><Network size={18} /> Network topology</h2><p>Sơ đồ thiết bị thuộc {currentSite?.name}</p></div>
                    <button className="btn btn-quiet" onClick={() => setPage("Topology")}>Mở sơ đồ <ArrowRight size={14} /></button>
                  </div>
                  {siteDevices.length === 0 ? (
                    <EmptyState icon={Network} title="Site chưa có thiết bị" text="Thêm thiết bị để bắt đầu xây dựng sơ đồ mạng." />
                  ) : (
                    <div className="topology-canvas">
                      <div className="topology-lines" />
                      <div className="topo-node topo-router">
                        <div className="topo-device-icon"><Router size={22} /></div>
                        <div className="topo-device-info"><strong>{siteDevices.find(d => d.type === "Router")?.name || "Router chưa khai báo"}</strong><small>{siteDevices.find(d => d.type === "Router")?.ip || "Chưa có IP"}</small></div>
                        <Status status={siteDevices.find(d => d.type === "Router")?.status || "Unknown"} />
                      </div>
                      <div className="topo-connector"><span /></div>
                      <div className="topo-node topo-core">
                        <div className="topo-device-icon purple"><Network size={21} /></div>
                        <div className="topo-device-info"><strong>Switch / LAN</strong><small>Liên kết chưa được xác minh</small></div>
                        <span className="link-label">LINK UNKNOWN</span>
                      </div>
                      <div className="topo-branches">
                        {siteDevices.filter(d => d.type !== "Router").slice(0, 4).map(d => {
                          const Icon = iconFor(d.type);
                          return <div className="topo-branch" key={d.id}>
                            <div className="branch-line" />
                            <div className="topo-leaf">
                              <Icon size={19} />
                              <strong>{d.name}</strong>
                              <small>{d.ip}</small>
                              <Status status={d.status} />
                            </div>
                          </div>;
                        })}
                      </div>
                      <div className="topology-footer"><span><i className="legend-dot green-dot" /> Online</span><span><i className="legend-dot red-dot" /> Offline</span><span><i className="legend-dot gray-dot" /> Chưa xác định</span></div>
                    </div>
                  )}
                </div>

                <div className="panel site-panel">
                  <div className="panel-heading">
                    <div><h2><Database size={18} /> Site overview</h2><p>Thông tin địa điểm đang chọn</p></div>
                    <button className="icon-btn" onClick={() => setPage("Sites")}><MoreHorizontal size={19} /></button>
                  </div>
                  <div className="site-identity">
                    <div className="site-large-icon"><Network size={25} /></div>
                    <div><strong>{currentSite?.name}</strong><small><Globe size={13} /> {currentSite?.location}</small></div>
                  </div>
                  <div className="site-metrics">
                    <div><span>Thiết bị khai báo</span><strong>{siteDevices.length}</strong></div>
                    <div><span>Router</span><strong>{siteDevices.filter(d => d.type === "Router").length}</strong></div>
                    <div><span>Switch</span><strong>{siteDevices.filter(d => d.type === "Switch").length}</strong></div>
                    <div><span>Wi-Fi AP</span><strong>{siteDevices.filter(d => d.type === "Wi-Fi").length}</strong></div>
                  </div>
                  <button className="btn btn-secondary btn-full" onClick={() => setPage("Thiết bị")}>Xem danh sách thiết bị <ArrowRight size={15} /></button>
                </div>
              </section>

              <section className="bottom-grid">
                <div className="panel">
                  <div className="panel-heading">
                    <div><h2><Activity size={18} /> Hiệu năng hệ thống</h2><p>CPU, RAM và băng thông</p></div>
                    <span className="muted-badge">Chưa có telemetry</span>
                  </div>
                  <div className="telemetry-empty">
                    <div className="telemetry-icon"><Gauge size={22} /></div>
                    <div><strong>Chưa nhận dữ liệu hiệu năng</strong><p>Cần tích hợp SNMP/API với thiết bị để hiển thị CPU, RAM và lưu lượng thực.</p></div>
                  </div>
                  <div className="metric-placeholder-grid">
                    <div><Cpu size={17} /><span>CPU usage</span><strong>—</strong></div>
                    <div><Database size={17} /><span>Memory</span><strong>—</strong></div>
                    <div><ArrowDownUp size={17} /><span>Traffic</span><strong>—</strong></div>
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-heading"><div><h2><ShieldAlert size={18} /> Sự kiện gần đây</h2><p>Thông tin từ hệ thống</p></div><button className="btn btn-quiet" onClick={() => setPage("Lịch sử sự kiện")}>Xem tất cả <ArrowRight size={14} /></button></div>
                  <EmptyState icon={FileClock} title="Chưa có sự kiện giám sát" text="Sự kiện sẽ xuất hiện khi backend ghi nhận dữ liệu và cảnh báo." />
                </div>
              </section>
            </>
          )}

          {page === "Topology" && (
            <section className="panel topology-full-panel">
              <div className="panel-heading">
                <div><h2><Network size={18} /> Topology · {currentSite?.name}</h2><p>{siteDevices.length} thiết bị được khai báo · Liên kết vật lý chưa được khám phá tự động</p></div>
                <button className="btn btn-secondary" onClick={() => setPage("Thiết bị")}><Server size={15} /> Quản lý thiết bị</button>
              </div>
              <div className="topology-canvas topology-large">
                {siteDevices.length === 0 ? <EmptyState icon={Network} title="Không có thiết bị" text="Thêm router, switch và AP để bắt đầu." /> : <>
                  <div className="topo-node topo-router">
                    <div className="topo-device-icon"><Router size={22} /></div>
                    <div className="topo-device-info"><strong>{siteDevices.find(d => d.type === "Router")?.name || "Router chưa khai báo"}</strong><small>{siteDevices.find(d => d.type === "Router")?.ip || "Chưa có IP"}</small></div>
                    <Status status={siteDevices.find(d => d.type === "Router")?.status || "Unknown"} />
                  </div>
                  <div className="topo-connector"><span /></div>
                  <div className="topo-node topo-core"><div className="topo-device-icon purple"><Network size={21} /></div><div className="topo-device-info"><strong>LAN / Switching layer</strong><small>Chưa có dữ liệu LLDP/CDP hoặc ARP discovery</small></div><span className="link-label">UNVERIFIED</span></div>
                  <div className="topo-branches topology-branches-large">
                    {siteDevices.filter(d => d.type !== "Router").map(d => { const Icon = iconFor(d.type); return <div className="topo-branch" key={d.id}><div className="branch-line" /><div className="topo-leaf"><Icon size={20} /><strong>{d.name}</strong><small>{d.ip}</small><Status status={d.status} /><span className="leaf-vendor">{d.vendor}</span></div></div>; })}
                  </div>
                </>}
              </div>
              <div className="topology-note"><CircleHelp size={16} /> Các đường nối trong bản giao diện này chỉ thể hiện phân tầng minh họa, không khẳng định thiết bị đang kết nối trực tiếp với nhau. Muốn tự khám phá topology cần tích hợp dữ liệu RouterOS, SNMP, LLDP/CDP và bảng MAC/ARP.</div>
            </section>
          )}

          {isDevicePage && (
            <section className="panel devices-panel">
              <div className="panel-heading devices-heading">
                <div><h2><Server size={18} /> Danh sách thiết bị</h2><p>{visibleDevices.length} kết quả · Site: {currentSite?.name}</p></div>
                <div className="table-actions">
                  <button className="btn btn-secondary" onClick={exportDevices}><Download size={15} /> Xuất CSV</button>
                  <button className="btn btn-secondary" onClick={() => {setSearch("");setFilterStatus("Tất cả");setFilterType("Tất cả");}}><ListFilter size={15} /> Xóa lọc</button>
                </div>
              </div>
              <div className="filter-bar">
                <div className="filter-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên, IP, hãng..." /></div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}><option>Tất cả</option><option>Router</option><option>Switch</option><option>Wi-Fi</option><option>Server</option><option>Camera/NVR</option><option>Endpoint</option></select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option>Tất cả</option><option>Online</option><option>Offline</option><option>Unknown</option></select>
                <span className="result-count">{visibleDevices.length} thiết bị</span>
              </div>
              <div className="table-scroll">
                <table className="device-table">
                  <thead><tr><th>THIẾT BỊ</th><th>IP ADDRESS</th><th>LOẠI</th><th>HÃNG</th><th>TRẠNG THÁI</th><th>PHƯƠNG THỨC</th><th></th></tr></thead>
                  <tbody>
                    {visibleDevices.map(d => {const Icon = iconFor(d.type);return <tr key={d.id}>
                      <td><div className="device-cell"><span className="device-icon"><Icon size={18}/></span><div><strong>{d.name}</strong><small>ID-{d.id}</small></div></div></td>
                      <td className="mono">{d.ip}</td><td><span className="type-tag">{d.type}</span></td><td>{d.vendor}</td><td><Status status={d.status}/></td><td><span className="method-tag">{d.method}</span></td>
                      <td><button className="icon-btn row-more" onClick={() => showNotice(`${d.name}: chưa tích hợp thao tác quản trị backend.`)}><MoreHorizontal size={18}/></button></td>
                    </tr>;})}
                  </tbody>
                </table>
                {visibleDevices.length === 0 && <EmptyState icon={Search} title="Không tìm thấy thiết bị" text="Thử đổi từ khóa tìm kiếm hoặc bộ lọc." />}
              </div>
              <div className="table-footer"><span>Hiển thị {visibleDevices.length} / {siteDevices.length} thiết bị</span><span>Dữ liệu chưa đồng bộ với backend</span></div>
            </section>
          )}

          {page === "Sites" && (
            <section className="site-cards">
              {sites.map(s => {
                const count = devices.filter(d => String(d.siteId) === String(s.id)).length;
                return <div className={`panel site-card ${selectedSite === String(s.id) ? "selected-site-card" : ""}`} key={s.id}>
                  <div className="site-card-top"><div className="site-large-icon"><Network size={23}/></div><button className="icon-btn" onClick={() => {setSelectedSite(String(s.id));showNotice("Đã chọn site.");}}><MoreHorizontal size={18}/></button></div>
                  <h3>{s.name}</h3><p><Globe size={14}/> {s.location}</p>
                  <div className="site-card-stats"><div><strong>{count}</strong><span>Thiết bị khai báo</span></div><div><strong>{devices.filter(d => String(d.siteId) === String(s.id) && d.status === "Online").length}</strong><span>Online xác nhận</span></div></div>
                  <button className="btn btn-secondary btn-full" onClick={() => {setSelectedSite(String(s.id));setPage("Tổng quan");}}>Mở site <ArrowRight size={15}/></button>
                </div>;
              })}
              <button className="add-site-card" onClick={() => setModal("site")}><span><Plus size={22}/></span><strong>Thêm site mới</strong><small>Tạo địa điểm giám sát</small></button>
            </section>
          )}

          {!isOverview && !isDevicePage && page !== "Topology" && page !== "Sites" && (
            <section className="panel feature-placeholder">
              <div className="feature-icon">{page === "Cảnh báo" || page === "Sự cố" ? <ShieldAlert size={28}/> : page === "Wi-Fi" ? <Wifi size={28}/> : page === "WAN & Internet" ? <Globe size={28}/> : page === "Công cụ Network" ? <Terminal size={28}/> : <Settings size={28}/>}</div>
              <h2>{page}</h2>
              <p>Giao diện khu vực {page.toLowerCase()} đã có vị trí trong hệ thống. Chức năng vận hành cần được nối với API backend và dữ liệu thiết bị thực tế.</p>
              {page === "Công cụ Network" && <div className="tool-shortcuts"><button onClick={() => showNotice("Ping cần được thực thi từ backend/worker để kiểm tra thiết bị từ cloud.")}><Activity size={16}/> Ping</button><button onClick={() => showNotice("Traceroute cần worker thực thi tại mạng có thể truy cập thiết bị.")}><ArrowRight size={16}/> Traceroute</button><button onClick={() => showNotice("SNMP walk cần cấu hình SNMP credentials ở backend.")}><Network size={16}/> SNMP Walk</button><button onClick={() => showNotice("DNS lookup cần tích hợp API hoặc backend resolver.")}><Globe size={16}/> DNS Lookup</button></div>}
              <div className="feature-warning"><AlertTriangle size={16}/> Chưa kết nối chức năng này với backend. Không thực hiện thay đổi cấu hình mạng thật.</div>
            </section>
          )}

          <footer className="app-footer"><span>NETOPS REALTIME <span className="footer-sep">/</span> Network Operations Platform</span><span><span className="footer-dot"/> UI ready <span className="footer-sep">·</span> Backend connection unverified</span></footer>
        </div>
      </main>

      {modal && (
        <div className="modal-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) setModal("");}}>
          <form className="modal" onSubmit={modal === "site" ? addSite : addDevice}>
            <div className="modal-header"><div><h2>{modal === "site" ? "Thêm site mới" : "Thêm thiết bị"}</h2><p>{modal === "site" ? "Khai báo một địa điểm trong workspace." : `Thiết bị sẽ được thêm vào ${currentSite?.name}.`}</p></div><button type="button" className="icon-btn" onClick={() => setModal("")}><X size={19}/></button></div>
            {modal === "site" ? <>
              <label>Tên site <span>*</span><input required value={newSite.name} onChange={e => setNewSite({...newSite,name:e.target.value})} placeholder="VD: Chi nhánh Hà Nội"/></label>
              <label>Địa chỉ / vị trí<input value={newSite.location} onChange={e => setNewSite({...newSite,location:e.target.value})} placeholder="VD: Quận 1, TP.HCM"/></label>
            </> : <>
              <label>Tên thiết bị <span>*</span><input required value={newDevice.name} onChange={e => setNewDevice({...newDevice,name:e.target.value})} placeholder="VD: Core-SW-01"/></label>
              <label>Địa chỉ IP <span>*</span><input required value={newDevice.ip} onChange={e => setNewDevice({...newDevice,ip:e.target.value})} placeholder="VD: 192.168.1.1"/></label>
              <label>Loại thiết bị<select value={newDevice.type} onChange={e => setNewDevice({...newDevice,type:e.target.value})}><option>Router</option><option>Switch</option><option>Wi-Fi</option><option>Server</option><option>Camera/NVR</option><option>Endpoint</option></select></label>
              <label>Hãng / model<input value={newDevice.vendor} onChange={e => setNewDevice({...newDevice,vendor:e.target.value})} placeholder="VD: MikroTik CCR2004"/></label>
              <div className="form-info"><CircleHelp size={15}/> Khai báo thiết bị chưa tự động kết nối, ping hoặc bật SNMP.</div>
            </>}
            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setModal("")}>Hủy</button><button className="btn btn-primary" type="submit"><Plus size={15}/> {modal === "site" ? "Tạo site" : "Thêm thiết bị"}</button></div>
          </form>
        </div>
      )}
      {notice && <div className="toast"><Check size={17}/><span>{notice}</span><button onClick={() => setNotice("")}><X size={15}/></button></div>}
    </div>
  );
}
