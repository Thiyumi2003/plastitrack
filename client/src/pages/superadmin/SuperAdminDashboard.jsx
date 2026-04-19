import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatChartDate } from "../../utils/dateUtils";
import "./superadmin.css";

export default function SuperAdminDashboard() {
  const [kpis, setKpis] = useState(null);
  const [reports, setReports] = useState(null);
  const [summaryProgress, setSummaryProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [kpiRes, reportRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/kpis`, { headers: getAuthHeader() }),
          axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/reports`, { headers: getAuthHeader() }),
        ]);

        let summaryRes = null;
        try {
          summaryRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/reports/image-progress`, { headers: getAuthHeader() });
        } catch (progressErr) {
          console.warn("Image progress endpoint failed, falling back to annotation summary:", progressErr?.response?.status || progressErr?.message);
          summaryRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/reports/annotation-summary`, { headers: getAuthHeader() });
        }

        setKpis(kpiRes.data);
        setReports(reportRes.data);
        setSummaryProgress(
          (summaryRes?.data?.progressOverTime || []).map((item) => ({
            date: formatChartDate(item.date),
            pending: Number(item.pending || 0),
            inProgress: Number(item.in_progress || 0),
            completed: Number(item.completed || 0),
            approved: Number(item.approved || 0),
            rejected: Number(item.rejected || 0),
          }))
        );
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load dashboard");
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const COLORS = ["#8B0000", "#FF6B6B", "#FFA07A", "#FFB6C1", "#DDA0DD", "#FF69B4"];

  // Format status distribution for pie chart
  const statusChartData = reports?.statusDistribution?.map((item) => ({
    name: item.status,
    value: item.count,
  })) || [];

  // Format user contributions for bar chart
  const userChartData = reports?.userContributions?.slice(0, 8)?.map((item) => ({
    name: item.name?.split(" ")[0] || item.email,
    completed: item.completed_count || 0,
    total: item.images_count || 0,
  })) || [];

  // Keep dashboard trend exactly aligned with report section trend data.
  const progressData = summaryProgress;

  return (
    <>
      <div className="dashboard-header">
        <h1>Super Admin Dashboard</h1>
      </div>

      {error && <div className="dashboard-error">{error}</div>}
      {loading && <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: 16 }}>Loading dashboard data...</div>}

        {/* KPI Cards */}
        <div className="kpi-section">
          <div className="kpi-card">
            <div className="kpi-value">{kpis?.totalImages || 0}</div>
            <div className="kpi-label">Total Images</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpis?.pending || 0}</div>
            <div className="kpi-label">Pending</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpis?.inProgress || 0}</div>
            <div className="kpi-label">In Progress</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpis?.completed || 0}</div>
            <div className="kpi-label">Completed</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpis?.approve || 0}</div>
            <div className="kpi-label">Approve</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{kpis?.rejected || 0}</div>
            <div className="kpi-label">Rejected</div>
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
                  label={({ name, value }) => `${name}: ${value}`}
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

        {/* Detailed Reports Table */}
        <div className="reports-section">
          <h3>Detailed Reports</h3>
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Image ID</th>
                  <th>Image Name</th>
                  <th>Annotator</th>
                  <th>Tester</th>
                  <th>Status</th>
                  <th>Objects</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {reports?.detailedReports?.slice(0, 20)?.map((report) => (
                  <tr key={report.id}>
                    <td>#{report.id}</td>
                    <td>{report.image_name}</td>
                    <td>{report.annotator || "-"}</td>
                    <td>{report.tester || "-"}</td>
                    <td>
                      <span className={`status-badge status-${report.status}`}>
                        {report.status}
                      </span>
                    </td>
                    <td>{report.objects_count || 0}</td>
                    <td>{report.created_at?.split("T")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

