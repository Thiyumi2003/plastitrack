import { useState, useEffect } from "react";
import axios from "axios";
import MelbourneSidebar from "./MelbourneSidebar";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatChartDate } from "../../utils/dateUtils";
import "../annotator/annotator.css";

export default function MelbourneAdminDashboard() {
  const [kpis, setKpis] = useState(null);
  const [reports, setReports] = useState(null);
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
          axios.get("http://localhost:5000/api/dashboard/kpis", { headers: getAuthHeader() }),
          axios.get("http://localhost:5000/api/dashboard/admin/reports", { headers: getAuthHeader() }),
        ]);

        setKpis(kpiRes.data);
        setReports(reportRes.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load dashboard");
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) return <div className="dashboard-loading">Loading dashboard...</div>;

  const COLORS = ["#8B0000", "#FF6B6B", "#FFA07A", "#FFB6C1", "#DDA0DD", "#FF69B4"];

  const statusChartData = reports?.statusDistribution?.map((item) => ({
    name: item.status,
    value: item.count,
  })) || [];

  const userChartData = reports?.userContributions?.slice(0, 8)?.map((item) => ({
    name: item.name?.split(" ")[0] || item.email,
    completed: item.completed_count || 0,
    total: item.images_count || 0,
  })) || [];

  const progressData = reports?.progressOverTime?.map((item) => ({
    date: formatChartDate(item.date),
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
          <h1>Admin Dashboard Overview</h1>
          <div className="header-date">{new Date().toLocaleDateString()}</div>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

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
        </div>

        {/* Status Distribution Chart */}
        {statusChartData.length > 0 && (
          <div className="chart-section">
            <h2>Status Distribution</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
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
        )}

        {/* User Contributions Chart */}
        {userChartData.length > 0 && (
          <div className="chart-section">
            <h2>User Contributions</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill="#10b981" name="Completed" />
                  <Bar dataKey="total" fill="#667eea" name="Total" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Progress Over Time */}
        {progressData.length > 0 && (
          <div className="chart-section">
            <h2>Progress Over Time</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} />
                  <Line type="monotone" dataKey="inProgress" stroke="#667eea" strokeWidth={2} />
                  <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="approved" stroke="#8b5cf6" strokeWidth={2} />
                  <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
