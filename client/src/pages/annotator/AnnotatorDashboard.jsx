import { useState, useEffect } from "react";
import axios from "axios";
import "./annotator.css";

export default function AnnotatorDashboard() {
  const [workflowStats, setWorkflowStats] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [statusForm, setStatusForm] = useState({
    status: "in_progress",
    notes: "",
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
      const [statsRes, reviewsRes, tasksRes] = await Promise.all([
        axios.get("http://localhost:5000/api/dashboard/annotator/workflow-stats", {
          headers: getAuthHeader(),
        }).catch(() => ({ data: { assigned: 0, inProgress: 0, underReview: 0, approved: 0, rejected: 0 } })),
        axios.get("http://localhost:5000/api/dashboard/annotator/recent-reviews", {
          headers: getAuthHeader(),
        }).catch(() => ({ data: [] })),
        axios.get("http://localhost:5000/api/dashboard/annotator/tasks", {
          headers: getAuthHeader(),
        }).catch(() => ({ data: [] })),
      ]);
      setWorkflowStats(statsRes.data);
      setRecentReviews(reviewsRes.data);
      setTasks(tasksRes.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedTask) return;

    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/annotator/tasks/${selectedTask.id}/status`,
        {
          status: statusForm.status,
          notes: statusForm.notes,
        },
        { headers: getAuthHeader() }
      );
      setShowStatusModal(false);
      setStatusForm({ status: "in_progress", notes: "" });
      setSelectedTask(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update status");
    }
  };

  const openStatusModal = (task) => {
    setSelectedTask(task);
    setStatusForm({
      status: task.status,
      notes: task.notes || "",
    });
    setShowStatusModal(true);
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  const activeTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress");

  return (
    <>
      <div className="dashboard-header">
        <h1>Welcome back, {JSON.parse(localStorage.getItem("user") || "{}").name}! </h1>
        <p>Track your work and tester reviews</p>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      {/* Workflow Status Cards */}
      <div className="kpi-section">
        <div className="kpi-card">
          <div className="kpi-value">{workflowStats?.assigned || 0}</div>
          <div className="kpi-label">Assigned Image Sets</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{workflowStats?.inProgress || 0}</div>
          <div className="kpi-label">In Progress</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{workflowStats?.underReview || 0}</div>
          <div className="kpi-label">Under Review</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-value" style={{ color: "#10b981" }}>{workflowStats?.approved || 0}</div>
          <div className="kpi-label">Approved</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #ef4444" }}>
          <div className="kpi-value" style={{ color: "#ef4444" }}>{workflowStats?.rejected || 0}</div>
          <div className="kpi-label">Rejected</div>
        </div>
      </div>

      {/* Recent Review Notifications */}
      {recentReviews.length > 0 && (
        <div style={{ marginBottom: "30px" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "16px" }}>Recent Review Notifications</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {recentReviews.slice(0, 3).map((review) => (
              <div
                key={review.id}
                style={{
                  backdrop: "blur(20px)",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  border: `1px solid ${
                    review.review_status === "approved"
                      ? "rgba(16, 185, 129, 0.3)"
                      : review.review_status === "rejected"
                      ? "rgba(239, 68, 68, 0.3)"
                      : "rgba(251, 146, 60, 0.3)"
                  }`,
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <div style={{ fontSize: "24px" }}>
                  {review.review_status === "approved" ? "✓" : review.review_status === "rejected" ? "✕" : "⏳"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 4px 0", color: "#fff", fontWeight: "600" }}>
                    <strong>{review.image_set_name}</strong>
                  </p>
                  <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.7)", fontSize: "0.9rem" }}>
                    Reviewed by {review.tester_name} on{" "}
                    {review.review_date
                      ? new Date(review.review_date).toLocaleDateString()
                      : "pending"}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      backgroundColor:
                        review.review_status === "approved"
                          ? "rgba(16, 185, 129, 0.2)"
                          : review.review_status === "rejected"
                          ? "rgba(239, 68, 68, 0.2)"
                          : "rgba(251, 146, 60, 0.2)",
                      color:
                        review.review_status === "approved"
                          ? "#6ee7b7"
                          : review.review_status === "rejected"
                          ? "#fca5a5"
                          : "#fca265",
                    }}
                  >
                    {review.review_status === "pending"
                      ? "Under Review"
                      : review.review_status.charAt(0).toUpperCase() +
                        review.review_status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Assigned Tasks */}
      <div className="tasks-section">
        <h2>📌 Assigned Images for You</h2>
        <div className="table-container">
          <table className="tasks-table">
            <thead>
              <tr>
                <th>IMAGE</th>
                <th>TASK ID</th>
                <th>STATUS</th>
                <th>ASSIGNED DATE</th>
                <th>ASSIGNED BY</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {activeTasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">
                    No assigned images currently
                  </td>
                </tr>
              ) : (
                activeTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <div className="task-image-col">{task.image_name}</div>
                    </td>
                    <td>{task.task_id}</td>
                    <td>
                      <span
                        className={`status-badge status-${task.status?.replace("_", "-")}`}
                      >
                        {task.status === "in_progress"
                          ? "In Progress"
                          : task.status === "pending_review"
                          ? "Pending Review"
                          : task.status?.charAt(0).toUpperCase() + task.status?.slice(1)}
                      </span>
                    </td>
                    <td>{task.assigned_date ? new Date(task.assigned_date).toLocaleDateString() : "-"}</td>
                    <td>{task.assigned_by}</td>
                    <td>
                      <button
                        className="action-btn"
                        onClick={() => openStatusModal(task)}
                      >
                        Update Status
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showStatusModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Update Task Status</h2>

            {selectedTask?.notes && (
              <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "rgba(16, 185, 129, 0.1)", borderRadius: "6px", borderLeft: "4px solid #10b981" }}>
                <strong style={{ display: "block", marginBottom: "8px", color: "#fff" }}>Previous Notes:</strong>
                <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.8)", whiteSpace: "pre-wrap" }}>{selectedTask.notes}</p>
              </div>
            )}

            <div className="status-options">
              <label className="radio-label">
                <input
                  type="radio"
                  value="in_progress"
                  checked={statusForm.status === "in_progress"}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, status: e.target.value })
                  }
                />
                <span>In Progress</span>
                <small>Currently being worked on</small>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  value="completed"
                  checked={statusForm.status === "completed"}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, status: e.target.value })
                  }
                />
                <span>Completed & Submit for Review</span>
                <small>Submission sent to tester for review</small>
              </label>
            </div>

            <div className="form-group">
              <label>Notes / Comments</label>
              <textarea
                value={statusForm.notes}
                onChange={(e) =>
                  setStatusForm({ ...statusForm, notes: e.target.value })
                }
                placeholder="Add any notes about this task..."
                rows="4"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  borderRadius: "6px",
                  padding: "10px",
                }}
              />
              <small>Optional: Add comments about quality, issues, annotations, etc.</small>
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedTask(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleUpdateStatus}
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
