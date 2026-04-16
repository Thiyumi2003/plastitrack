import { useState, useEffect } from "react";
import axios from "axios";
import { Calendar, Clock, CheckCircle, XCircle, DollarSign } from "lucide-react";
import { showAppConfirm } from "../../utils/appMessages";
import "./superadmin.css";

export default function ManageAdminWorkHours() {
  const [workHours, setWorkHours] = useState([]);
  const [adminSummary, setAdminSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("entries");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    console.log("ManageAdminWorkHours component mounted");
    fetchWorkHours();
  }, []);

  const fetchWorkHours = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axios.get(
        "http://localhost:5000/api/dashboard/superadmin/work-hours",
        { headers: getAuthHeader() }
      );
      console.log("Work hours response:", response.data);
      setWorkHours(response.data.workHours || []);
      setAdminSummary(response.data.adminSummary || []);
    } catch (err) {
      console.error("Fetch work hours error:", err);
      setError(err.response?.data?.error || "Failed to load work hours. Please try logging in again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    const confirmMsg = status === "approved" 
      ? "Approve this work hours entry?"
      : "Reject this work hours entry?";

    if (!(await showAppConfirm(confirmMsg, { confirmText: status === "approved" ? "Approve" : "Reject", tone: status === "approved" ? "warning" : "danger" }))) return;

    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/superadmin/work-hours/${id}/status`,
        { status },
        { headers: getAuthHeader() }
      );
      fetchWorkHours();
      alert(`Work hours ${status}`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update status");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: <Clock size={14} />, className: "status-pending", text: "Pending" },
      approved: { icon: <CheckCircle size={14} />, className: "status-approved", text: "Approved" },
      rejected: { icon: <XCircle size={14} />, className: "status-rejected", text: "Rejected" },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`status-badge ${badge.className}`}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  // Ensure adminSummary is an array
  const adminSummaryArray = Array.isArray(adminSummary) ? adminSummary : [];
  const totalPaymentDue = adminSummaryArray.reduce((sum, admin) => sum + (Number(admin.total_payment_due) || 0), 0);

  return (
    <>
      <div className="dashboard-header">
        <h1>Admin Work Hours Management</h1>
      </div>

      {error && <div className="dashboard-error">{error}</div>}
      {loading && <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: 16 }}>Loading admin work hours...</div>}

        {/* Summary Cards */}
        <div className="payment-cards-section">
          <div className="payment-card">
            <div className="payment-icon">⏱️</div>
            <div className="payment-content">
              <div className="payment-value">
                {adminSummaryArray.reduce((sum, a) => sum + (Number(a.total_hours) || 0), 0).toFixed(1)}
              </div>
              <div className="payment-label">Total Hours Logged</div>
            </div>
          </div>

          <div className="payment-card">
            <div className="payment-icon">✅</div>
            <div className="payment-content">
              <div className="payment-value">
                {adminSummaryArray.reduce((sum, a) => sum + (Number(a.approved_hours) || 0), 0).toFixed(1)}
              </div>
              <div className="payment-label">Approved Hours</div>
            </div>
          </div>

          <div className="payment-card">
            <div className="payment-icon">💰</div>
            <div className="payment-content">
              <div className="payment-value">₨ {totalPaymentDue.toLocaleString()}</div>
              <div className="payment-label">Total Payment Due</div>
            </div>
          </div>

          <div className="payment-card">
            <div className="payment-icon">⏳</div>
            <div className="payment-content">
              <div className="payment-value">
                {Array.isArray(workHours) ? workHours.filter(w => w.status === 'pending').length : 0}
              </div>
              <div className="payment-label">Pending Approvals</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-section">
          <div className="tabs">
            <button
              className={`tab ${activeTab === "entries" ? "active" : ""}`}
              onClick={() => setActiveTab("entries")}
            >
              Work Hours Entries
            </button>
            <button
              className={`tab ${activeTab === "summary" ? "active" : ""}`}
              onClick={() => setActiveTab("summary")}
            >
              Admin Summary
            </button>
          </div>
        </div>

        {/* Work Hours Entries Tab */}
        {activeTab === "entries" && (
          <div className="table-container">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Date</th>
                  <th>Hours</th>
                  <th>Hourly Rate</th>
                  <th>Type</th>
                  <th>Task Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!Array.isArray(workHours) || workHours.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="no-data">
                      No work hours entries yet
                    </td>
                  </tr>
                ) : (
                  workHours.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div>
                          <strong>{entry.admin_name}</strong>
                          <br />
                          <small style={{ color: "#666" }}>{entry.admin_email}</small>
                        </div>
                      </td>
                      <td>
                        <Calendar size={16} style={{ marginRight: "8px", verticalAlign: "middle" }} />
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td><strong>{entry.hours_worked}</strong> hrs</td>
                      <td>₨ {(entry.hourly_rate || 0).toLocaleString()}</td>
                      <td>
                        {entry.is_auto_tracked ? (
                          <span style={{ 
                            fontSize: "12px",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            backgroundColor: "#dbeafe",
                            color: "#1e40af",
                            border: "1px solid #93c5fd"
                          }}>
                            Auto
                          </span>
                        ) : (
                          <span style={{ 
                            fontSize: "12px",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            backgroundColor: "#fef3c7",
                            color: "#92400e",
                            border: "1px solid #fcd34d"
                          }}>
                            Manual
                          </span>
                        )}
                      </td>
                      <td style={{ maxWidth: "250px" }}>
                        {entry.task_description || <span style={{ color: "#999" }}>-</span>}
                      </td>
                      <td>
                        <strong>₨ {(entry.calculated_payment || 0).toLocaleString()}</strong>
                      </td>
                      <td>{getStatusBadge(entry.status)}</td>
                      <td>
                        {entry.status === "pending" && (
                          <div style={{ display: "flex", gap: "5px" }}>
                            <button
                              className="btn-approve"
                              title="Approve"
                              onClick={() => handleStatusChange(entry.id, "approved")}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#10b981",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px"
                              }}
                            >
                              ✓ Approve
                            </button>
                            <button
                              className="btn-reject"
                              title="Reject"
                              onClick={() => handleStatusChange(entry.id, "rejected")}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#ef4444",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px"
                              }}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        )}
                        {entry.status === "approved" && (
                          <span style={{ color: "#10b981", fontSize: "12px" }}>
                            ✓ By {entry.approved_by_name}
                          </span>
                        )}
                        {entry.status === "rejected" && (
                          <span style={{ color: "#ef4444", fontSize: "12px" }}>
                            ✕ By {entry.approved_by_name}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Admin Summary Tab */}
        {activeTab === "summary" && (
          <div className="table-container">
            <h3>Payment Summary by Admin</h3>
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Admin Name</th>
                  <th>Email</th>
                  <th>Hourly Rate</th>
                  <th>Total Hours</th>
                  <th>Approved Hours</th>
                  <th>Total Payment Due</th>
                </tr>
              </thead>
              <tbody>
                {!Array.isArray(adminSummaryArray) || adminSummaryArray.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="no-data">
                      No admin work hours data
                    </td>
                  </tr>
                ) : (
                  adminSummaryArray.map((admin) => (
                    <tr key={admin.id}>
                      <td><strong>{admin.name}</strong></td>
                      <td>{admin.email}</td>
                      <td>₨ {(admin.hourly_rate || 0).toLocaleString()}</td>
                      <td>{(admin.total_hours || 0).toFixed(1)} hrs</td>
                      <td>{(admin.approved_hours || 0).toFixed(1)} hrs</td>
                      <td>
                        <strong style={{ color: "#10b981", fontSize: "16px" }}>
                          ₨ {(admin.total_payment_due || 0).toLocaleString()}
                        </strong>
                      </td>
                    </tr>
                  ))
                )}
                {adminSummaryArray.length > 0 && (
                  <tr style={{ backgroundColor: "#f8f9fa", fontWeight: "bold" }}>
                    <td colSpan="3" style={{ textAlign: "right" }}>TOTAL:</td>
                    <td>{adminSummaryArray.reduce((sum, a) => sum + (Number(a.total_hours) || 0), 0).toFixed(1)} hrs</td>
                    <td>{adminSummaryArray.reduce((sum, a) => sum + (Number(a.approved_hours) || 0), 0).toFixed(1)} hrs</td>
                    <td style={{ color: "#10b981", fontSize: "18px" }}>
                      ₨ {totalPaymentDue.toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
