import { useState, useEffect } from "react";
import axios from "axios";
import { Bell, X, Check } from "lucide-react";
import "./notifications.css";

export default function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/dashboard/notifications",
        { headers: getAuthHeader() }
      );
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/notifications/${notificationId}/read`,
        {},
        { headers: getAuthHeader() }
      );
      // Remove the notification from the list immediately
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.put(
        "http://localhost:5000/api/dashboard/notifications/mark-all-read",
        {},
        { headers: getAuthHeader() }
      );
      // Remove all unread notifications from the list
      setNotifications((prev) => prev.filter((n) => n.read_status));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "image_added":
        return "📷";
      case "image_assigned_annotator":
        return "🎯";
      case "image_assigned_tester":
        return "🔍";
      case "image_completed":
        return "✓";
      case "image_approved":
        return "✅";
      case "image_rejected":
        return "❌";
      default:
        return "📢";
    }
  };

  const parseNotificationMessage = (message) => {
    // Split message by | to extract main message and action
    const parts = message.split(" | ");
    return {
      main: parts[0],
      action: parts[1] || null
    };
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case "image_approved":
        return "success";
      case "image_rejected":
        return "danger";
      case "image_assigned_annotator":
      case "image_assigned_tester":
        return "info";
      default:
        return "primary";
    }
  };

  return (
    <div className="notifications-container">
      <button
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-overlay" onClick={() => setIsOpen(false)}>
          <div className="notification-dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="notification-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button
                  className="mark-all-read"
                  onClick={handleMarkAllAsRead}
                >
                  Mark all as read
                </button>
              )}
              <button
                className="close-btn"
                onClick={() => setIsOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const { main, action } = parseNotificationMessage(notif.message);
                return (
                  <div
                    key={notif.id}
                    className={`notification-item ${
                      !notif.read_status ? "unread" : ""
                    } ${getNotificationColor(notif.type)}`}
                  >
                    <div className="notification-content">
                      <span className="notification-icon">
                        {getNotificationIcon(notif.type)}
                      </span>
                      <div className="notification-text">
                        <p className="notification-message">{main}</p>
                        {action && (
                          <div className="notification-action">
                            <strong>→ {action}</strong>
                          </div>
                        )}
                        <small className="notification-time">
                          {new Date(notif.created_at).toLocaleDateString()}{" "}
                          {new Date(notif.created_at).toLocaleTimeString()}
                        </small>
                      </div>
                    </div>

                    {!notif.read_status && (
                      <button
                        className="mark-read-btn"
                        onClick={() => handleMarkAsRead(notif.id)}
                        title="Mark as read"
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
