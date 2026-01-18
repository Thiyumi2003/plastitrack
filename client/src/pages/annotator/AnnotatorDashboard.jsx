import { useState, useEffect } from "react";
import axios from "axios";
import AnnotatorSidebar from "./AnnotatorSidebar";
import "./annotator.css";

export default function AnnotatorDashboard() {
  const [kpis, setKpis] = useState(null);
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
      const [kpisRes, tasksRes] = await Promise.all([
        axios.get("http://localhost:5000/api/dashboard/annotator/kpis", {
          headers: getAuthHeader(),
        }),
        axios.get("http://localhost:5000/api/dashboard/annotator/tasks", {
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

  return (
    <div className="dashboard-container">
      <AnnotatorSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Welcome back, {JSON.parse(localStorage.getItem("user") || "{}").name}! 👋</h1>
          <div className="header-date">{new Date().toLocaleDateString()}</div>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="kpi-section">
          <div className="kpi-card">
            <div className="kpi-icon">⏱️</div>
            <div className="kpi-value">{kpis?.assignedImages || 0}</div>
            <div className="kpi-label">Assigned Images</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">👁️</div>
            <div className="kpi-value">{kpis?.inProgress || 0}</div>
            <div className="kpi-label">In Progress</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">✓</div>
            <div className="kpi-value">{kpis?.completed || 0}</div>
            <div className="kpi-label">Completed</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">⏳</div>
            <div className="kpi-value">{kpis?.pendingReview || 0}</div>
            <div className="kpi-label">Pending Review</div>
          </div>
        </div>

        <div className="tasks-section">
          <h2>Your Tasks</h2>
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
                        Review & Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showStatusModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Task Status</h2>

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
                <span>Completed</span>
                <small>Task is finished</small>
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
              />
              <small>Optional: Add comments about quality, issues, etc.</small>
            </div>

            <div className="important-box">
              <strong>⚠️ Important</strong>
              <ul>
                <li>Review the image carefully before updating status</li>
                <li>Annotations are done by internal system</li>
                <li>Your updates will be tracked in history</li>
                <li>Add notes for quality issues</li>
              </ul>
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
              <button className="btn-update" onClick={handleUpdateStatus}>
                ✓ Update Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
