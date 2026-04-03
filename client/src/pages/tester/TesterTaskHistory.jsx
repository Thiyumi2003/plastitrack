import { useState, useEffect } from "react";
import axios from "axios";
import { RefreshCw } from "lucide-react";
import "../annotator/annotator.css";

export default function TesterTaskHistory() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const matchesStatusFilter = (task) => {
    if (statusFilter === "all") {
      return true;
    }

    if (statusFilter === "pending_review") {
      return task.status === "pending_review";
    }

    if (statusFilter === "approved") {
      return task.status === "approved";
    }

    if (statusFilter === "rejected") {
      return task.status === "rejected";
    }

    return true;
  };

  const visibleTasks = tasks.filter(matchesStatusFilter);

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

      const url = `http://localhost:5000/api/dashboard/tester/task-history${params.toString() ? "?" + params.toString() : ""}`;
      const response = await axios.get(url, { headers: getAuthHeader() });
      setTasks(response.data);
      setError("");
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
      approved: "Approved",
      rejected: "Rejected",
    };
    return (
      <span className={`status-badge status-${status?.replace("_", "-")}`}>
        {statusMap[status] || status}
      </span>
    );
  };

  const handleResetFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h1>Task History</h1>
        <div className="header-date">{new Date().toLocaleDateString()}</div>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

        <div
          className="filter-section tester-task-history-filters"
          style={{
            background: "transparent",
            border: "none",
            boxShadow: "none",
            backdropFilter: "none",
          }}
        >
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Tasks</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
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

        <div className="tasks-section">
          <h2>{statusFilter === "all" ? "All Tasks" : `${statusFilter === "pending_review" ? "Pending Review" : statusFilter === "approved" ? "Approved" : "Rejected"} Tasks`} ({visibleTasks.length})</h2>
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
                {visibleTasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No tasks found
                    </td>
                  </tr>
                ) : (
                  visibleTasks.map((task) => (
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
          <div className="summary-value">{visibleTasks.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Approved</div>
          <div className="summary-value">
            {visibleTasks.filter((t) => t.status === "approved").length}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Rejected</div>
          <div className="summary-value">
            {visibleTasks.filter((t) => t.status === "rejected").length}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Pending</div>
          <div className="summary-value">
            {visibleTasks.filter((t) => t.status === "pending_review").length}
          </div>
        </div>
      </div>
    </>
  );
}
