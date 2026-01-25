import { useState, useEffect } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import "./admin.css";

export default function PaymentEligibility() {
  const [report, setReport] = useState({ tasks: [], imageGroups: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://localhost:5000/api/dashboard/admin/payment-eligibility",
        { headers: getAuthHeader() }
      );
      setReport(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load payment eligibility report");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>💰 Payment Eligibility Report</h1>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "8px" }}>
            Track which annotators are eligible for payment based on task completion and rejection history
          </p>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="info-box" style={{ 
          background: "#e3f2fd", 
          border: "1px solid #2196f3", 
          padding: "15px", 
          borderRadius: "8px",
          marginBottom: "20px"
        }}>
          <h3 style={{ margin: "0 0 10px 0", color: "#1976d2" }}>📋 Payment Fairness Policy</h3>
          <p style={{ margin: "5px 0", fontSize: "14px" }}>
            ✅ <strong>Eligible for Payment:</strong> Annotators whose work was accepted or is currently being reviewed
          </p>
          <p style={{ margin: "5px 0", fontSize: "14px" }}>
            ❌ <strong>Not Eligible for Payment:</strong> Annotators whose work was rejected and the task was reassigned to someone else
          </p>
          <p style={{ margin: "5px 0", fontSize: "14px", fontStyle: "italic", color: "#666" }}>
            When an image set is rejected and reassigned, only the annotator who successfully completes the work receives payment.
          </p>
        </div>

        {report.imageGroups && report.imageGroups.length > 0 ? (
          report.imageGroups.map((group) => (
            <div key={group.image_id} className="image-group-card" style={{
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "20px"
            }}>
              <h3 style={{ margin: "0 0 15px 0", color: "#333" }}>
                🖼️ {group.image_name}
                <span style={{ 
                  marginLeft: "10px", 
                  fontSize: "14px", 
                  color: "#666",
                  fontWeight: "normal"
                }}>
                  (ID: {group.image_id})
                </span>
              </h3>

              {group.assignments.length > 1 && (
                <div style={{
                  background: "#fff3cd",
                  border: "1px solid #ffc107",
                  borderRadius: "6px",
                  padding: "10px",
                  marginBottom: "15px",
                  fontSize: "13px"
                }}>
                  ⚠️ This image has been assigned <strong>{group.assignments.length} times</strong> (indicates rejection/reassignment)
                </div>
              )}

              <table className="tasks-table">
                <thead>
                  <tr>
                    <th>Annotator</th>
                    <th>Status</th>
                    <th>Assigned Date</th>
                    <th>Completed Date</th>
                    <th>Assigned By</th>
                    <th>Payment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.assignments.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <strong>{task.annotator_name}</strong>
                        <br />
                        <small style={{ color: "#666" }}>{task.annotator_email}</small>
                      </td>
                      <td>
                        <span className={`status-badge status-${task.status?.replace("_", "-")}`}>
                          {task.status === "in_progress"
                            ? "In Progress"
                            : task.status === "pending_review"
                            ? "Pending Review"
                            : task.status?.charAt(0).toUpperCase() + task.status?.slice(1)}
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
                      <td>{task.assigned_by_name || "-"}</td>
                      <td>
                        {task.eligible_for_payment ? (
                          <span style={{
                            background: "#4caf50",
                            color: "white",
                            padding: "4px 12px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}>
                            ✅ ELIGIBLE
                          </span>
                        ) : (
                          <span style={{
                            background: "#f44336",
                            color: "white",
                            padding: "4px 12px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}>
                            ❌ NOT ELIGIBLE
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        ) : (
          <div className="no-data">No task data available</div>
        )}
      </div>
    </div>
  );
}
