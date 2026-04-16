import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Calendar, Clock, Plus, Trash2, CheckCircle, XCircle, Zap, ZapOff } from "lucide-react";
import { showAppConfirm } from "../../utils/appMessages";
import "./admin.css";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const parseHoursInputToMinutes = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (raw.includes(":")) {
    const parts = raw.split(":");
    if (parts.length !== 2) return null;

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || minutes < 0 || minutes >= 60) return null;

    return hours * 60 + minutes;
  }

  // Support HH.MM-style input (e.g., 1.30 => 1h 30m, 0.70 => 1h 10m).
  // Only two-digit fractions are treated as minute notation.
  const dotMatch = raw.match(/^(\d+)\.(\d{2})$/);
  if (dotMatch) {
    const hours = Number(dotMatch[1]);
    const minutes = Number(dotMatch[2]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || minutes < 0) return null;
    return hours * 60 + minutes;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed * 60) : null;
};

const formatMinutes = (value) => {
  const totalMinutes = Math.max(0, Math.round(Number(value || 0)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

export default function AdminWorkHours() {
  const [workHours, setWorkHours] = useState([]);
  const [summary, setSummary] = useState({});
  const [currentSession, setCurrentSession] = useState(null);
  const [autoTrackEnabled, setAutoTrackEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    hours_worked: "",
    task_description: "",
  });

  const lastActivityRef = useRef(Date.now());
  const lastActivityPingRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const idleIntervalRef = useRef(null);
  const trackingStateRef = useRef("paused");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    let unmounted = false;

    const loadPageData = async () => {
      await fetchWorkHours();
    };

    loadPageData();

    return () => {
      unmounted = true;
    };
  }, []);

  const startWorkSession = async () => {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/work-sessions/start`,
        {},
        { headers: getAuthHeader() }
      );
      trackingStateRef.current = "active";
      await fetchWorkHours();
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  };

  const pauseWorkSession = async () => {
    if (trackingStateRef.current !== "active") return;
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/work-sessions/pause`,
        {},
        { headers: getAuthHeader() }
      );
      trackingStateRef.current = "paused";
      await fetchWorkHours();
    } catch (err) {
      console.error("Failed to pause session:", err);
    }
  };

  const sendHeartbeat = async ({ userActive = false, forcePause = false } = {}) => {
    if (!autoTrackEnabled) return;
    const tabVisible = document.visibilityState === "visible";
    const pageOpen = true;

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/work-sessions/heartbeat`,
        {
          user_active: userActive,
          tab_visible: tabVisible,
          page_open: pageOpen,
          pause: forcePause,
        },
        { headers: getAuthHeader() }
      );

      if (response?.data?.paused) {
        trackingStateRef.current = "paused";
      } else {
        trackingStateRef.current = "active";
      }

      if ((response?.data?.tracked_minutes_added || 0) > 0 || forcePause) {
        await fetchWorkHours();
      }
    } catch (err) {
      console.error("Heartbeat failed:", err);
    }
  };

  const fetchWorkHours = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/work-hours`,
        { headers: getAuthHeader() }
      );
      setWorkHours(response.data.workHours);
      setSummary(response.data.summary);
      setCurrentSession(response.data.currentSession || null);
      setAutoTrackEnabled(Boolean(response.data.auto_track_hours));
      if (response.data.currentSession?.status === "active") {
        trackingStateRef.current = "active";
      } else {
        trackingStateRef.current = "paused";
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load work hours");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      if (!autoTrackEnabled || document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastActivityPingRef.current > 30000) {
        lastActivityPingRef.current = now;
        startWorkSession();
        sendHeartbeat({ userActive: true });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendHeartbeat({ forcePause: true });
        return;
      }

      lastActivityRef.current = Date.now();
    };

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("pointerdown", onActivity);
    document.addEventListener("visibilitychange", onVisibilityChange);

    heartbeatIntervalRef.current = setInterval(() => {
      if (!autoTrackEnabled) return;
      sendHeartbeat({ userActive: false });
    }, 60000);

    idleIntervalRef.current = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= IDLE_TIMEOUT_MS || document.visibilityState !== "visible") {
        sendHeartbeat({ forcePause: true });
      }
    }, 30000);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (idleIntervalRef.current) clearInterval(idleIntervalRef.current);
      pauseWorkSession();
    };
  }, [autoTrackEnabled]);



  const toggleAutoTracking = async () => {
    try {
      const newStatus = !autoTrackEnabled;
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/toggle-auto-tracking`,
        { auto_track_hours: newStatus },
        { headers: getAuthHeader() }
      );
      setAutoTrackEnabled(newStatus);
      if (!newStatus) {
        await pauseWorkSession();
      } else {
        lastActivityRef.current = Date.now();
      }
      alert(`Auto-tracking ${newStatus ? "enabled" : "disabled"}`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to toggle auto-tracking");
    }
  };

  const handleSubmit = async () => {
    const parsedMinutes = parseHoursInputToMinutes(formData.hours_worked);

    if (!formData.date || parsedMinutes === null) {
      alert("Date and worked time are required (e.g., 8, 8.5, or 8:30)");
      return;
    }

    if (parsedMinutes <= 0 || parsedMinutes > (24 * 60)) {
      alert("Hours must be between 0 and 24");
      return;
    }

    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/work-hours`,
        {
          ...formData,
          hours_worked: Number((parsedMinutes / 60).toFixed(2)),
        },
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
    if (!(await showAppConfirm("Are you sure you want to delete this entry?", { confirmText: "Delete", tone: "danger" }))) return;

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/work-hours/${id}`,
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

  return (
    <>
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
        {loading && <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: 16 }}>Loading work hours...</div>}

        {/* Info Banner */}
        {autoTrackEnabled && (
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#dbeafe", borderRadius: "8px", borderLeft: "4px solid #3b82f6" }}>
            <strong>🚀 Auto-Tracking Enabled!</strong>
            <p style={{ margin: "5px 0 0 0", fontSize: "14px" }}>Only active minutes are tracked. Tracking pauses after 5 minutes of idle time or when the tab is hidden.</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="kpi-section">
          <div className="kpi-card">
            <div className="kpi-value">{formatMinutes(summary.pending_minutes || 0)}</div>
            <div className="kpi-label">Pending Hours</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{formatMinutes(summary.approved_minutes || 0)}</div>
            <div className="kpi-label">Approved Hours</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">{formatMinutes(summary.paid_minutes || 0)}</div>
            <div className="kpi-label">Paid Hours</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">
              {currentSession?.status === "active"
                ? formatMinutes(currentSession.active_minutes || 0)
                : "Paused"}
            </div>
            <div className="kpi-label">Current Active Session</div>
          </div>
        </div>

        {/* Work Hours Table */}
        <div className="table-container">
          <h2>Work Hours Log</h2>
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tracked Time</th>
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
                      No work hours logged yet. {autoTrackEnabled ? "Only active usage is tracked." : "Click 'Log Manual Hours' to get started."}
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
                        <strong>{formatMinutes(entry.minutes_worked || 0)}</strong>
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

        <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "8px", borderLeft: "4px solid #667eea" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>ℹ️ About Work Hours Tracking</h3>
          <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.8" }}>
            <li><strong>Auto Mode:</strong> Tracking runs automatically when Auto-Tracking is ON.</li>
            <li><strong>Active Work Only:</strong> Time is counted only during real activity (mousemove, click, keydown, scroll, pointer interaction).</li>
            <li><strong>Idle Protection:</strong> Tracking pauses after 5 minutes of inactivity or when the tab is hidden.</li>
            <li><strong>No Manual Session Buttons:</strong> Start/Pause/Resume/Stop buttons were removed; activity controls tracking.</li>
            <li><strong>Logout Save Rule:</strong> On logout, active tracked time is finalized and appears in Work Hours when tracked time reaches at least 5 minutes.</li>
            <li><strong>Manual Entry:</strong> You can still log manual hours for offline/admin tasks.</li>
            <li><strong>Approval & Locking:</strong> Approved/Paid values are locked; auto-tracking does not overwrite them.</li>
          </ul>
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
              <label>Worked Time</label>
              <input
                type="text"
                value={formData.hours_worked}
                onChange={(e) => setFormData({ ...formData, hours_worked: e.target.value })}
                placeholder="e.g., 8, 8.5, or 8:30"
              />
              <small style={{ color: "#666", display: "block", marginTop: "5px" }}>
                Enter decimal hours or HH:MM format (0:15 to 24:00)
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
    </>
  );
}
