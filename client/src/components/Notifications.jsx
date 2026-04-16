import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Bell, X, Check } from "lucide-react";
import { createPortal } from "react-dom";
import "./notifications.css";

export default function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 72, left: 16 });
  const bellRef = useRef(null);

  const updateDropdownPosition = useCallback(() => {
    const bell = bellRef.current;
    if (!bell) return;

    const rect = bell.getBoundingClientRect();
    const dropdownWidth = 420;
    const gutter = 12;
    const viewportPadding = 10;

    let left = rect.right - dropdownWidth;
    if (left < viewportPadding) left = viewportPadding;
    if (left + dropdownWidth > window.innerWidth - viewportPadding) {
      left = Math.max(viewportPadding, window.innerWidth - dropdownWidth - viewportPadding);
    }

    const top = rect.bottom + gutter;
    setDropdownPosition({ top, left });
  }, []);

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/notifications`,
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
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/notifications/${notificationId}/read`,
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
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/notifications/mark-all-read`,
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

  const handleCloseNotification = async (notification) => {
    if (!notification.read_status) {
      try {
        await axios.put(
          `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/notifications/${notification.id}/read`,
          {},
          { headers: getAuthHeader() }
        );
      } catch (err) {
        console.error("Failed to mark notification as read on close:", err);
      }
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
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
        ref={bellRef}
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && createPortal(
        <div className="notification-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="notification-dropdown"
            style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px` }}
            onClick={(e) => e.stopPropagation()}
          >
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

                      <div className="notification-buttons">
                        {!notif.read_status && (
                          <button
                            className="mark-read-btn"
                            onClick={() => handleMarkAsRead(notif.id)}
                            title="Mark as read"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <button
                          className="notification-close-item-btn"
                          onClick={() => handleCloseNotification(notif)}
                          title="Close notification"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
