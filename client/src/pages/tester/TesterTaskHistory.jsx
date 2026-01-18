import { useState, useEffect } from "react";
import axios from "axios";
import TesterSidebar from "./TesterSidebar";
import "../annotator/annotator.css";

export default function TesterTaskHistory() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchTaskHistory();
  }, []);

  const fetchTaskHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://localhost:5000/api/dashboard/tester/task-history",
        { headers: getAuthHeader() }
      );
      setTasks(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load task history");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: "Pending",
      pending_review: "Pending Review",
      completed: "Completed",
      approved: "Approved",
      rejected: "Rejected",
    };
    return (
      <span className={`status-badge status-${status?.replace("_", "-")}`}>
        {statusMap[status] || status}
      </span>
    );
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return true;
    return task.status === filter;
  });

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <div className="dashboard-container">
      <TesterSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Task History</h1>
          <div className="header-date">{new Date().toLocaleDateString()}</div>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="filter-section">
          <label>Filter by Status:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Tasks</option>
            <option value="pending">Pending</option>
            <option value="pending_review">Pending Review</option>
            <option value="completed">Completed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="tasks-section">
          <h2>All Tasks ({filteredTasks.length})</h2>
          <div className="table-container">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>TASK ID</th>
                  <th>IMAGE NAME</th>
                  <th>STATUS</th>
                  <th>ASSIGNED DATE</th>
                  <th>COMPLETED DATE</th>
                  <th>ASSIGNED BY</th>
                  <th>FEEDBACK</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No tasks found
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.task_id}</td>
                      <td>
                        <div className="task-image-col">{task.image_name}</div>
                      </td>
                      <td>{getStatusBadge(task.status)}</td>
                      <td>
                        {task.assigned_date
                          ? new Date(task.assigned_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>
                        {task.completed_date
                          ? new Date(task.completed_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>{task.assigned_by_name || "-"}</td>
                      <td>
                        {task.notes ? (
                          <div className="feedback-cell" title={task.notes}>
                            {task.notes.length > 50
                              ? task.notes.substring(0, 50) + "..."
                              : task.notes}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="summary-section">
          <div className="summary-card">
            <div className="summary-label">Total Tasks</div>
            <div className="summary-value">{tasks.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Approved</div>
            <div className="summary-value">
              {tasks.filter((t) => t.status === "approved").length}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Rejected</div>
            <div className="summary-value">
              {tasks.filter((t) => t.status === "rejected").length}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Pending</div>
            <div className="summary-value">
              {
                tasks.filter(
                  (t) => t.status === "pending" || t.status === "pending_review"
                ).length
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
