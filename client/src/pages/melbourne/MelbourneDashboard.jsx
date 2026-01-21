import { useState, useEffect } from "react";
import axios from "axios";
import MelbourneSidebar from "./MelbourneSidebar";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import "../annotator/annotator.css";

export default function MelbourneDashboard() {
  const [adminKpis, setAdminKpis] = useState(null);
  const [adminReports, setAdminReports] = useState(null);
  const [reviewKpis, setReviewKpis] = useState({
    pendingReview: 0,
    approved: 0,
    rejected: 0
  });
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    status: "",
    feedback: ""
  });

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [adminKpiRes, adminReportRes, reviewStatsRes, datasetsRes] = await Promise.all([
        axios.get("http://localhost:5000/api/dashboard/kpis", {
          headers: getAuthHeader(),
        }),
        axios.get("http://localhost:5000/api/dashboard/admin/reports", {
          headers: getAuthHeader(),
        }),
        axios.get("http://localhost:5000/api/dashboard/melbourne/dashboard", {
          headers: getAuthHeader(),
        }),
        axios.get("http://localhost:5000/api/dashboard/melbourne/datasets", {
          headers: getAuthHeader(),
        }),
      ]);

      console.log("Melbourne dashboard data loaded successfully");
      
      setAdminKpis(adminKpiRes.data);
      setAdminReports(adminReportRes.data);
      setReviewKpis({
        pendingReview: reviewStatsRes.data?.pendingReview || 0,
        approved: reviewStatsRes.data?.approved || 0,
        rejected: reviewStatsRes.data?.rejected || 0
      });
      setDatasets(datasetsRes.data || []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err.response?.data?.error || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = (dataset) => {
    setSelectedDataset(dataset);
    setReviewForm({ status: "", feedback: "" });
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewForm.status || !reviewForm.feedback.trim()) {
      alert("Please select an action and provide feedback");
      return;
    }

    try {
        const datasetId = selectedDataset.image_id || selectedDataset.id;

        if (!datasetId) {
          alert('Missing dataset id for review.');
          return;
        }
      await axios.put(
        `http://localhost:5000/api/dashboard/melbourne/datasets/${datasetId}/review`,
        {
          status: reviewForm.status,
          feedback: reviewForm.feedback
        },
        { headers: getAuthHeader() }
      );

      alert(`Dataset ${reviewForm.status === "approved" ? "approved" : "rejected"} successfully`);
      setShowReviewModal(false);
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to submit review");
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
          <div className="kpi-card">
            <div className="kpi-value">{reviewKpis.approved}</div>
            <div className="kpi-label">Your Approvals</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{reviewKpis.rejected}</div>
            <div className="kpi-label">Your Rejections</div>
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

        {/* Datasets Table */}
        <div className="reports-section">
          <h3>Datasets Pending Your Review</h3>
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>DATASET ID</th>
                  <th>IMAGE NAME</th>
                  <th>ANNOTATOR</th>
                  <th>TESTER</th>
                  <th>OBJECTS</th>
                  <th>DATE</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {datasets.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No datasets pending review
                    </td>
                  </tr>
                ) : (
                  datasets.map((dataset) => (
                    <tr key={dataset.image_id || dataset.id}>
                      <td>#{dataset.image_id || dataset.id}</td>
                      <td>{dataset.image_name || "N/A"}</td>
                      <td>{dataset.annotator_name || "N/A"}</td>
                      <td>{dataset.tester_name || "N/A"}</td>
                      <td>{dataset.objects_count || 0}</td>
                      <td>{dataset.created_at ? new Date(dataset.created_at).toLocaleDateString() : "N/A"}</td>
                      <td>
                        <button
                          className="action-btn"
                          onClick={() => handleReviewClick(dataset)}
                        >
                          Review & Update
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Review Modal */}
        {showReviewModal && selectedDataset && (
          <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Review Dataset #{selectedDataset.image_id}</h2>

              <div className="modal-info">
                <p><strong>Dataset ID:</strong> #{selectedDataset.image_id || selectedDataset.id}</p>
                <p><strong>Image Name:</strong> {selectedDataset.image_name || "N/A"}</p>
                <p><strong>Annotator:</strong> {selectedDataset.annotator_name || "N/A"}</p>
                <p><strong>Tester:</strong> {selectedDataset.tester_name || "N/A"}</p>
                <p><strong>Objects Count:</strong> {selectedDataset.objects_count || 0}</p>
                {selectedDataset.tester_feedback && (
                  <p><strong>Tester Feedback:</strong> {selectedDataset.tester_feedback}</p>
                )}
              </div>

              <div className="status-options">
                <label className={`radio-label ${reviewForm.status === "approved" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="status"
                    value="approved"
                    checked={reviewForm.status === "approved"}
                    onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                  />
                  <span>✓ Approve Dataset</span>
                </label>

                <label className={`radio-label ${reviewForm.status === "rejected" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="status"
                    value="rejected"
                    checked={reviewForm.status === "rejected"}
                    onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                  />
                  <span>✗ Reject Dataset</span>
                </label>
              </div>

              <div className="form-group">
                <label>Feedback *</label>
                <textarea
                  value={reviewForm.feedback}
                  onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                  placeholder="Provide detailed feedback for your decision..."
                  rows={4}
                  required
                />
              </div>

              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setShowReviewModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn-save"
                  onClick={handleSubmitReview}
                  disabled={!reviewForm.status || !reviewForm.feedback.trim()}
                >
                  Submit Review
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
