import { useState, useEffect } from "react";
import axios from "axios";
import AnnotatorSidebar from "./AnnotatorSidebar";
import "./annotator.css";

export default function AnnotatorTaskHistory() {
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
        "http://localhost:5000/api/dashboard/annotator/task-history",
        { headers: getAuthHeader() }
      );
      setTasks(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load task history");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  const filteredTasks =
    filter === "all"
      ? tasks
      : tasks.filter((t) => t.status === filter);

  return (
    <div className="dashboard-container">
      <AnnotatorSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Task History</h1>
          <p>View all your completed and assigned tasks</p>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="filter-section">
          <button
            className={`filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Tasks
          </button>
          <button
            className={`filter-btn ${filter === "completed" ? "active" : ""}`}
            onClick={() => setFilter("completed")}
          >
            Completed
          </button>
          <button
            className={`filter-btn ${filter === "in_progress" ? "active" : ""}`}
            onClick={() => setFilter("in_progress")}
          >
            In Progress
          </button>
          <button
            className={`filter-btn ${filter === "pending_review" ? "active" : ""}`}
            onClick={() => setFilter("pending_review")}
          >
            Pending Review
          </button>
        </div>

        <div className="table-container">
          <table className="tasks-table">
            <thead>
              <tr>
                <th>IMAGE</th>
                <th>TASK ID</th>
                <th>STATUS</th>
                <th>ASSIGNED DATE</th>
                <th>COMPLETED DATE</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.image_name}</td>
                    <td>{task.task_id}</td>
                    <td>
                      <span
                        className={`status-badge status-${task.status?.replace(
                          "_",
                          "-"
                        )}`}
                      >
                        {task.status === "in_progress"
                          ? "In Progress"
                          : task.status === "pending_review"
                          ? "Pending Review"
                          : task.status?.charAt(0).toUpperCase() +
                            task.status?.slice(1)}
                      </span>
                    </td>
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-data">
                    No tasks found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
