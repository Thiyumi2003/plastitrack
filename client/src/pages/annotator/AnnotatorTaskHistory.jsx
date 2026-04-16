import { useState, useEffect } from "react";
import axios from "axios";
import { RefreshCw, MessageSquare, Eye } from "lucide-react";
import "./annotator.css";

export default function AnnotatorTaskHistory() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchTaskHistory();
  }, [statusFilter, dateFrom, dateTo]);

  const fetchTaskHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (dateFrom) {
        params.append("dateFrom", dateFrom);
      }
      if (dateTo) {
        params.append("dateTo", dateTo);
      }

      const url = `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/annotator/task-history${params.toString() ? "?" + params.toString() : ""}`;
      const response = await axios.get(url, { headers: getAuthHeader() });
      setTasks(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load task history");
    } finally {
      setLoading(false);
    }
  };

  const handleReworkTask = async (taskId) => {
    try {
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/annotator/tasks/${taskId}/rework`,
        { status: "in_progress" },
        { headers: getAuthHeader() }
      );
      fetchTaskHistory();
      alert("Task marked for reworking. You can continue annotation.");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update task");
    }
  };

  const openFeedbackModal = (task) => {
    setSelectedTask(task);
    setShowFeedbackModal(true);
  };

  const handleResetFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <>
      <div className="dashboard-header">
        <h1>Task History & Reviews</h1>
        <p>Track your completed work and tester feedback</p>
      </div>

      {error && <div className="dashboard-error">{error}</div>}
      {loading && <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: 16 }}>Loading task history...</div>}

      <div className="filter-section annotator-transparent-filter">
        <label>Status:</label>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Tasks</option>
          <option value="completed">Submitted</option>
          <option value="pending_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="in_progress">In Progress</option>
          <option value="pending">Pending</option>
        </select>

        <label style={{ marginLeft: "20px" }}>From Date:</label>
        <input
          type="date"
          className="filter-select"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />

        <label style={{ marginLeft: "20px" }}>To Date:</label>
        <input
          type="date"
          className="filter-select"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />

        <button className="filter-btn" onClick={handleResetFilters} style={{ marginLeft: "20px" }}>
          Reset Filters
        </button>
        <button className="filter-btn active" onClick={fetchTaskHistory} style={{ marginLeft: "10px" }}>
          <RefreshCw size={16} style={{ display: "inline", marginRight: "5px" }} /> Refresh
        </button>
      </div>

      <div className="table-container" style={{ overflowX: "auto" }}>
        <table className="tasks-table">
          <thead>
            <tr>
              <th>IMAGE SET</th>
              <th>TASK ID</th>
              <th>SUBMITTED</th>
              <th>TESTER</th>
              <th>REVIEW STATUS</th>
              <th>REVIEWED DATE</th>
              <th>FEEDBACK</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div className="task-image-col">{task.image_name}</div>
                  </td>
                  <td>{task.task_id}</td>
                  <td>
                    {task.completed_date
                      ? new Date(task.completed_date).toLocaleDateString()
                      : "-"}
                  </td>
                  <td>
                    {task.tester_name || (
                      <span style={{ color: "#999" }}>Not assigned</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-badge status-${
                        task.review_status === "pending"
                          ? "pending"
                          : task.review_status === "approved"
                          ? "approved"
                          : task.review_status === "rejected"
                          ? "rejected"
                          : "completed"
                      }`}
                    >
                      {task.review_status === "pending"
                        ? "Under Review"
                        : task.review_status === "approved"
                        ? "Approved"
                        : task.review_status === "rejected"
                        ? "Rejected"
                        : "Awaiting Review"}
                    </span>
                  </td>
                  <td>
                    {task.review_date
                      ? new Date(task.review_date).toLocaleDateString()
                      : "-"}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {task.feedback_comments ? (
                      <button
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#667eea",
                          fontSize: "16px",
                          padding: "4px",
                        }}
                        onClick={() => openFeedbackModal(task)}
                        title="View feedback"
                      >
                        <MessageSquare size={16} />
                      </button>
                    ) : (
                      <span style={{ color: "#999" }}>-</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {task.feedback_comments && (
                        <button
                          className="action-btn"
                          style={{
                            fontSize: "12px",
                            padding: "4px 8px",
                            backgroundColor: "rgba(102, 126, 234, 0.2)",
                          }}
                          onClick={() => openFeedbackModal(task)}
                        >
                          <Eye size={12} /> View
                        </button>
                      )}
                      {task.review_status === "rejected" && (
                        <button
                          className="action-btn"
                          style={{
                            fontSize: "12px",
                            padding: "4px 8px",
                            backgroundColor: "#667eea",
                          }}
                          onClick={() => handleReworkTask(task.id)}
                        >
                          <RefreshCw size={12} /> Rework
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="no-data">
                  No tasks found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && selectedTask && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "600px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2>Review Feedback</h2>
              <button
                onClick={() => setShowFeedbackModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#fff",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#999",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                IMAGE SET
              </label>
              <p style={{ margin: 0, color: "#fff", fontWeight: "600" }}>
                {selectedTask.image_name}
              </p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#999",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                TESTER
              </label>
              <p style={{ margin: 0, color: "#fff" }}>
                {selectedTask.tester_name || "-"}
              </p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#999",
                  fontSize: "12px",
                  marginBottom: "4px",
                }}
              >
                STATUS
              </label>
              <span
                className={`status-badge status-${
                  selectedTask.review_status === "approved"
                    ? "approved"
                    : "rejected"
                }`}
              >
                {selectedTask.review_status === "approved"
                  ? "Approved"
                  : "Rejected"}
              </span>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  color: "#999",
                  fontSize: "12px",
                  marginBottom: "8px",
                }}
              >
                FEEDBACK COMMENTS
              </label>
              <div
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: "8px",
                  padding: "16px",
                  color: "#fff",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  minHeight: "120px",
                }}
              >
                {selectedTask.feedback_comments || "No feedback provided"}
              </div>
            </div>

            {selectedTask.review_status === "rejected" && (
              <button
                className="action-btn"
                style={{
                  width: "100%",
                  backgroundColor: "#667eea",
                  padding: "12px 16px",
                  fontSize: "14px",
                }}
                onClick={() => {
                  handleReworkTask(selectedTask.id);
                  setShowFeedbackModal(false);
                }}
              >
                <RefreshCw size={16} style={{ marginRight: "8px" }} />
                Rework This Task
              </button>
            )}

            <button
              onClick={() => setShowFeedbackModal(false)}
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "12px 16px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#fff",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
