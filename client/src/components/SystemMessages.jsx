import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { appMessageEvents, inferMessageType, showAppMessage } from "../utils/appMessages";
import "./system-messages.css";

function MessageIcon({ type }) {
  if (type === "success") return <span>✓</span>;
  if (type === "error") return <span>x</span>;
  if (type === "warning") return <span>!</span>;
  return <span>i</span>;
}

export default function SystemMessages() {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    const handleMessage = (event) => {
      const payload = event.detail || {};
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const toast = {
        id,
        message: payload.message || "Action completed",
        type: payload.type || "info",
      };

      setToasts((prev) => [...prev, toast]);

      const duration = Number(payload.duration) || 3600;
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, duration);
    };

    const handleConfirm = (event) => {
      const payload = event.detail || {};
      setConfirmDialog({
        message: payload.message || "Are you sure?",
        confirmText: payload.confirmText || "Confirm",
        cancelText: payload.cancelText || "Cancel",
        tone: payload.tone || "warning",
        details: Array.isArray(payload.details) ? payload.details : [],
        onResolve: payload.onResolve,
      });
    };

    const originalAlert = window.alert;
    window.alert = (message) => {
      showAppMessage(message, inferMessageType(message));
    };

    window.addEventListener(appMessageEvents.message, handleMessage);
    window.addEventListener(appMessageEvents.confirm, handleConfirm);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener(appMessageEvents.message, handleMessage);
      window.removeEventListener(appMessageEvents.confirm, handleConfirm);
    };
  }, []);

  const closeConfirm = (result) => {
    if (confirmDialog?.onResolve) {
      confirmDialog.onResolve(result);
    }
    setConfirmDialog(null);
  };

  return createPortal(
    <>
      <div className="system-toast-root">
        {toasts.map((toast) => (
          <div key={toast.id} className={`system-toast ${toast.type}`}>
            <div className="system-toast-icon">
              <MessageIcon type={toast.type} />
            </div>
            <div className="system-toast-text">{toast.message}</div>
            <button
              className="system-toast-close"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
              aria-label="Close notification"
              type="button"
            >
              x
            </button>
          </div>
        ))}
      </div>

      {confirmDialog && (
        <div className="system-confirm-overlay" onClick={() => closeConfirm(false)}>
          <div className="system-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`system-confirm-badge ${confirmDialog.tone}`}>Confirmation</div>
            <h3>Please confirm this action</h3>
            <p>{confirmDialog.message}</p>
            {confirmDialog.details.length > 0 && (
              <div className="system-confirm-details">
                {confirmDialog.details.map((detail) => (
                  <div key={detail.label} className="system-confirm-detail-row">
                    <span className="system-confirm-detail-label">{detail.label}</span>
                    <span className="system-confirm-detail-value">{detail.value}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="system-confirm-actions">
              <button type="button" className="system-btn neutral" onClick={() => closeConfirm(false)}>
                {confirmDialog.cancelText}
              </button>
              <button type="button" className={`system-btn ${confirmDialog.tone}`} onClick={() => closeConfirm(true)}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
