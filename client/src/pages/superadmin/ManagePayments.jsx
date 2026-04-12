import { useState, useEffect } from "react";
import axios from "axios";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import logo from "../../images/logo (2).png";
import { showAppConfirm } from "../../utils/appMessages";
import "./superadmin.css";

export default function ManagePayments() {
  const supportedTabs = ["model", "pending", "ready", "transfer", "history"];
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const [paymentHistory, setPaymentHistory] = useState(null);
  const [modelPayments, setModelPayments] = useState(null);
  const [modelPaymentDetails, setModelPaymentDetails] = useState([]);
  const [adminPaymentDetails, setAdminPaymentDetails] = useState([]);
  const [expandedModels, setExpandedModels] = useState({});
  const [pendingPayments, setPendingPayments] = useState([]);
  const [readyPayments, setReadyPayments] = useState([]);
  const [pendingWorkHours, setPendingWorkHours] = useState([]);
  const [approvalDialog, setApprovalDialog] = useState({
    isOpen: false,
    payment: null,
    status: "approved",
    submitting: false,
  });
  const [payDialog, setPayDialog] = useState({
    isOpen: false,
    payment: null,
    recipientMethods: [],
    selectedRecipientMethodId: "",
    loading: false,
    submitting: false,
  });
  const [approvalStatus, setApprovalStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("model");
  const [eligibleModels, setEligibleModels] = useState([]);
  const [eligibleUsers, setEligibleUsers] = useState({ modelSummary: null, annotators: [], testers: [] });
  const [adminUsers, setAdminUsers] = useState([]);
  const [createForm, setCreateForm] = useState({
    role: "annotator",
    modelType: "",
    userId: "",
    amount: "",
    paymentMethod: "bank",
    payMinutes: "",
    sourcePaymentMethodId: "",
  });
  const [adminEligibility, setAdminEligibility] = useState(null);
  const [adminEligibilityLoading, setAdminEligibilityLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [autoGenerateResult, setAutoGenerateResult] = useState(null);
  const [payingPaymentId, setPayingPaymentId] = useState(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  const [sendingNotificationId, setSendingNotificationId] = useState(null);
  const [sentReceiptNotifications, setSentReceiptNotifications] = useState({});
  const [paymentRoleTab, setPaymentRoleTab] = useState("all");
  const [transferFilters, setTransferFilters] = useState({
    role: "all",
    bank: "all",
    status: "all",
  });
  const [adminWorkSummary, setAdminWorkSummary] = useState({
    totalWorkedHours: 0,
    paidHours: 0,
    remainingHours: 0,
  });
  const [methodForm, setMethodForm] = useState({
    paymentType: "card",
    cardHolderName: currentUser?.name || "",
    accountName: currentUser?.name || "",
    accountNumber: "",
    bankName: "",
    branchName: "",
    cardType: "Visa",
    cardNumber: "",
    cvv: "",
    expiryMonth: "",
    expiryYear: "",
    isDefault: true,
  });
  const [methodStatus, setMethodStatus] = useState("");
  const [savingMethod, setSavingMethod] = useState(false);
  const [superAdminMethods, setSuperAdminMethods] = useState([]);
  const [selectedMethodId, setSelectedMethodId] = useState(null);

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchPaymentData();
    fetchSuperAdminMethods();
    fetchPendingWorkHours();
  }, []);

  useEffect(() => {
    if (!supportedTabs.includes(activeTab)) {
      setActiveTab("model");
    }
  }, [activeTab]);

  const fetchPendingWorkHours = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/dashboard/superadmin/work-hours",
        {
          headers: getAuthHeader(),
          params: { status: "pending" },
        }
      );
      setPendingWorkHours(res.data?.workHours || []);
    } catch (err) {
      console.error("Fetch pending work hours error:", err);
      setPendingWorkHours([]);
    }
  };

  const fetchAdminWorkSummary = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/dashboard/superadmin/work-hours", {
        headers: getAuthHeader(),
      });

      const summaryRows = Array.isArray(res.data?.adminSummary) ? res.data.adminSummary : [];
      const totalWorkedHours = summaryRows.reduce((sum, row) => sum + Number(row.total_hours || 0), 0);
      const paidHours = (adminPaymentDetails || [])
        .filter((payment) => payment.status === "paid")
        .reduce((sum, payment) => sum + Number(payment.hours || 0), 0);

      setAdminWorkSummary({
        totalWorkedHours,
        paidHours,
        remainingHours: Math.max(0, totalWorkedHours - paidHours),
      });
    } catch (err) {
      console.error("Fetch admin work summary error:", err);
    }
  };

  const fetchPaymentData = async () => {
    try {
      setLoading(true);
      setError("");
      const [historyRes, modelRes, modelsRes, adminsRes, modelDetailsRes, adminDetailsRes] = await Promise.all([
        axios.get("http://localhost:5000/api/dashboard/payment-history", {
          headers: getAuthHeader(),
        }),
        axios.get("http://localhost:5000/api/dashboard/model-payments", {
          headers: getAuthHeader(),
        }),
        axios.get("http://localhost:5000/api/dashboard/payments/eligible-models", {
          headers: getAuthHeader(),
        }),
        axios.get("http://localhost:5000/api/dashboard/users", {
          headers: getAuthHeader(),
          params: { role: "admin" },
        }),
        axios.get("http://localhost:5000/api/dashboard/reports/model-payment-details", {
          headers: getAuthHeader(),
        }),
        axios.get("http://localhost:5000/api/dashboard/reports/admin-payment-details", {
          headers: getAuthHeader(),
        }),
      ]);

      setPaymentHistory(historyRes.data);
      setModelPayments(modelRes.data);
      setEligibleModels(modelsRes.data?.models || []);
      setAdminUsers(adminsRes.data || []);
      setModelPaymentDetails(modelDetailsRes.data?.models || []);
      setAdminPaymentDetails(adminDetailsRes.data?.adminPayments || []);

      // Filter pending payments from history
      const pending =
        historyRes.data?.history?.filter(
          (p) => p.status === "pending_approval" || p.status === "pending_calculation"
        ) || [];
      const ready =
        historyRes.data?.history?.filter(
          (p) => p.status === "approved" || p.status === "ready_to_pay"
        ) || [];
      setPendingPayments(pending);
      setReadyPayments(ready);
    } catch (err) {
      console.error("Fetch payment data error:", err);
      setError(err.response?.data?.error || "Failed to load payment data. Please try logging in again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuperAdminMethods = async () => {
    try {
      if (!currentUser?.id) return;
      const res = await axios.get("http://localhost:5000/api/dashboard/payment-methods", {
        headers: getAuthHeader(),
        params: { user_id: currentUser.id },
      });
      const methods = res.data || [];
      setSuperAdminMethods(methods);
      setSelectedMethodId((prev) => {
        if (!methods.length) return null;
        if (prev && methods.some((m) => Number(m.id) === Number(prev))) return prev;
        const preferred = methods.find((m) => m.is_default) || methods[0];
        return preferred?.id || null;
      });
    } catch (err) {
      setMethodStatus(err.response?.data?.error || "Failed to load payment methods");
    }
  };

  const savePaymentMethod = async (e) => {
    e.preventDefault();
    setMethodStatus("");

    if (methodForm.paymentType === "bank") {
      if (!methodForm.accountName || !methodForm.accountNumber || !methodForm.bankName || !methodForm.branchName) {
        setMethodStatus("Account name, account number, bank name and branch are required");
        return;
      }
    } else {
      if (!methodForm.cardHolderName || !methodForm.cardNumber || !methodForm.expiryMonth || !methodForm.expiryYear) {
        setMethodStatus("Card holder name, card number, expiry month and year are required");
        return;
      }

      if (!/^\d{3,4}$/.test(String(methodForm.cvv || ""))) {
        setMethodStatus("CVV must be 3 or 4 digits");
        return;
      }
    }

    try {
      setSavingMethod(true);
      await axios.post(
        "http://localhost:5000/api/dashboard/payment-methods",
        methodForm.paymentType === "bank"
          ? {
              user_id: Number(currentUser.id),
              card_holder_name: methodForm.accountName,
              account_number: methodForm.accountNumber,
              bank_name: methodForm.bankName,
              branch_name: methodForm.branchName,
              card_type: "Bank Account",
              is_default: !!methodForm.isDefault,
            }
          : {
              user_id: Number(currentUser.id),
              card_holder_name: methodForm.cardHolderName,
              card_number: methodForm.cardNumber,
              card_type: methodForm.cardType,
              is_default: !!methodForm.isDefault,
            },
        { headers: getAuthHeader() }
      );

      setMethodStatus("Card saved successfully");
      setMethodForm((prev) => ({
        ...prev,
        accountNumber: "",
        bankName: "",
        branchName: "",
        cardNumber: "",
        cvv: "",
        expiryMonth: "",
        expiryYear: "",
      }));
      fetchSuperAdminMethods();
      fetchPaymentData();
    } catch (err) {
      setMethodStatus(err.response?.data?.error || "Failed to save card");
    } finally {
      setSavingMethod(false);
    }
  };

  const setDefaultMethod = async (methodId) => {
    try {
      setMethodStatus("");
      await axios.put(
        `http://localhost:5000/api/dashboard/payment-methods/${methodId}/default`,
        {},
        { headers: getAuthHeader() }
      );
      setMethodStatus("Default card updated");
      fetchSuperAdminMethods();
      fetchPaymentData();
    } catch (err) {
      setMethodStatus(err.response?.data?.error || "Failed to update default card");
    }
  };

  const toggleModel = (modelType) => {
    setExpandedModels((prev) => ({
      ...prev,
      [modelType]: !prev[modelType],
    }));
  };

  useEffect(() => {
    const fetchEligibleUsers = async () => {
      if (activeTab !== "create") return;
      if (createForm.role === "admin") {
        setEligibleUsers({ modelSummary: null, annotators: [], testers: [] });
        return;
      }
      if (!createForm.modelType) {
        setEligibleUsers({ modelSummary: null, annotators: [], testers: [] });
        return;
      }

      try {
        const res = await axios.get("http://localhost:5000/api/dashboard/payments/eligible-users", {
          headers: getAuthHeader(),
          params: { modelType: createForm.modelType },
        });
        setEligibleUsers(res.data);
      } catch (err) {
        console.error("Fetch eligible users error:", err);
        setCreateError(err.response?.data?.error || "Failed to load eligible users");
      }
    };

    fetchEligibleUsers();
  }, [activeTab, createForm.modelType, createForm.role]);

  useEffect(() => {
    const fetchAdminEligibility = async () => {
      if (activeTab !== "create" || createForm.role !== "admin" || !createForm.userId) {
        setAdminEligibility(null);
        setAdminEligibilityLoading(false);
        return;
      }

      try {
        setAdminEligibilityLoading(true);
        const res = await axios.get(`http://localhost:5000/api/dashboard/admin-payments/eligibility/${createForm.userId}`, {
          headers: getAuthHeader(),
        });
        setAdminEligibility(res.data);
        setCreateForm((prev) => {
          if (prev.role !== "admin") return prev;
          const remaining = Number(res.data?.remainingMinutes || 0);
          if (!prev.payMinutes) {
            return { ...prev, payMinutes: remaining > 0 ? String(remaining) : "" };
          }
          const current = Number(prev.payMinutes || 0);
          if (current > remaining && remaining >= 0) {
            return { ...prev, payMinutes: String(remaining) };
          }
          return prev;
        });
      } catch (err) {
        console.error("Fetch admin eligibility error:", err);
        setAdminEligibility(null);
        setCreateError(err.response?.data?.error || "Failed to load admin payment eligibility");
      } finally {
        setAdminEligibilityLoading(false);
      }
    };

    fetchAdminEligibility();
  }, [activeTab, createForm.role, createForm.userId]);

  useEffect(() => {
    fetchAdminWorkSummary();
  }, [adminPaymentDetails]);

  const handleCreateChange = (field, value) => {
    setCreateError("");
    setCreateSuccess("");
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!createForm.userId) {
      setCreateError("Select a user");
      return;
    }

    if (createForm.role !== "admin" && !createForm.modelType) {
      setCreateError("Model type is required for annotator/tester payments");
      return;
    }

    try {
      setCreating(true);

      if (createForm.role === "admin") {
        const payMinutes = Number(createForm.payMinutes);

        if (!Number.isInteger(payMinutes) || payMinutes <= 0) {
          setCreateError("Enter valid pay minutes");
          return;
        }

        if (!createForm.sourcePaymentMethodId) {
          setCreateError("Select source payment account");
          return;
        }

        if (!adminEligibility) {
          setCreateError("Eligibility details not loaded yet");
          return;
        }

        if (payMinutes > Number(adminEligibility.remainingMinutes || 0)) {
          setCreateError(`Pay minutes cannot exceed remaining minutes (${adminEligibility.remainingMinutes})`);
          return;
        }

        await axios.post(
          "http://localhost:5000/api/dashboard/admin-payments",
          {
            admin_id: Number(createForm.userId),
            pay_minutes: payMinutes,
            source_payment_method_id: Number(createForm.sourcePaymentMethodId),
          },
          { headers: getAuthHeader() }
        );

        setCreateSuccess("Admin payment created and submitted for approval");
      } else {
        const payload = {
          user_id: Number(createForm.userId),
          payment_method: createForm.paymentMethod,
          model_type: createForm.modelType,
        };

        await axios.post("http://localhost:5000/api/dashboard/payments", payload, {
          headers: getAuthHeader(),
        });

        setCreateSuccess("Payment created and sent for approval");
      }

      setCreateForm({
        role: "annotator",
        modelType: "",
        userId: "",
        amount: "",
        paymentMethod: "bank",
        payMinutes: "",
        sourcePaymentMethodId: "",
      });
      setAdminEligibility(null);
      fetchPaymentData();
    } catch (err) {
      setCreateError(err.response?.data?.error || "Failed to create payment");
    } finally {
      setCreating(false);
    }
  };

  const handleAutoGeneratePayments = async () => {
    try {
      setCreating(true);
      setCreateError("");
      setCreateSuccess("");

      const res = await axios.post(
        "http://localhost:5000/api/dashboard/payments/auto-generate",
        {},
        { headers: getAuthHeader() }
      );

      const result = res.data || {};
      setAutoGenerateResult(result);
      setCreateSuccess(result.message || "Automatic payment generation completed");
      fetchPaymentData();
    } catch (err) {
      setCreateError(err.response?.data?.error || "Failed to auto-generate payments");
    } finally {
      setCreating(false);
    }
  };

  const openApprovalDialog = (payment, status) => {
    setApprovalDialog({
      isOpen: true,
      payment,
      status,
      submitting: false,
    });
  };

  const closeApprovalDialog = () => {
    setApprovalDialog((prev) => {
      if (prev.submitting) return prev;
      return { isOpen: false, payment: null, status: "approved", submitting: false };
    });
  };

  const handlePaymentApproval = async () => {
    if (!approvalDialog.payment?.id) return;

    const status = approvalDialog.status;
    setApprovalDialog((prev) => ({ ...prev, submitting: true }));

    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/payments/${approvalDialog.payment.id}`,
        {
          status,
          approved_date: status === "approved" ? new Date().toISOString() : null,
        },
        { headers: getAuthHeader() }
      );
      setApprovalStatus({
        type: "success",
        message: `Payment ${status === "approved" ? "approved" : "rejected"} successfully`,
      });
      setApprovalDialog({ isOpen: false, payment: null, status: "approved", submitting: false });
      if (status === "approved") {
        setActiveTab("ready");
      }
      fetchPaymentData();
    } catch (err) {
      setApprovalStatus({
        type: "error",
        message: err.response?.data?.error || "Failed to update payment",
      });
      setApprovalDialog((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleWorkHoursApproval = async (workHourId, status) => {
    if (!workHourId) return;

    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/superadmin/work-hours/${workHourId}/status`,
        { status },
        { headers: getAuthHeader() }
      );

      setApprovalStatus({
        type: "success",
        message: `Work hours ${status === "approved" ? "approved" : "rejected"} successfully`,
      });
      fetchPendingWorkHours();
      fetchPaymentData();
      if (status === "approved") {
        setActiveTab("ready");
      }
    } catch (err) {
      setApprovalStatus({
        type: "error",
        message: err.response?.data?.error || "Failed to update work hours",
      });
    }
  };

  const openPayDialog = async (payment) => {
    const sourceMethodId = Number(selectedMethodId || defaultMethod?.id || 0);

    if (!sourceMethodId) {
      setApprovalStatus({
        type: "error",
        message: "Select or add a default payment card before paying",
      });
      setActiveTab("ready");
      return;
    }

    try {
      setPayDialog({
        isOpen: true,
        payment,
        recipientMethods: [],
        selectedRecipientMethodId: "",
        loading: true,
        submitting: false,
      });

      const res = await axios.get("http://localhost:5000/api/dashboard/payment-methods", {
        headers: getAuthHeader(),
        params: { user_id: payment.user_id },
      });

      const recipientMethods = res.data || [];
      const preferredMethod = recipientMethods.find((method) => method.is_default) || recipientMethods[0] || null;

      setPayDialog((prev) => ({
        ...prev,
        recipientMethods,
        selectedRecipientMethodId: preferredMethod ? String(preferredMethod.id) : "",
        loading: false,
      }));
    } catch (err) {
      setPayDialog({
        isOpen: false,
        payment: null,
        recipientMethods: [],
        selectedRecipientMethodId: "",
        loading: false,
        submitting: false,
      });
      setApprovalStatus({
        type: "error",
        message: err.response?.data?.error || "Failed to load recipient payment methods",
      });
    }
  };

  const closePayDialog = (force = false) => {
    setPayDialog((prev) => {
      if (prev.submitting && !force) return prev;
      return {
        isOpen: false,
        payment: null,
        recipientMethods: [],
        selectedRecipientMethodId: "",
        loading: false,
        submitting: false,
      };
    });
  };

  const formatNotificationSummary = (notifications = []) => {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return "";
    }

    return notifications
      .map((notification) => {
        const channel = String(notification?.channel || "notification");
        if (notification?.sent) {
          return `${channel.toUpperCase()} sent`;
        }
        return `${channel.toUpperCase()} skipped${notification?.reason ? ` (${notification.reason})` : ""}`;
      })
      .join(" | ");
  };

  const confirmPayNow = async () => {
    if (!payDialog.payment?.id) return;

    const sourceMethodId = Number(selectedMethodId || defaultMethod?.id || 0);
    if (!sourceMethodId) {
      setApprovalStatus({
        type: "error",
        message: "Select or add a default payment card before paying",
      });
      closePayDialog();
      setActiveTab("ready");
      return;
    }

    try {
      setPayingPaymentId(payDialog.payment.id);
      setPayDialog((prev) => ({ ...prev, submitting: true }));
      const res = await axios.post(
        `http://localhost:5000/api/dashboard/payments/${payDialog.payment.id}/pay`,
        {
          source_payment_method_id: sourceMethodId,
          payment_method_id: payDialog.selectedRecipientMethodId ? Number(payDialog.selectedRecipientMethodId) : null,
          payment_method: payDialog.payment.payment_method || "bank",
        },
        { headers: getAuthHeader() }
      );

      const notificationSummary = formatNotificationSummary(res.data?.notifications || []);

      setApprovalStatus({
        type: "success",
        message: notificationSummary
          ? `Payment processed successfully. ${notificationSummary}`
          : "Payment processed successfully",
      });
      closePayDialog(true);
      setActiveTab("history");
      fetchPaymentData();
    } catch (err) {
      setApprovalStatus({
        type: "error",
        message: err.response?.data?.error || "Failed to process payment",
      });
      setPayDialog((prev) => ({ ...prev, submitting: false }));
    } finally {
      setPayingPaymentId(null);
    }
  };

  const handleSendNotification = async (paymentId) => {
    if (!paymentId) return;

    try {
      setSendingNotificationId(paymentId);
      const res = await axios.post(
        `http://localhost:5000/api/dashboard/payments/${paymentId}/send-notification`,
        {},
        { headers: getAuthHeader() }
      );

      const notificationSummary = formatNotificationSummary(res.data?.notifications || []);
      setApprovalStatus({
        type: "success",
        message: notificationSummary
          ? `Notification processed. ${notificationSummary}`
          : "Notification processed",
      });
      setSentReceiptNotifications((prev) => ({ ...prev, [paymentId]: true }));
    } catch (err) {
      setApprovalStatus({
        type: "error",
        message: err.response?.data?.error || "Failed to send notification",
      });
    } finally {
      setSendingNotificationId(null);
    }
  };

  const handleManualMarkPaid = async (payment) => {
    if (!payment?.id) return;

    const confirmed = await showAppConfirm(
      `Mark payment as paid for ${getPaymentDisplayName(payment)}?`,
      { confirmText: "Pay", tone: "warning" }
    );
    if (!confirmed) return;

    try {
      setPayingPaymentId(payment.id);
      await axios.post(
        `http://localhost:5000/api/dashboard/payments/${payment.id}/pay`,
        {
          payment_method_id: payment.recipient_payment_method_id ? Number(payment.recipient_payment_method_id) : null,
          payment_method: "manual_bank_transfer",
        },
        { headers: getAuthHeader() }
      );

      setApprovalStatus({
        type: "success",
        message: "Payment marked as paid (manual bank transfer)",
      });
      fetchPaymentData();
      setActiveTab("history");
    } catch (err) {
      setApprovalStatus({
        type: "error",
        message: err.response?.data?.error || "Failed to mark payment as paid",
      });
    } finally {
      setPayingPaymentId(null);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  const modelSummary = eligibleUsers?.modelSummary;
  const isModelComplete = modelSummary?.isComplete || false;
  const availableUsers =
    createForm.role === "annotator"
      ? eligibleUsers?.annotators || []
      : createForm.role === "tester"
      ? eligibleUsers?.testers || []
      : adminUsers || [];
  const selectedUser = availableUsers.find((user) => String(user.id) === String(createForm.userId));
  const approvedCount =
    createForm.role === "annotator"
      ? Number(selectedUser?.approved_objects || selectedUser?.approved_images || 0)
      : Number(selectedUser?.reviewed_objects || selectedUser?.reviewed_images || 0);

  const getStatusLabel = (status) => {
    switch (status) {
      case "paid":
        return "Paid";
      case "ready_to_pay":
        return "Ready To Pay";
      case "pending_approval":
        return "Pending Approval";
      case "pending_calculation":
        return "Pending Calculation";
      case "approved":
        return "Validated";
      case "rejected":
        return "Rejected";
      case "completed":
        return "Completed";
      case "pending_review":
        return "In Review";
      case "in_progress":
        return "In Progress";
      case "pending":
      default:
        return "Pending";
    }
  };

  const getStatusClass = (status) => {
    if (status === "pending_review") {
      return "completed";
    }
    return status;
  };

  const getStatusTone = (status) => {
    if (["pending", "pending_approval", "pending_calculation"].includes(status)) {
      return { bg: "rgba(250, 204, 21, 0.2)", border: "rgba(250, 204, 21, 0.45)", color: "#facc15" };
    }
    if (["approved", "ready_to_pay"].includes(status)) {
      return { bg: "rgba(34, 197, 94, 0.2)", border: "rgba(34, 197, 94, 0.45)", color: "#22c55e" };
    }
    if (status === "rejected") {
      return { bg: "rgba(239, 68, 68, 0.2)", border: "rgba(239, 68, 68, 0.45)", color: "#ef4444" };
    }
    if (status === "paid") {
      return { bg: "rgba(59, 130, 246, 0.2)", border: "rgba(59, 130, 246, 0.45)", color: "#3b82f6" };
    }
    return { bg: "rgba(148, 163, 184, 0.2)", border: "rgba(148, 163, 184, 0.4)", color: "#cbd5e1" };
  };

  const canDownloadReceipt = (payment) => {
    return payment?.status === "paid";
  };

  const formatMinutesAsHM = (minutesValue) => {
    const totalMinutes = Math.max(0, Number(minutesValue || 0));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${hours}h ${minutes}m`;
  };

  const formatHoursAsHM = (hoursValue) => {
    const totalMinutes = Number(hoursValue || 0) * 60;
    return formatMinutesAsHM(totalMinutes);
  };

  const getPaymentDisplayName = (payment) => {
    return (
      payment?.user_name ||
      payment?.admin_name ||
      payment?.name ||
      payment?.email ||
      "Unknown"
    );
  };

  const getModelTypeDisplay = (payment) => {
    return payment?.model_type_display || payment?.model_type || "-";
  };

  const getRecipientBankName = (payment) => {
    return payment?.recipient_bank_name || "-";
  };

  const getRecipientAccount = (payment) => {
    return payment?.recipient_account_number || "-";
  };

  const getModelCardDisplay = (model) => {
    if (model?.modelTypeDisplay) {
      return model.modelTypeDisplay;
    }
    const firstImageName = model?.images?.[0]?.imageName || "";
    const parts = String(firstImageName).split("_").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}_${parts[1]}`;
    }
    return model?.modelType || "-";
  };

  const formatCurrency = (amount) => {
    return `Rs ${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatReceiptDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  };

  const escapeHtml = (value) => {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const buildReceiptMarkup = (receipt) => {
    const commonRows = [
      ["Receipt No", receipt.receiptNumber],
      ["User", receipt.userName],
      ["Email", receipt.userEmail],
      ["Role", receipt.userRole],
      ["Status", getStatusLabel(receipt.status)],
      ["Amount", formatCurrency(receipt.amount)],
      ["Payment Method", receipt.paymentMethod || "-"],
      ["Created Date", formatReceiptDate(receipt.createdAt)],
      ["Approved Date", formatReceiptDate(receipt.approvedDate)],
      ["Paid Date", formatReceiptDate(receipt.paymentDate)],
      ["Approved By", receipt.approvedBy || "-"],
    ];

    if (receipt.modelType || receipt.modelTypeDisplay) {
      commonRows.splice(6, 0, ["Model Type", receipt.modelTypeDisplay || receipt.modelType]);
    }

    let detailSection = "<p>No detailed receipt lines available.</p>";

    if (receipt.userRole === "admin") {
      detailSection = `
        <h2>Admin Work Hours</h2>
        <div class="summary-grid">
          <div class="summary-box"><span>Paid Minutes</span><strong>${escapeHtml(receipt.paidMinutes)}</strong></div>
          <div class="summary-box"><span>Paid Hours</span><strong>${escapeHtml(formatMinutesAsHM(receipt.paidMinutes))}</strong></div>
          <div class="summary-box"><span>Hourly Rate</span><strong>${escapeHtml(formatCurrency(receipt.summary?.hourlyRate || 0))}</strong></div>
          <div class="summary-box"><span>Minute Rate</span><strong>${escapeHtml(Number(receipt.summary?.minuteRate || 0).toFixed(4))}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Worked Hours</th>
              <th>Allocated</th>
              <th>Allocated Minutes</th>
              <th>Session</th>
            </tr>
          </thead>
          <tbody>
            ${receipt.lineItems.length
              ? receipt.lineItems
                  .map(
                    (item) => `
                      <tr>
                        <td>${escapeHtml(formatReceiptDate(item.workDate))}</td>
                        <td>${escapeHtml(item.description || "-")}</td>
                        <td>${escapeHtml(formatHoursAsHM(item.workedHours))}</td>
                        <td>${escapeHtml(formatMinutesAsHM(item.allocatedMinutes))}</td>
                        <td>${escapeHtml(item.allocatedMinutes)}</td>
                        <td>${escapeHtml(
                          item.sessionStart || item.sessionEnd
                            ? `${formatReceiptDate(item.sessionStart)} - ${formatReceiptDate(item.sessionEnd)}`
                            : "-"
                        )}</td>
                      </tr>`
                  )
                  .join("")
              : '<tr><td colspan="6">No work hour rows found for this payment.</td></tr>'}
          </tbody>
        </table>
      `;
    } else if (["annotator", "tester"].includes(receipt.userRole)) {
      detailSection = `
        <h2>${escapeHtml(receipt.userRole === "annotator" ? "Annotator Objects" : "Tester Objects")}</h2>
        <div class="summary-grid">
          <div class="summary-box"><span>Total Objects</span><strong>${escapeHtml(receipt.summary?.totalObjects || 0)}</strong></div>
          <div class="summary-box"><span>Object Rows</span><strong>${escapeHtml(receipt.lineItems.length || 0)}</strong></div>
          <div class="summary-box"><span>Rate / Object</span><strong>${escapeHtml(formatCurrency(receipt.summary?.perObjectRate || 0))}</strong></div>
          <div class="summary-box"><span>Recorded Rows</span><strong>${escapeHtml(receipt.lineItems.length || 0)}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Image Set</th>
              <th>Model</th>
              <th>Status</th>
              <th>Objects</th>
              <th>Calculated Amount</th>
              <th>Completed Date</th>
            </tr>
          </thead>
          <tbody>
            ${receipt.lineItems.length
              ? receipt.lineItems
                  .map(
                    (item) => `
                      <tr>
                        <td>${escapeHtml(item.imageName)}</td>
                        <td>${escapeHtml(item.modelLabel || item.modelType || "-")}</td>
                        <td>${escapeHtml(getStatusLabel(item.status))}</td>
                        <td>${escapeHtml(item.objectsCount)}</td>
                        <td>${escapeHtml(formatCurrency(item.paidAmount || 0))}</td>
                        <td>${escapeHtml(formatReceiptDate(item.updatedAt || item.createdAt))}</td>
                      </tr>`
                  )
                  .join("")
              : '<tr><td colspan="6">No image-set rows found for this payment.</td></tr>'}
          </tbody>
        </table>
      `;
    }

    return `
      <style>
        .receipt-root {
          width: 1120px;
          background: linear-gradient(180deg, #f8fbff 0%, #ffffff 22%);
          color: #0f172a;
          font-family: Arial, sans-serif;
          padding: 28px;
          box-sizing: border-box;
        }
        .receipt-brand {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 22px;
          border-radius: 18px;
          background: linear-gradient(135deg, #0f172a, #1d4ed8 62%, #38bdf8);
          color: #ffffff;
          margin-bottom: 22px;
        }
        .receipt-brand-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .receipt-brand-logo {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.14);
          padding: 8px;
          object-fit: contain;
          box-sizing: border-box;
        }
        .receipt-brand-text small {
          display: block;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          opacity: 0.82;
          margin-bottom: 6px;
        }
        .receipt-brand-text h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.1;
        }
        .receipt-brand-text p {
          margin: 8px 0 0;
          font-size: 14px;
          opacity: 0.92;
        }
        .receipt-brand-badge {
          text-align: right;
        }
        .receipt-brand-badge span {
          display: block;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.82;
          margin-bottom: 6px;
        }
        .receipt-brand-badge strong {
          display: block;
          font-size: 18px;
        }
        .receipt-section-title {
          margin: 0 0 14px;
          font-size: 20px;
          color: #0f172a;
        }
        .meta-grid, .summary-grid { display: grid; gap: 12px; margin-bottom: 20px; }
        .meta-grid { grid-template-columns: repeat(2, minmax(240px, 1fr)); }
        .summary-grid { grid-template-columns: repeat(4, minmax(150px, 1fr)); }
        .meta-item, .summary-box {
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px 14px;
          background: #ffffff;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
        }
        .meta-item span, .summary-box span { display: block; font-size: 12px; color: #64748b; margin-bottom: 6px; text-transform: uppercase; }
        .meta-item strong, .summary-box strong { font-size: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; background: #ffffff; }
        th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; }
        th { background: #e2e8f0; }
        .footer-note {
          margin-top: 24px;
          font-size: 12px;
          color: #64748b;
          border-top: 1px solid #cbd5e1;
          padding-top: 14px;
        }
      </style>
      <div class="receipt-root">
        <div class="receipt-brand">
          <div class="receipt-brand-left">
            <img src="${logo}" alt="PlastiTrack" class="receipt-brand-logo" />
            <div class="receipt-brand-text">
              <small>PlastiTrack System</small>
              <h1>Payment Receipt</h1>
              <p>Plastic waste annotation workflow and payment management</p>
            </div>
          </div>
          <div class="receipt-brand-badge">
            <span>Receipt</span>
            <strong>${escapeHtml(receipt.receiptNumber)}</strong>
          </div>
        </div>

        <h2 class="receipt-section-title">Payment Summary</h2>
        <div class="meta-grid">
            ${commonRows
              .map(
                ([label, value]) => `
                  <div class="meta-item">
                    <span>${escapeHtml(label)}</span>
                    <strong>${escapeHtml(value || "-")}</strong>
                  </div>`
              )
              .join("")}
        </div>
        ${detailSection}
        <p class="footer-note">Generated by PlastiTrack payment management on ${escapeHtml(formatReceiptDate(new Date()))}.</p>
      </div>
    `;
  };

  const appendCanvasToPdf = (pdf, canvas, title, subtitle) => {
    const marginX = 8;
    const topOffset = 24;
    const bottomOffset = 10;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const usableHeight = pageHeight - topOffset - bottomOffset;
    const imgWidth = pageWidth - marginX * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let renderedHeight = 0;
    let pageNum = 1;

    while (renderedHeight < imgHeight) {
      if (renderedHeight > 0) {
        pdf.addPage();
        pageNum += 1;
      }

      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42);
      pdf.text(title, marginX, 10);
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(subtitle, marginX, 16);

      const startPixelY = (renderedHeight * canvas.height) / imgHeight;
      const endPixelY = Math.min(((renderedHeight + usableHeight) * canvas.height) / imgHeight, canvas.height);
      const portionHeight = endPixelY - startPixelY;

      const portionCanvas = document.createElement("canvas");
      portionCanvas.width = canvas.width;
      portionCanvas.height = portionHeight;

      const context = portionCanvas.getContext("2d");
      if (context) {
        context.drawImage(
          canvas,
          0,
          startPixelY,
          canvas.width,
          portionHeight,
          0,
          0,
          canvas.width,
          portionHeight
        );
      }

      const portionImgData = portionCanvas.toDataURL("image/png", 0.98);
      const portionImgHeight = (portionHeight * imgWidth) / canvas.width;
      pdf.addImage(portionImgData, "PNG", marginX, topOffset, imgWidth, portionImgHeight);

      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Page ${pageNum}`, pageWidth - 24, pageHeight - 4);

      renderedHeight += usableHeight;
    }
  };

  const downloadReceipt = async (paymentId) => {
    if (!paymentId) return;

    try {
      setDownloadingReceiptId(paymentId);
      const res = await axios.get(`http://localhost:5000/api/dashboard/payments/${paymentId}/receipt`, {
        headers: getAuthHeader(),
      });
      const receipt = res.data?.receipt;
      if (!receipt) {
        throw new Error("Receipt data not found");
      }

      const receiptMarkup = buildReceiptMarkup(receipt);
      const receiptContainer = document.createElement("div");
      receiptContainer.style.position = "fixed";
      receiptContainer.style.left = "-10000px";
      receiptContainer.style.top = "0";
      receiptContainer.style.width = "1120px";
      receiptContainer.style.zIndex = "-1";
      receiptContainer.innerHTML = receiptMarkup;
      document.body.appendChild(receiptContainer);

      const logoImg = receiptContainer.querySelector("img");
      if (logoImg && !logoImg.complete) {
        await new Promise((resolve, reject) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => reject(new Error("Failed to load receipt logo"));
        });
      }

      await new Promise((resolve) => window.requestAnimationFrame(resolve));

      const canvas = await html2canvas(receiptContainer, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF("portrait", "mm", "a4");
      appendCanvasToPdf(
        pdf,
        canvas,
        `PlastiTrack Receipt - ${receipt.receiptNumber}`,
        `Generated ${new Date().toLocaleString()}`
      );
      pdf.save(`${receipt.receiptNumber || `payment-receipt-${paymentId}`}.pdf`);

      document.body.removeChild(receiptContainer);
    } catch (err) {
      setApprovalStatus({
        type: "error",
        message: err.response?.data?.error || err.message || "Failed to download receipt",
      });
    } finally {
      const orphanNode = document.querySelector('div[style*="left: -10000px"]');
      if (orphanNode && orphanNode.parentNode) {
        orphanNode.parentNode.removeChild(orphanNode);
      }
      setDownloadingReceiptId(null);
    }
  };

  const isBankMethod = (method) => {
    if (!method) return false;
    return Boolean(
      method.bank_name ||
        method.branch_name ||
        String(method.card_type || "").toLowerCase().includes("bank")
    );
  };

  const getMethodBrandLabel = (method) => {
    if (!method) return "CARD";
    return isBankMethod(method) ? "BANK ACCOUNT" : String(method.card_type || "Card").toUpperCase();
  };

  const getMethodOwnerLabel = (method) => {
    return method?.card_holder_name || "Unknown";
  };

  const getMethodSecondaryLabel = (method) => {
    return isBankMethod(method) ? "Bank / Branch" : "Account";
  };

  const getMethodSecondaryValue = (method) => {
    if (!method) return "-";
    if (isBankMethod(method)) {
      return [method.bank_name, method.branch_name].filter(Boolean).join(" / ") || "-";
    }
    return method.account_number || "-";
  };

  const getMethodPrimaryValue = (method) => {
    if (!method) return "****";
    return method.account_number || "****";
  };

  const getMethodOptionLabel = (method) => {
    if (!method) return "";
    const type = getMethodBrandLabel(method);
    const primary = getMethodPrimaryValue(method);
    const owner = getMethodOwnerLabel(method);
    const secondary = getMethodSecondaryValue(method);
    return `${type} ${primary} (${owner}${secondary && secondary !== "-" ? ` • ${secondary}` : ""})`;
  };

  const selectedMethod = superAdminMethods.find((m) => Number(m.id) === Number(selectedMethodId)) || superAdminMethods[0] || null;
  const defaultMethod = superAdminMethods.find((m) => m.is_default) || selectedMethod || null;
  const selectedMethodBrand = getMethodBrandLabel(selectedMethod);
  const selectedMethodHolder = getMethodOwnerLabel(selectedMethod) || methodForm.cardHolderName || "CARD HOLDER";
  const selectedMethodMasked = getMethodPrimaryValue(selectedMethod) || "**** **** **** ****";
  const selectedMethodExpiry = getMethodSecondaryValue(selectedMethod);
  const defaultMethodMasked = getMethodPrimaryValue(defaultMethod) || "No card";
  const defaultMethodHolder = getMethodOwnerLabel(defaultMethod) || "Add a payment card";
  const defaultMethodBrand = getMethodBrandLabel(defaultMethod);
  const payDialogRecipientMethod = payDialog.recipientMethods.find(
    (method) => String(method.id) === String(payDialog.selectedRecipientMethodId)
  ) || null;
  const allHistoryPayments = paymentHistory?.history || [];
  const roleFilteredPayments = allHistoryPayments.filter((payment) => {
    if (paymentRoleTab === "all") return true;
    return String(payment.user_role || "").toLowerCase() === paymentRoleTab;
  });
  const bankFilterOptions = Array.from(
    new Set(
      allHistoryPayments
        .map((payment) => String(payment?.recipient_bank_name || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const transferListPayments = allHistoryPayments.filter((payment) => {
    const role = String(payment?.user_role || "").toLowerCase();
    const bank = String(payment?.recipient_bank_name || "").trim();
    const status = String(payment?.status || "").toLowerCase();

    if (transferFilters.role !== "all" && role !== transferFilters.role) {
      return false;
    }
    if (transferFilters.bank !== "all" && bank !== transferFilters.bank) {
      return false;
    }
    if (transferFilters.status !== "all" && status !== transferFilters.status) {
      return false;
    }
    return true;
  });
  const adminWorkProgress = adminWorkSummary.totalWorkedHours > 0
    ? Math.min(100, (adminWorkSummary.paidHours / adminWorkSummary.totalWorkedHours) * 100)
    : 0;
  const pendingObjectPayments = pendingPayments.filter(
    (payment) => payment?.user_role !== "admin"
  );
  const pendingAdminPayments = pendingPayments.filter(
    (payment) => payment?.user_role === "admin"
  );
  const readyObjectPayments = readyPayments.filter(
    (payment) => payment?.user_role !== "admin"
  );
  const readyAdminPayments = readyPayments.filter(
    (payment) => payment?.user_role === "admin"
  );
  const totalPendingApprovals = pendingObjectPayments.length + pendingAdminPayments.length + pendingWorkHours.length;
  const safeActiveTab = supportedTabs.includes(activeTab) ? activeTab : "model";

  const downloadBankWiseTransferList = () => {
    const paidTransferPayments = transferListPayments.filter((payment) => payment.status === "paid");

    if (!paidTransferPayments.length) {
      setApprovalStatus({
        type: "error",
        message: "No paid records found for selected bank/filter",
      });
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `bank_transfer_${stamp}.pdf`;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const headers = ["User", "Role", "Branch", "Account No", "Holder Name", "Paid Amount", "Paid Date"];
    const colWidths = [42, 22, 30, 34, 38, 30, 30];
    const startX = 8;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 14;

    const bankGroups = paidTransferPayments.reduce((groups, payment) => {
      const bankName = getRecipientBankName(payment) || "Unknown Bank";
      if (!groups[bankName]) {
        groups[bankName] = [];
      }
      groups[bankName].push(payment);
      return groups;
    }, {});

    const bankNames = Object.keys(bankGroups).sort((a, b) => a.localeCompare(b));

    const drawHeader = (bankName, bankTotal, bankCount) => {
      doc.setFontSize(14);
      doc.text("PlastiTrack - Bank Transfer Sheet", startX, y);
      y += 6;
      doc.setFontSize(10);
      doc.text(`Bank: ${bankName}   Date: ${stamp}`, startX, y);
      y += 5;
      doc.text(`Paid Records: ${bankCount}   Total Paid: Rs ${bankTotal.toLocaleString()}`, startX, y);
      y += 7;

      doc.setFontSize(9);
      let x = startX;
      headers.forEach((header, idx) => {
        doc.rect(x, y - 4, colWidths[idx], lineHeight);
        doc.text(header, x + 1.5, y);
        x += colWidths[idx];
      });
      y += lineHeight;
    };

    bankNames.forEach((bankName, bankIndex) => {
      const bankPayments = bankGroups[bankName];
      const bankTotal = bankPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      if (bankIndex > 0) {
        doc.addPage();
        y = 14;
      }

      drawHeader(bankName, bankTotal, bankPayments.length);

      bankPayments.forEach((payment) => {
        if (y > pageHeight - 10) {
          doc.addPage();
          y = 14;
          drawHeader(bankName, bankTotal, bankPayments.length);
        }

        const row = [
          getPaymentDisplayName(payment),
          String(payment.user_role || "-").toUpperCase(),
          payment?.recipient_branch_name || "-",
          getRecipientAccount(payment),
          payment?.recipient_account_holder || "-",
          Number(payment.amount || 0).toFixed(2),
          payment.payment_date?.split("T")[0] || payment.created_at?.split("T")[0] || "-",
        ];

        let x = startX;
        row.forEach((cell, idx) => {
          doc.rect(x, y - 4, colWidths[idx], lineHeight);
          doc.text(String(cell).slice(0, 26), x + 1.5, y);
          x += colWidths[idx];
        });

        y += lineHeight;
      });
    });

    doc.save(fileName);

    setApprovalStatus({
      type: "success",
      message: "Downloaded bank-wise PDF with paid records grouped by bank",
    });
  };

  return (
    <>
      <div className="dashboard-header">
        <h1>Manage Payments</h1>
      </div>

      <div className="form-hint" style={{ marginBottom: 14 }}>
        Role-based payroll workflow: users provide bank details, payments are calculated by approved work (annotator/tester by objects, admin by approved hours), Super Admin approves, performs manual bank transfer, then marks as paid.
      </div>

      {error && <div className="dashboard-error">{error}</div>}
      {approvalStatus.message && (
        <div className={approvalStatus.type === "success" ? "dashboard-success" : "dashboard-error"}>
          {approvalStatus.message}
        </div>
      )}

        {/* Tabs */}
        <div className="tabs-section">
          <div className="tabs">
            <button
              className={`tab ${safeActiveTab === "model" ? "active" : ""}`}
              onClick={() => setActiveTab("model")}
            >
              Model Based Payments
            </button>
            <button
              className={`tab ${safeActiveTab === "pending" ? "active" : ""}`}
              onClick={() => setActiveTab("pending")}
            >
              Pending Approvals ({totalPendingApprovals})
            </button>
            <button
              className={`tab ${safeActiveTab === "ready" ? "active" : ""}`}
              onClick={() => setActiveTab("ready")}
            >
              Ready For Bank Transfer ({readyPayments.length})
            </button>
            <button
              className={`tab ${safeActiveTab === "transfer" ? "active" : ""}`}
              onClick={() => setActiveTab("transfer")}
            >
              Bank Transfer List
            </button>
            <button
              className={`tab ${safeActiveTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Payment History
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {safeActiveTab === "pending" && (
          <div className="table-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>Pending Object-Based Payment Approvals (Annotator / Tester)</h3>
              <button className="btn-primary" type="button" onClick={handleAutoGeneratePayments} disabled={creating}>
                {creating ? "Generating..." : "Generate Pending Payments"}
              </button>
            </div>

            <div className="form-hint" style={{ marginBottom: 8 }}>
              Auto generation rules: annotator approved objects on completed models, tester reviewed objects on completed models, and admin remaining unpaid worked minutes.
            </div>
            {createError && <div className="dashboard-error">{createError}</div>}
            {createSuccess && <div className="dashboard-success">{createSuccess}</div>}
            {autoGenerateResult && (
              <div className="form-hint" style={{ marginBottom: 10 }}>
                Created: {Number(autoGenerateResult.createdCount || 0)} | Skipped: {Number(autoGenerateResult.skippedCount || 0)}
              </div>
            )}

            <table className="payments-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Amount</th>
                  <th>Model Type</th>
                  <th>Objects</th>
                  <th>Bank</th>
                  <th>Account No</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingObjectPayments.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">
                      No pending annotator/tester payments
                    </td>
                  </tr>
                ) : (
                  pendingObjectPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td><strong>{getPaymentDisplayName(payment)}</strong></td>
                      <td><strong>₨ {(payment.amount || 0).toLocaleString()}</strong></td>
                      <td>{getModelTypeDisplay(payment)}</td>
                      <td>{payment.objects_count || 0}</td>
                      <td>{getRecipientBankName(payment)}</td>
                      <td>{getRecipientAccount(payment)}</td>
                      <td>{new Date(payment.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="payment-action-group">
                            <button
                              className="payment-action-button approve"
                              onClick={() => openApprovalDialog(payment, "approved")}
                            >
                            ✓ Approve
                          </button>
                          <button
                              className="payment-action-button reject"
                              onClick={() => openApprovalDialog(payment, "rejected")}
                            >
                            ✗ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pending Work Hours Section */}
            <div style={{ marginTop: "30px" }}>
              <h3 style={{ margin: "0 0 12px 0" }}>Pending Admin Work Hours Approvals</h3>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Admin Name</th>
                    <th>Hours</th>
                    <th>Rate</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWorkHours.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-data">
                        No pending work hours approvals
                      </td>
                    </tr>
                  ) : (
                    pendingWorkHours.map((workHour) => (
                      <tr key={workHour.id}>
                        <td><strong>{workHour.admin_name || "Unknown"}</strong></td>
                        <td>{Number(workHour.hours_worked || 0).toFixed(2)} hrs</td>
                        <td>₨ {Number(workHour.hourly_rate || 0).toLocaleString()}</td>
                        <td><strong>₨ {Number(workHour.calculated_payment || 0).toLocaleString()}</strong></td>
                        <td>{new Date(workHour.date).toLocaleDateString()}</td>
                        <td>{workHour.task_description || "-"}</td>
                        <td>
                          <div className="payment-action-group">
                            <button
                              className="payment-action-button approve"
                              onClick={() => handleWorkHoursApproval(workHour.id, "approved")}
                            >
                              ✓ Approve
                            </button>
                            <button
                              className="payment-action-button reject"
                              onClick={() => handleWorkHoursApproval(workHour.id, "rejected")}
                            >
                              ✗ Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {safeActiveTab === "ready" && (
          <div>
            <div className="table-container" style={{ marginBottom: 18 }}>
              <h3>Ready For Bank Transfer - Annotator / Tester</h3>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Amount</th>
                    <th>Model Type</th>
                    <th>Objects</th>
                    <th>Status</th>
                    <th>Bank</th>
                    <th>Account No</th>
                    <th>Approved Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {readyObjectPayments.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="no-data">
                        No annotator/tester payments ready for bank transfer
                      </td>
                    </tr>
                  ) : (
                    readyObjectPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{getPaymentDisplayName(payment)}</td>
                        <td>₨ {(payment.amount || 0).toLocaleString()}</td>
                        <td>{getModelTypeDisplay(payment)}</td>
                        <td>{payment.objects_count || 0}</td>
                        <td>
                          <span className={`status-badge status-${payment.status}`}>
                            {payment.status === "approved" ? "Ready to Pay" : getStatusLabel(payment.status)}
                          </span>
                        </td>
                        <td>{getRecipientBankName(payment)}</td>
                        <td>{getRecipientAccount(payment)}</td>
                        <td>{payment.approved_date?.split("T")[0] || payment.created_at?.split("T")[0] || "-"}</td>
                        <td>
                          <button
                            className="btn-primary"
                            type="button"
                            onClick={() => handleManualMarkPaid(payment)}
                            disabled={payingPaymentId === payment.id}
                          >
                            {payingPaymentId === payment.id ? "Updating..." : "Pay"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-container">
              <h3>Ready For Bank Transfer - Admin Work Hours</h3>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Admin Name</th>
                    <th>Amount</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th>Method</th>
                    <th>Approved Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {readyAdminPayments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-data">
                        No admin payments ready for bank transfer
                      </td>
                    </tr>
                  ) : (
                    readyAdminPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{getPaymentDisplayName(payment)}</td>
                        <td>₨ {(payment.amount || 0).toLocaleString()}</td>
                        <td>{formatHoursAsHM(payment.hours || 0)}</td>
                        <td>
                          <span className={`status-badge status-${payment.status}`}>
                            {payment.status === "approved" ? "Ready to Pay" : getStatusLabel(payment.status)}
                          </span>
                        </td>
                        <td>{payment.payment_method || "-"}</td>
                        <td>{payment.approved_date?.split("T")[0] || payment.created_at?.split("T")[0] || "-"}</td>
                        <td>
                          <button
                            className="btn-primary"
                            type="button"
                            onClick={() => handleManualMarkPaid(payment)}
                            disabled={payingPaymentId === payment.id}
                          >
                            {payingPaymentId === payment.id ? "Updating..." : "Pay"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {safeActiveTab === "model" && (
          <div className="model-payments-section">
            <h3>Payment by Model Completion</h3>
            <p className="section-hint">Payments are released only after all image sets of a model are finalized.</p>

            {modelPaymentDetails.length === 0 && (
              <div className="no-data">No model data available</div>
            )}

            {modelPaymentDetails.map((model) => {
              const isExpanded = expandedModels[model.modelType] ?? true;
              const completedSets = Number(model.completedImageSets || model.finalizedImages || 0);
              const totalSets = Number(model.totalImageSets || model.totalImages || 0);
              const completionText = `${completedSets}/${totalSets} ImageSets Completed`;
              const badgeText = model.isComplete ? "Ready for Payment" : "In Progress";
              return (
                <div key={model.modelType} className="model-card">
                  <div className="model-card-header">
                    <button
                      className="model-toggle"
                      onClick={() => toggleModel(model.modelType)}
                      type="button"
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                    <div className="model-title">
                      <div className="model-name">{getModelCardDisplay(model)}</div>
                      <div className="model-subtitle">{completionText}</div>
                    </div>
                    <div className="model-summary">
                      <span className={`model-badge ${model.isComplete ? "ready" : "progress"}`}>
                        {badgeText}
                      </span>
                      <span className="model-payment">₨ {Number(model.totalPayment || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="model-table">
                      <table className="payments-table">
                        <thead>
                          <tr>
                            <th>ImageSet Name</th>
                            <th>Annotator</th>
                            <th>Tester</th>
                            <th>Objects</th>
                            <th>Status</th>
                            <th>Annotator Payment</th>
                            <th>Tester Payment</th>
                            <th>Total Payment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {model.images.map((image) => (
                            <tr key={image.id}>
                              <td>{image.imageName}</td>
                              <td>{image.annotatorName}</td>
                              <td>{image.testerName}</td>
                              <td>{image.objectsCount}</td>
                              <td>
                                <span className={`status-badge status-${getStatusClass(image.status)}`}>
                                  {getStatusLabel(image.status)}
                                </span>
                              </td>
                              <td>₨ {Number(image.annotatorPayment || 0).toLocaleString()}</td>
                              <td>₨ {Number(image.testerPayment || 0).toLocaleString()}</td>
                              <td>₨ {Number(image.totalPayment || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {safeActiveTab === "methods" && (
          <div className="table-container">
            <h3>Select Payment Method</h3>

            <div className="pm-layout">
              <div className="pm-left">
                {superAdminMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    className={`pm-card ${Number(selectedMethodId) === Number(method.id) ? "active" : ""}`}
                    onClick={() => setSelectedMethodId(method.id)}
                  >
                    <div className="pm-card-top">
                      <span>{getMethodBrandLabel(method)}</span>
                      {method.is_default && <small>Default</small>}
                    </div>
                    <div className="pm-card-number">{getMethodPrimaryValue(method)}</div>
                    <div className="pm-card-bottom">
                      <span>{getMethodOwnerLabel(method)}</span>
                      <span>{getMethodSecondaryValue(method)}</span>
                    </div>
                  </button>
                ))}

                {!superAdminMethods.length && (
                  <div className="pm-card empty">
                    <div className="pm-card-number">No saved cards</div>
                    <div className="pm-card-bottom"><span>Add a card using the form</span></div>
                  </div>
                )}
              </div>

              <div className="pm-center">
                <form onSubmit={savePaymentMethod} className="payment-create-form">
                  <div className="form-row">
                    <label>Payment Type</label>
                    <select
                      value={methodForm.paymentType}
                      onChange={(e) => setMethodForm((prev) => ({ ...prev, paymentType: e.target.value }))}
                    >
                      <option value="card">Card</option>
                      <option value="bank">Bank Account</option>
                    </select>
                  </div>

                  {methodForm.paymentType === "bank" ? (
                    <>
                      <div className="form-row">
                        <label>Account Name</label>
                        <input
                          value={methodForm.accountName}
                          onChange={(e) => setMethodForm((prev) => ({ ...prev, accountName: e.target.value }))}
                          placeholder="Account holder name"
                        />
                      </div>

                      <div className="form-row">
                        <label>Account Number</label>
                        <input
                          value={methodForm.accountNumber}
                          onChange={(e) =>
                            setMethodForm((prev) => ({
                              ...prev,
                              accountNumber: e.target.value.replace(/\D/g, "").slice(0, 20),
                            }))
                          }
                          placeholder="Enter account number"
                        />
                      </div>

                      <div className="form-row">
                        <label>Bank Name</label>
                        <input
                          value={methodForm.bankName}
                          onChange={(e) => setMethodForm((prev) => ({ ...prev, bankName: e.target.value }))}
                          placeholder="Bank"
                        />
                      </div>

                      <div className="form-row">
                        <label>Branch</label>
                        <input
                          value={methodForm.branchName}
                          onChange={(e) => setMethodForm((prev) => ({ ...prev, branchName: e.target.value }))}
                          placeholder="Branch"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                  <div className="form-row">
                    <label>Card Holder Name</label>
                    <input
                      value={methodForm.cardHolderName}
                      onChange={(e) => setMethodForm((prev) => ({ ...prev, cardHolderName: e.target.value }))}
                      placeholder="Card holder name"
                    />
                  </div>

                  <div className="form-row">
                    <label>Card Type</label>
                    <select
                      value={methodForm.cardType}
                      onChange={(e) => setMethodForm((prev) => ({ ...prev, cardType: e.target.value }))}
                    >
                      <option value="Visa">Visa</option>
                      <option value="Mastercard">Mastercard</option>
                      <option value="Amex">Amex</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <label>Card Number</label>
                    <input
                      value={methodForm.cardNumber}
                      onChange={(e) => setMethodForm((prev) => ({ ...prev, cardNumber: e.target.value }))}
                      placeholder="xxxx xxxx xxxx xxxx"
                    />
                  </div>

                  
                    <div className="form-row pm-inline-field">
                      <label>Expiry Month</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={methodForm.expiryMonth}
                        onChange={(e) => setMethodForm((prev) => ({ ...prev, expiryMonth: e.target.value }))}
                      />
                    </div>

                    <div className="form-row pm-inline-field">
                      <label>Expiry Year</label>
                      <input
                        type="number"
                        min={new Date().getFullYear()}
                        value={methodForm.expiryYear}
                        onChange={(e) => setMethodForm((prev) => ({ ...prev, expiryYear: e.target.value }))}
                      />
                    </div>

                    <div className="form-row pm-inline-field">
                      <label>CVV</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength="4"
                        value={methodForm.cvv}
                        onChange={(e) =>
                          setMethodForm((prev) => ({
                            ...prev,
                            cvv: e.target.value.replace(/\D/g, "").slice(0, 4),
                          }))
                        }
                        placeholder="123"
                      />
                    </div>
                  
                    </>
                  )}


                  <div className="form-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={methodForm.isDefault}
                        onChange={(e) => setMethodForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                        style={{ marginRight: 8 }}
                      />
                      Set as default card
                    </label>
                  </div>

                  {methodStatus && (
                    <div className={methodStatus.toLowerCase().includes("success") || methodStatus.toLowerCase().includes("saved") || methodStatus.toLowerCase().includes("updated") ? "dashboard-success" : "dashboard-error"}>
                      {methodStatus}
                    </div>
                  )}

                  <div className="pm-actions">
                    <button className="btn-primary" type="submit" disabled={savingMethod}>
                      {savingMethod ? "Saving..." : "Add Card"}
                    </button>
                    {selectedMethod && !selectedMethod.is_default && (
                      <button className="btn-secondary" type="button" onClick={() => setDefaultMethod(selectedMethod.id)}>
                        Make Selected Default
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="pm-right">
                <h4>Card Summary</h4>
                <div className="pm-summary-box">
                  <div className="pm-summary-brand">{selectedMethodBrand}</div>
                  <div className="pm-summary-number">{selectedMethodMasked}</div>
                  <div className="pm-summary-line"><span>Card Holder</span><strong>{selectedMethodHolder}</strong></div>
                  <div className="pm-summary-line"><span>{getMethodSecondaryLabel(selectedMethod)}</span><strong>{selectedMethodExpiry}</strong></div>
                  <div className="pm-summary-line"><span>Saved Cards</span><strong>{superAdminMethods.length}</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {safeActiveTab === "transfer" && (
          <div className="table-container" style={{ marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>Bank Transfer List</h3>
            <div className="form-hint" style={{ marginBottom: 10 }}>
              This list supports manual payroll transfers through bank processing.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
              <select
                value={transferFilters.role}
                onChange={(e) => setTransferFilters((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="all">All Roles</option>
                <option value="annotator">Annotator</option>
                <option value="tester">Tester</option>
                <option value="admin">Admin</option>
              </select>

              <select
                value={transferFilters.bank}
                onChange={(e) => setTransferFilters((prev) => ({ ...prev, bank: e.target.value }))}
              >
                <option value="all">All Banks</option>
                {bankFilterOptions.map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>

              <select
                value={transferFilters.status}
                onChange={(e) => setTransferFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="all">All Statuses</option>
                <option value="pending_calculation">Pending Calculation</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="ready_to_pay">Ready For Transfer</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button className="btn-primary" type="button" onClick={downloadBankWiseTransferList}>
                Download Bank-Wise PDF
              </button>
            </div>

            <table className="payments-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Bank</th>
                  <th>Branch</th>
                  <th>Account No</th>
                  <th>Holder Name</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transferListPayments.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">No records for current filters</td>
                  </tr>
                ) : (
                  transferListPayments.map((payment) => (
                    <tr key={`transfer-${payment.id}`}>
                      <td>{getPaymentDisplayName(payment)}</td>
                      <td>{String(payment.user_role || "-").toUpperCase()}</td>
                      <td>{getRecipientBankName(payment)}</td>
                      <td>{payment?.recipient_branch_name || "-"}</td>
                      <td>{getRecipientAccount(payment)}</td>
                      <td>{payment?.recipient_account_holder || "-"}</td>
                      <td>{formatCurrency(payment.amount || 0)}</td>
                      <td>
                        <span className={`status-badge status-${getStatusClass(payment.status)}`}>
                          {getStatusLabel(payment.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {safeActiveTab === "history" && (
          <div>
            <div className="payment-summary">
              <h3>Cumulative Payment Summary</h3>
              <div className="summary-cards">
                <div className="summary-card">
                  <div className="summary-label">Total Amount</div>
                  <div className="summary-value">
                    ₨ {(paymentHistory?.cumulativeSummary?.total_amount || 0).toLocaleString()}
                  </div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Total Transactions</div>
                  <div className="summary-value">
                    {paymentHistory?.cumulativeSummary?.total_transactions || 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="table-container" style={{ marginBottom: 18 }}>
              <h3 style={{ marginTop: 0 }}>Admin Work Summary</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 }}>
                <div className="summary-card">
                  <div className="summary-label">Total Worked Hours</div>
                  <div className="summary-value">{adminWorkSummary.totalWorkedHours.toFixed(2)}h</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Already Paid Hours</div>
                  <div className="summary-value">{adminWorkSummary.paidHours.toFixed(2)}h</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Remaining Hours</div>
                  <div className="summary-value">{adminWorkSummary.remainingHours.toFixed(2)}h</div>
                </div>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: "rgba(148,163,184,0.25)", overflow: "hidden" }}>
                <div style={{ width: `${adminWorkProgress}%`, height: "100%", background: "linear-gradient(90deg, #3b82f6, #10b981)" }} />
              </div>
              <div className="form-hint" style={{ marginTop: 8 }}>
                Paid progress against total logged admin work hours.
              </div>
            </div>

            <div className="table-container" style={{ marginBottom: 18 }}>
              <h3 style={{ marginTop: 0 }}>Payment Cards</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {[
                  { id: "all", label: "All Payments" },
                  { id: "annotator", label: "Annotators" },
                  { id: "tester", label: "Testers" },
                  { id: "admin", label: "Admins" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={paymentRoleTab === tab.id ? "btn-primary" : "btn-secondary"}
                    onClick={() => setPaymentRoleTab(tab.id)}
                    style={{ padding: "8px 14px", fontSize: 13 }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {roleFilteredPayments.length === 0 ? (
                <div className="no-data">No payments for selected role</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
                  {roleFilteredPayments.slice(0, 40).map((payment, index) => {
                    const tone = getStatusTone(payment.status);
                    const rateUsed = Number(payment.rate_used || 0);
                    const workedHours = Number(payment.hours || 0);
                    const workedMinutes = Math.round(workedHours * 60);
                    const hourPart = Math.floor(workedMinutes / 60);
                    const minutePart = workedMinutes % 60;
                    const minuteRate = rateUsed > 0 ? rateUsed / 60 : 0;
                    const role = String(payment.user_role || "").toLowerCase();
                    const isPending = ["pending", "pending_approval", "pending_calculation"].includes(payment.status);
                    const isApproved = ["approved", "ready_to_pay"].includes(payment.status);

                    return (
                      <div key={payment.id} style={{ border: "1px solid rgba(148,163,184,0.25)", borderRadius: 14, padding: 14, background: "rgba(15,23,42,0.45)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                          <div>
                            <div style={{ color: "#fff", fontWeight: 700 }}>{index + 1}. {getPaymentDisplayName(payment)}</div>
                            <div style={{ color: "#94a3b8", fontSize: 13 }}>{(payment.user_role || "unknown").toUpperCase()}</div>
                          </div>
                          <span style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
                            {getStatusLabel(payment.status)}
                          </span>
                        </div>

                        <div style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 8 }}>
                          <strong style={{ color: "#fff" }}>Model:</strong> {getModelTypeDisplay(payment)}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                          <div style={{ color: "#cbd5e1", fontSize: 13 }}>
                            <strong style={{ color: "#fff" }}>Work Summary:</strong><br />
                            {role === "admin"
                              ? `${hourPart}h ${minutePart}m`
                              : `${Number(payment.objects_count || 0)} objects`}
                          </div>
                          <div style={{ color: "#cbd5e1", fontSize: 13 }}>
                            <strong style={{ color: "#fff" }}>Rate:</strong><br />
                            {role === "admin"
                              ? `${formatCurrency(rateUsed)} / hour`
                              : `${formatCurrency(rateUsed)} / object`}
                          </div>
                        </div>

                        <div style={{ border: "1px dashed rgba(148,163,184,0.4)", borderRadius: 10, padding: 10, marginBottom: 10, color: "#dbeafe", fontSize: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>Payment Breakdown</div>
                          {role === "admin" ? (
                            <>
                              <div>Worked Time: {hourPart}h {minutePart}m</div>
                              <div>Hourly Rate: {formatCurrency(rateUsed)}</div>
                              <div>Minute Rate: {formatCurrency(minuteRate)}</div>
                            </>
                          ) : (
                            <>
                              <div>Completed Objects: {Number(payment.objects_count || 0)}</div>
                              <div>Rate per Object: {formatCurrency(rateUsed)}</div>
                              <div>Calculated: {Number(payment.objects_count || 0)} x {formatCurrency(rateUsed)}</div>
                            </>
                          )}
                          <div style={{ marginTop: 6, fontWeight: 800, color: "#fff" }}>
                            Total Payment: {formatCurrency(payment.amount || 0)}
                          </div>
                        </div>

                        <div className="payment-card-actions">
                          {isPending && (
                            <>
                              <button className="payment-action-button approve" type="button" onClick={() => openApprovalDialog(payment, "approved")}>Approve</button>
                              <button className="payment-action-button reject" type="button" onClick={() => openApprovalDialog(payment, "rejected")}>Reject</button>
                            </>
                          )}
                          {isApproved && (
                            <button className="btn-primary" type="button" onClick={() => handleManualMarkPaid(payment)}>
                              Pay
                            </button>
                          )}
                          {payment.status === "paid" && (
                            <>
                              <button
                                className="btn-secondary"
                                type="button"
                                onClick={() => handleSendNotification(payment.id)}
                                disabled={sendingNotificationId === payment.id}
                              >
                                {sendingNotificationId === payment.id
                                  ? "Sending..."
                                  : sentReceiptNotifications[payment.id]
                                  ? "Resend"
                                  : "Send"}
                              </button>
                              <button className="btn-secondary" type="button" onClick={() => downloadReceipt(payment.id)}>
                                Download Receipt
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="form-hint" style={{ marginTop: 10 }}>
                Model completion rule: payments are generated only when all image sets of a model are finalized.
              </div>
            </div>

            <div className="table-container">
              <h3>Payment History</h3>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Amount</th>
                    <th>Model Type</th>
                    <th>Objects</th>
                    <th>Status</th>
                    <th>Bank</th>
                    <th>Account No</th>
                    <th>Date</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {roleFilteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="no-data">No payments found</td>
                    </tr>
                  ) : (
                    roleFilteredPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{getPaymentDisplayName(payment)}</td>
                        <td>₨ {(payment.amount || 0).toLocaleString()}</td>
                        <td>{getModelTypeDisplay(payment)}</td>
                        <td>{payment.objects_count || 0}</td>
                        <td>
                          <span className={`status-badge status-${payment.status}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td>{getRecipientBankName(payment)}</td>
                        <td>{getRecipientAccount(payment)}</td>
                        <td>{payment.payment_date?.split("T")[0] || payment.created_at?.split("T")[0]}</td>
                        <td>
                          {canDownloadReceipt(payment) ? (
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() => downloadReceipt(payment.id)}
                              disabled={downloadingReceiptId === payment.id}
                            >
                              {downloadingReceiptId === payment.id ? "Downloading..." : "Download Receipt"}
                            </button>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Paid only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {approvalDialog.isOpen && (
          <div className="payment-confirm-overlay" onClick={closeApprovalDialog}>
            <div className="payment-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{approvalDialog.status === "approved" ? "Approve Payment" : "Reject Payment"}</h3>
              <p>
                {approvalDialog.status === "approved"
                  ? "Confirm approval for this payment. It will move to the next processing step."
                  : "Confirm rejection for this payment. This action marks the request as rejected."}
              </p>

              <div className="payment-confirm-meta">
                <div><strong>User:</strong> {getPaymentDisplayName(approvalDialog.payment)}</div>
                <div><strong>Amount:</strong> Rs {Number(approvalDialog.payment?.amount || 0).toLocaleString()}</div>
                <div><strong>Model:</strong> {getModelTypeDisplay(approvalDialog.payment)}</div>
                <div><strong>Created:</strong> {approvalDialog.payment?.created_at ? new Date(approvalDialog.payment.created_at).toLocaleDateString() : "-"}</div>
              </div>

              <div className="payment-confirm-actions">
                <button className="btn-secondary" type="button" onClick={closeApprovalDialog} disabled={approvalDialog.submitting}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={handlePaymentApproval}
                  disabled={approvalDialog.submitting}
                  style={approvalDialog.status === "rejected" ? { background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)" } : undefined}
                >
                  {approvalDialog.submitting
                    ? "Please wait..."
                    : approvalDialog.status === "approved"
                    ? "Approve Payment"
                    : "Reject Payment"}
                </button>
              </div>
            </div>
          </div>
        )}

        {payDialog.isOpen && (
          <div className="payment-confirm-overlay" onClick={closePayDialog}>
            <div className="payment-confirm-modal pay-dialog-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Pay Payment</h3>
              <p>Select the recipient card and confirm the super admin source card for this payment.</p>

              {payDialog.loading ? (
                <div className="form-hint">Loading payment method details...</div>
              ) : (
                <>
                  <div className="pay-dialog-grid">
                    <div className="pay-dialog-panel">
                      <div className="pay-dialog-title">Super Admin Source Card</div>
                      <div className="pay-dialog-card">
                        <div className="pay-dialog-brand">{defaultMethodBrand}</div>
                        <div className="pay-dialog-number">{defaultMethodMasked}</div>
                        <div className="pay-dialog-meta">{defaultMethodHolder}</div>
                        <div className="pay-dialog-meta">{getMethodSecondaryLabel(defaultMethod)} {getMethodSecondaryValue(defaultMethod)}</div>
                      </div>
                    </div>

                    <div className="pay-dialog-panel">
                      <div className="pay-dialog-title">Recipient Card</div>
                      {payDialog.recipientMethods.length ? (
                        <>
                          <select
                            value={payDialog.selectedRecipientMethodId}
                            onChange={(e) =>
                              setPayDialog((prev) => ({
                                ...prev,
                                selectedRecipientMethodId: e.target.value,
                              }))
                            }
                          >
                            {payDialog.recipientMethods.map((method) => (
                              <option key={method.id} value={method.id}>
                                {getMethodOptionLabel(method)} {method.is_default ? "(Default)" : ""}
                              </option>
                            ))}
                          </select>

                          {payDialogRecipientMethod && (
                            <div className="pay-dialog-card destination">
                              <div className="pay-dialog-brand">{getMethodBrandLabel(payDialogRecipientMethod)}</div>
                              <div className="pay-dialog-number">{getMethodPrimaryValue(payDialogRecipientMethod)}</div>
                              <div className="pay-dialog-meta">{getMethodOwnerLabel(payDialogRecipientMethod)}</div>
                              <div className="pay-dialog-meta">{getMethodSecondaryLabel(payDialogRecipientMethod)} {getMethodSecondaryValue(payDialogRecipientMethod)}</div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="dashboard-error">Recipient has no saved payment method.</div>
                      )}
                    </div>
                  </div>

                  <div className="payment-confirm-meta">
                    <div><strong>User:</strong> {getPaymentDisplayName(payDialog.payment)}</div>
                    <div><strong>Amount:</strong> Rs {Number(payDialog.payment?.amount || 0).toLocaleString()}</div>
                    <div><strong>Model:</strong> {getModelTypeDisplay(payDialog.payment)}</div>
                  </div>
                </>
              )}

              <div className="payment-confirm-actions">
                <button className="btn-secondary" type="button" onClick={closePayDialog} disabled={payDialog.submitting}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={confirmPayNow}
                  disabled={payDialog.loading || payDialog.submitting || !payDialog.selectedRecipientMethodId}
                >
                  {payDialog.submitting ? "Processing..." : "Confirm Pay"}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
