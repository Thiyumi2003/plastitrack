import { useState, useEffect } from "react";
import axios from "axios";
import TesterSidebar from "./TesterSidebar";
import "../annotator/annotator.css";

export default function TesterDashboard() {
  const [kpis, setKpis] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    status: "approved",
    feedback: "",
  });

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [kpisRes, tasksRes] = await Promise.all([
        axios.get("http://localhost:5000/api/dashboard/tester/dashboard", {
          headers: getAuthHeader(),
        }),
        axios.get("http://localhost:5000/api/dashboard/tester/tasks", {
          headers: getAuthHeader(),
        }),
      ]);
      setKpis(kpisRes.data);
      setTasks(tasksRes.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedTask) return;

    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/tester/tasks/${selectedTask.id}/review`,
        {
          status: reviewForm.status,
          feedback: reviewForm.feedback,
        },
        { headers: getAuthHeader() }
      );
      setShowReviewModal(false);
      setReviewForm({ status: "approved", feedback: "" });
      setSelectedTask(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to submit review");
    }
  };

  const openReviewModal = (task) => {
    setSelectedTask(task);
    setReviewForm({
      status: "approved",
      feedback: task.notes || "",
    });
    setShowReviewModal(true);
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <div className="dashboard-container">
      <TesterSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Welcome back, {JSON.parse(localStorage.getItem("user") || "{}").name}! 👋</h1>
          <div className="header-date">{new Date().toLocaleDateString()}</div>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="kpi-section">
          <div className="kpi-card">
            <div className="kpi-icon">✓</div>
            <div className="kpi-value">{kpis?.approvedToday || 0}</div>
            <div className="kpi-label">Approved Today</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">✕</div>
            <div className="kpi-value">{kpis?.rejectedToday || 0}</div>
            <div className="kpi-label">Rejected Today</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">⏳</div>
            <div className="kpi-value">{kpis?.pendingReviews || 0}</div>
            <div className="kpi-label">Pending Reviews</div>
          </div>
        </div>

        <div className="tasks-section">
          <h2>Pending Image Sets</h2>
          <div className="table-container">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>IMAGE NAME</th>
                  <th>TASK ID</th>
                  <th>STATUS</th>
                  <th>ASSIGNED DATE</th>
                  <th>ASSIGNED BY</th>
                  <th>FEEDBACK</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <div className="task-image-col">
                        {task.image_name}
                      </div>
                    </td>
                    <td>{task.task_id}</td>
                    <td>
                      <span
                        className={`status-badge status-${task.status?.replace("_", "-")}`}
                      >
                        {task.status === "approved"
                          ? "Approved"
                          : task.status === "rejected"
                          ? "Rejected"
                          : task.status?.charAt(0).toUpperCase() + task.status?.slice(1)}
                      </span>
                    </td>
                    <td>{task.assigned_date ? new Date(task.assigned_date).toLocaleDateString() : "-"}</td>
                    <td>{task.assigned_by_name || "-"}</td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={task.notes || ""}>
                      {task.notes ? (
                        <span style={{ color: "#666", fontSize: "13px" }}>{task.notes}</span>
                      ) : (
                        <span style={{ color: "#999" }}>-</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="action-btn"
                        onClick={() => openReviewModal(task)}
                      >
                        Start Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showReviewModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Status Update</h2>

            <div className="status-options">
              <label className="radio-label">
                <input
                  type="radio"
                  value="approved"
                  checked={reviewForm.status === "approved"}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, status: e.target.value })
                  }
                />
                <span>Approve</span>
                <small>Annotations are correct</small>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  value="rejected"
                  checked={reviewForm.status === "rejected"}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, status: e.target.value })
                  }
                />
                <span>Reject</span>
                <small>Needs corrections</small>
              </label>
            </div>

            <div className="form-group">
              <label>Feedback to Annotator</label>
              <textarea
                value={reviewForm.feedback}
                onChange={(e) =>
                  setReviewForm({ ...reviewForm, feedback: e.target.value })
                }
                placeholder="Provide detailed feedback for the annotator..."
                rows="4"
              />
              <small>Be specific about what needs improvement or what was done well</small>
            </div>

            <div className="important-box">
              <strong>⚠️ Review Guidelines</strong>
              <ul>
                <li>Check all objects are correctly labeled</li>
                <li>Verify bounding boxes are accurate</li>
                <li>Ensure confidence scores are reasonable</li>
                <li>Provide clear, constructive feedback</li>
                <li>Feedback will be sent to the annotator</li>
              </ul>
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedTask(null);
                }}
              >
                Cancel
              </button>
              <button className="btn-update" onClick={handleSubmitReview}>
                ✓ Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
