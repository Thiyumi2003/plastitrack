import { useState, useEffect } from "react";
import axios from "axios";
import AnnotatorSidebar from "./AnnotatorSidebar";
import "./annotator.css";

export default function TaskHistory() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const tasksRes = await axios.get(
        "http://localhost:5000/api/dashboard/annotator/tasks",
        { headers: getAuthHeader() }
      );
      // Filter only completed tasks
      const completedTasks = tasksRes.data.filter(
        (t) => t.status === "completed" || t.status === "pending_review"
      );
      setTasks(completedTasks);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load task history");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <div className="dashboard-container">
      <AnnotatorSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Task History</h1>
          <div className="header-date">{new Date().toLocaleDateString()}</div>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="tasks-section">
          <h2>📋 Completed Tasks</h2>
          <div className="table-container">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>IMAGE</th>
                  <th>TASK ID</th>
                  <th>STATUS</th>
                  <th>ASSIGNED DATE</th>
                  <th>COMPLETED DATE</th>
                  <th>ASSIGNED BY</th>
                  <th>NOTES</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No completed tasks yet
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <div className="task-image-col">{task.image_name}</div>
                      </td>
                      <td>{task.task_id}</td>
                      <td>
                        <span
                          className={`status-badge status-${task.status?.replace(
                            "_",
                            "-"
                          )}`}
                        >
                          {task.status === "pending_review"
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
                      <td>{task.assigned_by || "N/A"}</td>
                      <td className="notes-cell">{task.notes || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
