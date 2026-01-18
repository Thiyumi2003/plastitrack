import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import AdminSidebar from "./AdminSidebar";
import "./admin.css";

export default function AdminReports() {
  const [reports, setReports] = useState(null);
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

  if (loading) return <div className="dashboard-loading">Loading reports...</div>;

  const COLORS = ["#8B0000", "#FF6B6B", "#FFA07A", "#FFB6C1", "#DDA0DD", "#FF69B4"];

  const statusChartData = reports?.statusDistribution?.map((item) => ({
    name: item.status,
    value: item.count,
  })) || [];

  const userChartData = reports?.userContributions?.slice(0, 10)?.map((item) => ({
    name: item.name?.split(" ")[0] || item.email,
    completed: item.completed_count || 0,
    total: item.images_count || 0,
  })) || [];

  const progressData = reports?.progressOverTime?.map((item) => ({
    date: item.date?.split("-")[2] || "N/A",
    pending: item.pending || 0,
    inProgress: item.in_progress || 0,
    completed: item.completed || 0,
    approved: item.approved || 0,
    rejected: item.rejected || 0,
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
