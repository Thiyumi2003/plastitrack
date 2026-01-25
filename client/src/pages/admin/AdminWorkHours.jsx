import { useState, useEffect } from "react";
import axios from "axios";
import { Calendar, Clock, Plus, Trash2, CheckCircle, XCircle, Zap, ZapOff } from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import "./admin.css";

export default function AdminWorkHours() {
  const [workHours, setWorkHours] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState({});
  const [autoTrackEnabled, setAutoTrackEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState("hours");
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    hours_worked: "",
    task_description: "",
  });

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchWorkHours();
    fetchSessions();
  }, []);

  const fetchWorkHours = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://localhost:5000/api/dashboard/admin/work-hours",
        { headers: getAuthHeader() }
      );
      setWorkHours(response.data.workHours);
      setSummary(response.data.summary);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load work hours");
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/dashboard/admin/sessions",
        { headers: getAuthHeader() }
      );
      setSessions(response.data.sessions);
      setAutoTrackEnabled(response.data.auto_track_hours);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    }
  };

  const toggleAutoTracking = async () => {
    try {
      const newStatus = !autoTrackEnabled;
      await axios.put(
        "http://localhost:5000/api/dashboard/admin/toggle-auto-tracking",
        { auto_track_hours: newStatus },
        { headers: getAuthHeader() }
      );
      setAutoTrackEnabled(newStatus);
      alert(`Auto-tracking ${newStatus ? "enabled" : "disabled"}`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to toggle auto-tracking");
    }
  };

  const handleSubmit = async () => {
    if (!formData.date || !formData.hours_worked) {
      alert("Date and hours worked are required");
      return;
    }

    if (formData.hours_worked < 0 || formData.hours_worked > 24) {
      alert("Hours must be between 0 and 24");
      return;
    }

    try {
      await axios.post(
        "http://localhost:5000/api/dashboard/admin/work-hours",
        formData,
        { headers: getAuthHeader() }
      );
      setShowAddModal(false);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        hours_worked: "",
        task_description: "",
      });
      fetchWorkHours();
      alert("Work hours logged successfully");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to log work hours");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      await axios.delete(
        `http://localhost:5000/api/dashboard/admin/work-hours/${id}`,
        { headers: getAuthHeader() }
      );
      fetchWorkHours();
      alert("Work hours entry deleted");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete entry");
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

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  const autoTrackedHours = workHours.filter(w => w.is_auto_tracked).reduce((sum, w) => sum + parseFloat(w.hours_worked || 0), 0);
  const manualHours = workHours.filter(w => !w.is_auto_tracked).reduce((sum, w) => sum + parseFloat(w.hours_worked || 0), 0);

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>My Work Hours</h1>
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              className={`btn-toggle-track ${autoTrackEnabled ? "active" : ""}`}
              onClick={toggleAutoTracking}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: autoTrackEnabled ? "#10b981" : "#6b7280",
                color: "white",
                fontWeight: "600",
                transition: "all 0.3s"
              }}
            >
              {autoTrackEnabled ? <Zap size={18} /> : <ZapOff size={18} />}
              {autoTrackEnabled ? "Auto-Tracking ON" : "Auto-Tracking OFF"}
            </button>
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={18} /> Log Manual Hours
            </button>
          </div>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        {/* Info Banner */}
        {autoTrackEnabled && (
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#dbeafe", borderRadius: "8px", borderLeft: "4px solid #3b82f6" }}>
            <strong>🚀 Auto-Tracking Enabled!</strong>
            <p style={{ margin: "5px 0 0 0", fontSize: "14px" }}>Your working hours are automatically tracked when you login and logout. No manual entry needed!</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="kpi-section">
          <div className="kpi-card">
            <div className="kpi-icon">⏱️</div>
            <div className="kpi-value">{summary.total_hours || 0}</div>
            <div className="kpi-label">Total Hours</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">⚡</div>
            <div className="kpi-value">{autoTrackedHours.toFixed(1)}</div>
            <div className="kpi-label">Auto-Tracked</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">✏️</div>
            <div className="kpi-value">{manualHours.toFixed(1)}</div>
            <div className="kpi-label">Manual Entry</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">✅</div>
            <div className="kpi-value">{summary.approved_hours || 0}</div>
            <div className="kpi-label">Approved Hours</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">⏳</div>
            <div className="kpi-value">{summary.pending_hours || 0}</div>
            <div className="kpi-label">Pending Hours</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-section" style={{ marginBottom: "20px" }}>
          <div className="tabs">
            <button
              className={`tab ${activeTab === "hours" ? "active" : ""}`}
              onClick={() => setActiveTab("hours")}
            >
              Work Hours Log
            </button>
            <button
              className={`tab ${activeTab === "sessions" ? "active" : ""}`}
              onClick={() => setActiveTab("sessions")}
            >
              Login Sessions ({sessions.length})
            </button>
          </div>
        </div>

        {/* Work Hours Table */}
        {activeTab === "hours" && (
          <div className="table-container">
            <h2>Work Hours Log</h2>
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Hours</th>
                  <th>Type</th>
                  <th>Task Description</th>
                  <th>Status</th>
                  <th>Approved By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workHours.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">
                      No work hours logged yet. {autoTrackEnabled ? "Your hours will be tracked automatically when you login/logout." : "Click 'Log Manual Hours' to get started."}
                    </td>
                  </tr>
                ) : (
                  workHours.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <Calendar size={16} style={{ marginRight: "8px", verticalAlign: "middle" }} />
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td>
                        <strong>{entry.hours_worked}</strong> hrs
                      </td>
                      <td>
                        {entry.is_auto_tracked ? (
                          <span style={{ 
                            padding: "4px 8px", 
                            borderRadius: "12px", 
                            backgroundColor: "#dbeafe", 
                            color: "#1e40af",
                            fontSize: "11px",
                            fontWeight: "600",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            <Zap size={12} /> Auto
                          </span>
                        ) : (
                          <span style={{ 
                            padding: "4px 8px", 
                            borderRadius: "12px", 
                            backgroundColor: "#f3f4f6", 
                            color: "#4b5563",
                            fontSize: "11px",
                            fontWeight: "600"
                          }}>
                            ✏️ Manual
                          </span>
                        )}
                      </td>
                      <td style={{ maxWidth: "300px" }}>
                        {entry.task_description || <span style={{ color: "#999" }}>-</span>}
                      </td>
                      <td>{getStatusBadge(entry.status)}</td>
                      <td>{entry.approved_by_name || "-"}</td>
                      <td>
                        {entry.status === "pending" && !entry.is_auto_tracked && (
                          <button
                            className="btn-delete"
                            title="Delete"
                            onClick={() => handleDelete(entry.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {entry.is_auto_tracked && (
                          <span style={{ fontSize: "11px", color: "#999" }}>Auto-tracked</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Sessions Table */}
        {activeTab === "sessions" && (
          <div className="table-container">
            <h2>Login/Logout Sessions</h2>
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>Login Time</th>
                  <th>Logout Time</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="no-data">
                      No sessions recorded yet
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id}>
                      <td>
                        <Clock size={14} style={{ marginRight: "8px", verticalAlign: "middle" }} />
                        {new Date(session.login_time).toLocaleString()}
                      </td>
                      <td>
                        {session.logout_time ? (
                          new Date(session.logout_time).toLocaleString()
                        ) : (
                          <span style={{ color: "#10b981", fontWeight: "600" }}>● Active</span>
                        )}
                      </td>
                      <td>
                        {session.session_duration ? (
                          <strong>{parseFloat(session.session_duration).toFixed(2)} hrs</strong>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        {session.is_processed ? (
                          <span style={{ 
                            padding: "4px 8px", 
                            borderRadius: "12px", 
                            backgroundColor: "#d1e7dd", 
                            color: "#0f5132",
                            fontSize: "11px",
                            fontWeight: "600"
                          }}>
                            ✓ Logged
                          </span>
                        ) : session.logout_time ? (
                          <span style={{ 
                            padding: "4px 8px", 
                            borderRadius: "12px", 
                            backgroundColor: "#fff3cd", 
                            color: "#856404",
                            fontSize: "11px",
                            fontWeight: "600"
                          }}>
                            ⏳ Pending
                          </span>
                        ) : (
                          <span style={{ color: "#999" }}>-</span>
                        )}
                      </td>
                      <td style={{ fontSize: "12px", color: "#666" }}>
                        {session.ip_address || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "8px", borderLeft: "4px solid #667eea" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>ℹ️ About Work Hours Tracking</h3>
          <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.8" }}>
            <li><strong>Auto-Tracking:</strong> When enabled, your hours are automatically logged based on login/logout times (minimum 15 minutes)</li>
            <li><strong>Manual Entry:</strong> You can also manually log hours for offline work or adjust entries</li>
            <li><strong>Approval:</strong> All hours (auto and manual) require Super Admin approval for payment eligibility</li>
            <li><strong>Editing:</strong> Auto-tracked entries cannot be deleted. Manual entries can be deleted if pending</li>
          </ul>
        </div>
      </div>

      {/* Add Work Hours Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Log Work Hours</h2>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="form-group">
              <label>Hours Worked</label>
              <input
                type="number"
                value={formData.hours_worked}
                onChange={(e) => setFormData({ ...formData, hours_worked: e.target.value })}
                placeholder="e.g., 8"
                min="0"
                max="24"
                step="0.5"
              />
              <small style={{ color: "#666", display: "block", marginTop: "5px" }}>
                Enter hours between 0 and 24
              </small>
            </div>

            <div className="form-group">
              <label>Task Description (Optional)</label>
              <textarea
                value={formData.task_description}
                onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
                placeholder="Describe what you worked on..."
                rows="4"
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ddd" }}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSubmit}>
                Log Hours
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
