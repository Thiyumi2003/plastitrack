import { useState, useEffect } from "react";
import axios from "axios";
import MelbourneSidebar from "./MelbourneSidebar";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import "../annotator/annotator.css";

export default function MelbourneDashboard() {
  const [adminKpis, setAdminKpis] = useState(null);
  const [adminReports, setAdminReports] = useState(null);
  const [performance, setPerformance] = useState({ users: [], filters: {} });
  const [systemPerf, setSystemPerf] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [period, setPeriod] = useState("month");
  const [perfLoading, setPerfLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setPerfLoading(true);
        const params = {
          role: roleFilter === "all" ? undefined : roleFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          period,
        };
        const perfRes = await axios.get("http://localhost:5000/api/dashboard/performance/users", {
          headers: getAuthHeader(),
          params,
        });
        const systemRes = await axios.get("http://localhost:5000/api/dashboard/performance/system", {
          headers: getAuthHeader(),
        });
        setPerformance(perfRes.data);
        setSystemPerf(systemRes.data);
      } catch (err) {
        console.error("Performance fetch error:", err);
        setError(err.response?.data?.error || "Failed to load performance data");
      } finally {
        setPerfLoading(false);
      }
    };

    fetchPerformance();
  }, [startDate, endDate, roleFilter, period]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (roleFilter !== "all") params.append("role", roleFilter);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (period) params.append("period", period);
    window.open(`http://localhost:5000/api/dashboard/performance/users/export?${params.toString()}`, "_blank");
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [adminKpiRes, adminReportRes] = await Promise.all([
        axios.get("http://localhost:5000/api/dashboard/kpis", {
          headers: getAuthHeader(),
        }),
        axios.get("http://localhost:5000/api/dashboard/admin/reports", {
          headers: getAuthHeader(),
        }),
      ]);

      console.log("Melbourne dashboard data loaded successfully");
      
      setAdminKpis(adminKpiRes.data);
      setAdminReports(adminReportRes.data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err.response?.data?.error || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };



  if (loading) return <div className="dashboard-loading">Loading dashboard...</div>;

  const COLORS = ["#8B0000", "#FF6B6B", "#FFA07A", "#FFB6C1", "#DDA0DD", "#FF69B4"];

  const statusChartData = adminReports?.statusDistribution?.map((item) => ({
    name: item.status,
    value: item.count,
  })) || [];

  const userChartData = adminReports?.userContributions?.slice(0, 8)?.map((item) => ({
    name: item.name?.split(" ")[0] || item.email,
    completed: item.completed_count || 0,
    total: item.images_count || 0,
  })) || [];

  const progressData = adminReports?.progressOverTime?.map((item) => ({
    date: item.date?.split("-")[2] || "N/A",
    pending: item.pending || 0,
    inProgress: item.in_progress || 0,
    completed: item.completed || 0,
    approved: item.approved || 0,
    rejected: item.rejected || 0,
  })) || [];

  return (
    <div className="dashboard-container">
      <MelbourneSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Melbourne User Dashboard</h1>
          <div className="header-date">{new Date().toLocaleDateString()}</div>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        {/* KPI Cards - Admin Overview + Review Stats */}
        <div className="kpi-section">
          <div className="kpi-card">
            <div className="kpi-value">{adminKpis?.totalImages || 0}</div>
            <div className="kpi-label">Total Images</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{adminKpis?.pending || 0}</div>
            <div className="kpi-label">Pending</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{adminKpis?.inProgress || 0}</div>
            <div className="kpi-label">In Progress</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{adminKpis?.completed || 0}</div>
            <div className="kpi-label">Completed</div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          {/* Progress Over Time */}
          <div className="chart-container">
            <h3>Progress Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="pending" stroke="#FF6B6B" />
                <Line type="monotone" dataKey="inProgress" stroke="#FFA07A" />
                <Line type="monotone" dataKey="completed" stroke="#98D8C8" />
                <Line type="monotone" dataKey="approved" stroke="#6BCB77" />
                <Line type="monotone" dataKey="rejected" stroke="#FF5252" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* User Contributions */}
          <div className="chart-container">
            <h3>User Contributions</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={userChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#6BCB77" name="Completed" />
                <Bar dataKey="total" fill="#4D96FF" name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Image Status Distribution */}
          <div className="chart-container">
            <h3>Image Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-container" style={{ marginTop: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3>Performance & Logins</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Annotator/Tester throughput with login activity</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="assign-select" style={{ minWidth: "140px" }}>
                <option value="all">All Roles</option>
                <option value="annotator">Annotators</option>
                <option value="tester">Testers</option>
              </select>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="assign-select" style={{ minWidth: "120px" }}>
                <option value="month">This Month</option>
                <option value="custom">Custom</option>
              </select>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-input" style={{ padding: "8px" }} />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-input" style={{ padding: "8px" }} />
              <button className="btn-primary" onClick={handleExport} style={{ whiteSpace: "nowrap" }}>Export CSV</button>
            </div>
          </div>

          {perfLoading ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>Loading performance...</div>
          ) : (
            <div className="table-container" style={{ marginTop: "12px" }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Completed</th>
                    <th>Approved</th>
                    <th>Rejected</th>
                    <th>Active</th>
                    <th>Last Activity</th>
                    <th>Last Login</th>
                    <th>Logins</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.users.length === 0 ? (
                    <tr><td colSpan="9" className="no-data">No data for selected range</td></tr>
                  ) : (
                    performance.users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name || u.email}</td>
                        <td>{u.role}</td>
                        <td>{u.tasks_completed || 0}</td>
                        <td>{u.tasks_approved || 0}</td>
                        <td>{u.tasks_rejected || 0}</td>
                        <td>{u.tasks_active || 0}</td>
                        <td>{u.last_task_activity ? new Date(u.last_task_activity).toLocaleString() : "-"}</td>
                        <td>{u.last_login ? new Date(u.last_login).toLocaleString() : "-"}</td>
                        <td>{u.login_count || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {systemPerf && (
          <div className="chart-container" style={{ marginTop: "16px" }}>
            <h3>System Snapshot (last 24h)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.tasksLast24h?.reduce((s, t) => s + (t.count || 0), 0) || 0}</div><div className="kpi-label">Tasks Updated</div></div>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.loginsLast24h?.reduce((s, t) => s + (t.count || 0), 0) || 0}</div><div className="kpi-label">Logins</div></div>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.statusDistribution?.find(s => s.status === 'approved')?.count || 0}</div><div className="kpi-label">Approved Images</div></div>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.imagesLast7d?.reduce((s, t) => s + (t.total || 0), 0) || 0}</div><div className="kpi-label">Uploads (7d)</div></div>
            </div>
            <p style={{ marginTop: "8px", color: "#888", fontSize: "12px" }}>Snapshot at {new Date(systemPerf.timestamp || Date.now()).toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
