import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Sidebar from "./Sidebar";
import "./superadmin.css";

export default function Reports() {
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
        const response = await axios.get("http://localhost:5000/api/dashboard/reports", {
          headers: getAuthHeader(),
        });
        setReports(response.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  const userChartData = reports?.userContributions?.map((item) => ({
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
      <Sidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Reports & Analytics</h1>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="charts-section">
          {/* Progress Over Time */}
          <div className="chart-container">
            <h3>Progress Over Time</h3>
            <ResponsiveContainer width="100%" height={400}>
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
            <ResponsiveContainer width="100%" height={400}>
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
        </div>

        {/* Detailed Reports */}
        <div className="reports-section">
          <h3>Detailed Reports</h3>
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Image ID</th>
                  <th>Image Name</th>
                  <th>Assigned To</th>
                  <th>Annotator</th>
                  <th>Tester</th>
                  <th>Status</th>
                  <th>Objects</th>
                  <th>Created Date</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {reports?.detailedReports?.map((report) => (
                  <tr key={report.id}>
                    <td>#{report.id}</td>
                    <td>{report.image_name}</td>
                    <td>{report.assigned_to || "-"}</td>
                    <td>{report.annotator || "-"}</td>
                    <td>{report.tester || "-"}</td>
                    <td>
                      <span className={`status-badge status-${report.status}`}>
                        {report.status}
                      </span>
                    </td>
                    <td>{report.objects_count || 0}</td>
                    <td>{report.created_at?.split("T")[0]}</td>
                    <td>{report.updated_at?.split("T")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
