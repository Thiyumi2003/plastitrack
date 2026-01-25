import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import AdminSidebar from "./AdminSidebar";
import "./admin.css";

export default function AdminReports() {
  const [reports, setReports] = useState(null);
  const [performance, setPerformance] = useState({ users: [], filters: {} });
  const [systemPerf, setSystemPerf] = useState(null);
  const [annotationData, setAnnotationData] = useState([]);
  const [annStartDate, setAnnStartDate] = useState("");
  const [annEndDate, setAnnEndDate] = useState("");
  const [annRoleFilter, setAnnRoleFilter] = useState("all");
  const [annLoading, setAnnLoading] = useState(false);
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
    const fetchReports = async () => {
      try {
        setLoading(true);
        const response = await axios.get("http://localhost:5000/api/dashboard/admin/reports", {
          headers: getAuthHeader(),
        });
        setReports(response.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load reports");
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
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
        const sysRes = await axios.get("http://localhost:5000/api/dashboard/performance/system", {
          headers: getAuthHeader(),
        });
        setPerformance(perfRes.data);
        setSystemPerf(sysRes.data);
      } catch (err) {
        console.error("Performance fetch error:", err);
        setError(err.response?.data?.error || "Failed to load performance data");
      } finally {
        setPerfLoading(false);
      }
    };

    fetchPerformance();
  }, [startDate, endDate, roleFilter, period]);

  useEffect(() => {
    const fetchAnnotationData = async () => {
      try {
        setAnnLoading(true);
        const params = {
          role: annRoleFilter === "all" ? undefined : annRoleFilter,
          startDate: annStartDate || undefined,
          endDate: annEndDate || undefined,
        };
        const res = await axios.get("http://localhost:5000/api/dashboard/detailed-annotations", {
          headers: getAuthHeader(),
          params,
        });
        setAnnotationData(res.data.data || []);
      } catch (err) {
        console.error("Annotation data fetch error:", err);
        setError(err.response?.data?.error || "Failed to load annotation data");
      } finally {
        setAnnLoading(false);
      }
    };

    fetchAnnotationData();
  }, [annStartDate, annEndDate, annRoleFilter]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (roleFilter !== "all") params.append("role", roleFilter);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (period) params.append("period", period);
    window.open(`http://localhost:5000/api/dashboard/performance/users/export?${params.toString()}`, "_blank");
  };

  if (loading) return <div className="dashboard-loading">Loading reports...</div>;

  const COLORS = ["#8B0000", "#FF6B6B", "#FFA07A", "#FFB6C1", "#DDA0DD", "#FF69B4"];

  const statusChartData = reports?.statusDistribution?.map((item) => ({
    name: item.status,
    value: item.count,
  })) || [];

  const userChartData = reports?.userContributions?.slice(0, 10)?.map((item) => ({
    name: item.name?.split(" ")[0] || item.email,
    completed: Number(item.completed_count || 0),
    total: Number(item.images_count || 0),
  })) || [];

  const progressData = reports?.progressOverTime?.map((item) => ({
    date: item.date?.split("-")[2] || "N/A",
    pending: Number(item.pending || 0),
    inProgress: Number(item.in_progress || 0),
    completed: Number(item.completed || 0),
    approved: Number(item.approved || 0),
    rejected: Number(item.rejected || 0),
  })) || [];

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Reports & Analytics</h1>
          <div className="header-date">{new Date().toLocaleDateString()}</div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="charts-section">
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
              <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Annotator/Tester throughput with date/month filters and CSV export</p>
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

        <div className="chart-container" style={{ marginTop: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3>Annotated Images and Hours by Date</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Annotations completed, verified, and hours logged by date</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select value={annRoleFilter} onChange={(e) => setAnnRoleFilter(e.target.value)} className="assign-select" style={{ minWidth: "140px" }}>
                <option value="all">All Roles</option>
                <option value="annotator">Annotators</option>
                <option value="tester">Testers</option>
              </select>
              <input type="date" value={annStartDate} onChange={(e) => setAnnStartDate(e.target.value)} className="text-input" style={{ padding: "8px" }} />
              <input type="date" value={annEndDate} onChange={(e) => setAnnEndDate(e.target.value)} className="text-input" style={{ padding: "8px" }} />
            </div>
          </div>

          {annLoading ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>Loading annotation data...</div>
          ) : annotationData.length === 0 ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>No data for selected range</div>
          ) : (
            <>
              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "16px" }}>
                <div className="kpi-card" style={{ backgroundColor: "#FFE8E8", borderLeft: "4px solid #FF6B6B" }}>
                  <div className="kpi-value">{annotationData.reduce((sum, row) => sum + Number(row.annotated_images || 0), 0)}</div>
                  <div className="kpi-label">Total Annotated Images</div>
                </div>
                <div className="kpi-card" style={{ backgroundColor: "#FFF0E8", borderLeft: "4px solid #FFA07A" }}>
                  <div className="kpi-value">{annotationData.reduce((sum, row) => sum + Number(row.annotation_hrs || 0), 0).toFixed(2)}</div>
                  <div className="kpi-label">Total Annotation Hrs</div>
                </div>
                <div className="kpi-card" style={{ backgroundColor: "#E8F5FF", borderLeft: "4px solid #4D96FF" }}>
                  <div className="kpi-value">{annotationData.length > 0 ? (annotationData.reduce((sum, row) => sum + Number(row.annotation_hrs || 0), 0) / annotationData.length).toFixed(2) : 0}</div>
                  <div className="kpi-label">Avg Annotation Hrs/day</div>
                </div>
                <div className="kpi-card" style={{ backgroundColor: "#E8F5F0", borderLeft: "4px solid #10b981" }}>
                  <div className="kpi-value">{annotationData.reduce((sum, row) => sum + Number(row.verified_images || 0), 0)}</div>
                  <div className="kpi-label">Total Verified Images</div>
                </div>
                <div className="kpi-card" style={{ backgroundColor: "#F0E8FF", borderLeft: "4px solid #8b5cf6" }}>
                  <div className="kpi-value">{annotationData.reduce((sum, row) => sum + Number(row.verification_hrs || 0), 0).toFixed(2)}</div>
                  <div className="kpi-label">Total Verification Hrs</div>
                </div>
                <div className="kpi-card" style={{ backgroundColor: "#FFFAE8", borderLeft: "4px solid #f59e0b" }}>
                  <div className="kpi-value">{annotationData.reduce((sum, row) => sum + (row.approved_annotations || 0), 0)}</div>
                  <div className="kpi-label">Total Approved</div>
                </div>
              </div>

              {/* Charts */}
              <div style={{ marginTop: "20px" }}>
                <h4>Annotated Images and Hrs by Date</h4>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={annotationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="annotated_images" stroke="#FF6B6B" strokeWidth={2} name="Annotated Images" />
                    <Line yAxisId="right" type="monotone" dataKey="annotation_hrs" stroke="#FFA07A" strokeWidth={2} name="Annotation Hrs" />
                    <Line yAxisId="left" type="monotone" dataKey="verified_images" stroke="#10b981" strokeWidth={2} name="Verified Images" />
                    <Line yAxisId="right" type="monotone" dataKey="verification_hrs" stroke="#8b5cf6" strokeWidth={2} name="Verification Hrs" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginTop: "20px" }}>
                <h4>Approval Rate by Date</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={annotationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="annotation_approval_rate" fill="#6BCB77" name="Approval Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table */}
              <div style={{ marginTop: "20px" }}>
                <h4>Detailed View</h4>
                <div className="table-container" style={{ marginTop: "12px", overflowX: "auto" }}>
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Annotated Images</th>
                        <th>Annotation Hrs</th>
                        <th>Avg Hrs/Image</th>
                        <th>Verified Images</th>
                        <th>Verification Hrs</th>
                        <th>Avg Verification Hrs</th>
                        <th>Approved</th>
                        <th>Approval Rate %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annotationData.map((row, idx) => (
                        <tr key={idx}>
                          <td><strong>{row.date}</strong></td>
                          <td>{row.annotated_images || 0}</td>
                          <td>{row.annotation_hrs || 0}</td>
                          <td>{row.avg_annotation_hrs_per_image || 0}</td>
                          <td>{row.verified_images || 0}</td>
                          <td>{row.verification_hrs || 0}</td>
                          <td>{row.avg_verification_hrs_per_image || 0}</td>
                          <td>{row.approved_annotations || 0}</td>
                          <td><strong>{row.annotation_approval_rate || 0}%</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="report-summary">
          <h3>Summary Statistics</h3>
          <div className="summary-cards">
            <div className="summary-card">
              <h4>Total Contributors</h4>
              <p className="summary-value">{reports?.userContributions?.length || 0}</p>
            </div>
            <div className="summary-card">
              <h4>Completion Rate</h4>
              <p className="summary-value">
                {reports?.statusDistribution?.length > 0
                  ? (
                      ((reports.statusDistribution.find((s) => s.status === "completed")?.count || 0) /
                        reports.statusDistribution.reduce((sum, s) => sum + s.count, 0)) *
                      100
                    ).toFixed(1)
                  : 0}
                %
              </p>
            </div>
            <div className="summary-card">
              <h4>Average Time</h4>
              <p className="summary-value">2.5 days</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
