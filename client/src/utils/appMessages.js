const APP_MESSAGE_EVENT = "plastitrack:app-message";
const APP_CONFIRM_EVENT = "plastitrack:app-confirm";

export const appMessageEvents = {
  message: APP_MESSAGE_EVENT,
  confirm: APP_CONFIRM_EVENT,
};

export function showAppMessage(message, type = "info", duration = 3600) {
  if (!message) return;

  window.dispatchEvent(
    new CustomEvent(APP_MESSAGE_EVENT, {
      detail: {
        message: String(message),
        type,
        duration,
      },
    })
  );
}

export function showAppConfirm(message, options = {}) {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent(APP_CONFIRM_EVENT, {
        detail: {
          message: String(message || "Are you sure?"),
          confirmText: options.confirmText || "Confirm",
          cancelText: options.cancelText || "Cancel",
          tone: options.tone || "warning",
          onResolve: resolve,
        },
      })
    );
  });
}

export function inferMessageType(rawMessage) {
  const msg = String(rawMessage || "").toLowerCase();

  if (msg.includes("error") || msg.includes("failed") || msg.includes("cannot") || msg.includes("rejected")) {
    return "error";
  }

  if (msg.includes("success") || msg.includes("approved") || msg.includes("enabled") || msg.includes("deleted") || msg.includes("updated") || msg.includes("added")) {
    return "success";
  }

  if (msg.includes("warning") || msg.includes("required") || msg.includes("please")) {
    return "warning";
  }

  return "info";
}
