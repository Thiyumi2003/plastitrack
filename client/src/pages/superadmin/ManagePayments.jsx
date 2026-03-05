import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "./Sidebar";
import "./superadmin.css";

export default function ManagePayments() {
  const [paymentOverview, setPaymentOverview] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState(null);
  const [modelPayments, setModelPayments] = useState(null);
  const [modelPaymentDetails, setModelPaymentDetails] = useState([]);
  const [adminPaymentDetails, setAdminPaymentDetails] = useState([]);
  const [expandedModels, setExpandedModels] = useState({});
  const [pendingPayments, setPendingPayments] = useState([]);
  const [expandedPayment, setExpandedPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [eligibleModels, setEligibleModels] = useState([]);
  const [eligibleUsers, setEligibleUsers] = useState({ modelSummary: null, annotators: [], testers: [] });
  const [adminUsers, setAdminUsers] = useState([]);
  const [createForm, setCreateForm] = useState({
    role: "annotator",
    modelType: "",
    userId: "",
    amount: "",
    paymentMethod: "bank",
  });
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [creating, setCreating] = useState(false);

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);
      setError("");
      const [overviewRes, historyRes, modelRes, modelsRes, adminsRes, modelDetailsRes, adminDetailsRes] = await Promise.all([
        axios.get("http://localhost:5000/api/dashboard/payments", { headers: getAuthHeader() }),
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

      console.log("Payment data loaded:", { overviewRes: overviewRes.data, historyRes: historyRes.data, modelRes: modelRes.data });
      setPaymentOverview(overviewRes.data);
      setPaymentHistory(historyRes.data);
      setModelPayments(modelRes.data);
      setEligibleModels(modelsRes.data?.models || []);
      setAdminUsers(adminsRes.data || []);
      setModelPaymentDetails(modelDetailsRes.data?.models || []);
      setAdminPaymentDetails(adminDetailsRes.data?.adminPayments || []);

      // Filter pending payments from history
      const pending = historyRes.data?.history?.filter((p) => p.status === "pending") || [];
      setPendingPayments(pending);
    } catch (err) {
      console.error("Fetch payment data error:", err);
      setError(err.response?.data?.error || "Failed to load payment data. Please try logging in again.");
    } finally {
      setLoading(false);
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

  const handleCreateChange = (field, value) => {
    setCreateError("");
    setCreateSuccess("");
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (!createForm.userId || !createForm.amount) {
      setCreateError("User and amount are required");
      return;
    }

    if (createForm.role !== "admin" && !createForm.modelType) {
      setCreateError("Model type is required for annotator/tester payments");
      return;
    }

    try {
      setCreating(true);
      const payload = {
        user_id: Number(createForm.userId),
        amount: Number(createForm.amount),
        payment_method: createForm.paymentMethod,
      };

      if (createForm.role !== "admin") {
        payload.model_type = createForm.modelType;
      }

      await axios.post("http://localhost:5000/api/dashboard/payments", payload, {
        headers: getAuthHeader(),
      });

      setCreateSuccess("Payment created and sent for approval");
      setCreateForm({ role: "annotator", modelType: "", userId: "", amount: "", paymentMethod: "bank" });
      fetchPaymentData();
    } catch (err) {
      setCreateError(err.response?.data?.error || "Failed to create payment");
    } finally {
      setCreating(false);
    }
  };

  const handlePaymentApproval = async (id, status) => {
    const confirmMsg =
      status === "approved"
        ? "Approve this payment? This will allow the payment to be processed."
        : "Reject this payment? The payment will not be processed.";

    if (!confirm(confirmMsg)) return;

    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/payments/${id}`,
        {
          status,
          approved_date: status === "approved" ? new Date().toISOString() : null,
        },
        { headers: getAuthHeader() }
      );
      alert(`Payment ${status} successfully`);
      fetchPaymentData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update payment");
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
  const approvedCount = selectedUser?.approved_images || 0;

  const getStatusLabel = (status) => {
    switch (status) {
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

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Manage Payments</h1>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        {/* Payment Overview Cards */}
        <div className="payment-cards-section">
          <div className="payment-card">
            <div className="payment-icon">₨</div>
            <div className="payment-content">
              <div className="payment-value">
                ₨ {paymentOverview?.totalPaidThisMonth?.toLocaleString() || 0}
              </div>
              <div className="payment-label">Total Paid This Month</div>
            </div>
          </div>

          <div className="payment-card">
            <div className="payment-icon">📦</div>
            <div className="payment-content">
              <div className="payment-value">{paymentOverview?.modelsReadyForPayment || 0}</div>
              <div className="payment-label">Models Ready for Payment</div>
            </div>
          </div>

          <div className="payment-card">
            <div className="payment-icon">⏳</div>
            <div className="payment-content">
              <div className="payment-value">
                ₨ {paymentOverview?.pendingAdminPayment?.toLocaleString() || 0}
              </div>
              <div className="payment-label">Pending Admin Payment</div>
            </div>
          </div>

          <div className="payment-card">
            <div className="payment-icon">💳</div>
            <div className="payment-content">
              <div className="payment-value">
                {paymentOverview?.withdrawalMethods?.length || 0}
              </div>
              <div className="payment-label">Withdrawal Methods</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-section">
          <div className="tabs">
            <button
              className={`tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Payment Overview
            </button>
            <button
              className={`tab ${activeTab === "pending" ? "active" : ""}`}
              onClick={() => setActiveTab("pending")}
            >
              Pending Approvals ({pendingPayments.length})
            </button>
            <button
              className={`tab ${activeTab === "model" ? "active" : ""}`}
              onClick={() => setActiveTab("model")}
            >
              Model Based Payments
            </button>
            <button
              className={`tab ${activeTab === "create" ? "active" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              Create Payment
            </button>
            <button
              className={`tab ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Payment History
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="table-container">
            <h3>Withdrawal Methods</h3>
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Payment Method</th>
                  <th>Count</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentOverview?.withdrawalMethods?.map((method, idx) => (
                  <tr key={idx}>
                    <td className="method-name">{method.payment_method || "Bank Transfer"}</td>
                    <td>{method.count || 0}</td>
                    <td>₨ {(method.total || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {!paymentOverview?.withdrawalMethods?.length && (
                  <tr>
                    <td colSpan="3" className="no-data">
                      No payment data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "pending" && (
          <div className="table-container">
            <h3>Pending Payment Approvals</h3>
            <table className="payments-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Amount</th>
                  <th>Model Type</th>
                  <th>Images</th>
                  <th>Method</th>
                  <th>Created</th>
                  <th>Actions</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">
                      No pending payments
                    </td>
                  </tr>
                ) : (
                  pendingPayments.map((payment) => (
                    <>
                      <tr key={payment.id}>
                        <td><strong>{payment.admin_name || "Unknown"}</strong></td>
                        <td><strong>₨ {(payment.amount || 0).toLocaleString()}</strong></td>
                        <td>{payment.model_type}</td>
                        <td>{payment.images_completed || 0}</td>
                        <td>{payment.payment_method || "-"}</td>
                        <td>{new Date(payment.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: "flex", gap: "5px" }}>
                            <button
                              className="btn-approve"
                              onClick={() => handlePaymentApproval(payment.id, "approved")}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#10b981",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              ✓ Approve
                            </button>
                            <button
                              className="btn-reject"
                              onClick={() => handlePaymentApproval(payment.id, "rejected")}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#ef4444",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              ✗ Reject
                            </button>
                          </div>
                        </td>
                        <td>
                          <button
                            onClick={() => setExpandedPayment(expandedPayment === payment.id ? null : payment.id)}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            {expandedPayment === payment.id ? "▲ Hide" : "▼ Show"}
                          </button>
                        </td>
                      </tr>
                      {expandedPayment === payment.id && (
                        <tr>
                          <td colSpan="8" style={{ backgroundColor: "#f9fafb", padding: "20px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                              {/* Annotators Section */}
                              <div>
                                <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#374151" }}>
                                  📝 Annotators ({payment.annotators?.length || 0})
                                </h4>
                                {payment.annotators && payment.annotators.length > 0 ? (
                                  <table style={{ width: "100%", fontSize: "13px", backgroundColor: "white", borderRadius: "4px" }}>
                                    <thead>
                                      <tr style={{ backgroundColor: "#e5e7eb" }}>
                                        <th style={{ padding: "8px", textAlign: "left" }}>Annotator Name</th>
                                        <th style={{ padding: "8px", textAlign: "center" }}>Annotated</th>
                                        <th style={{ padding: "8px", textAlign: "center" }}>Approved</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {payment.annotators.map((annotator, idx) => (
                                        <tr key={idx}>
                                          <td style={{ padding: "8px" }}>{annotator.annotator_name}</td>
                                          <td style={{ padding: "8px", textAlign: "center" }}>{annotator.images_annotated}</td>
                                          <td style={{ padding: "8px", textAlign: "center" }}>{annotator.images_approved}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p style={{ color: "#6b7280", fontSize: "13px" }}>No annotator data available</p>
                                )}
                              </div>

                              {/* Testers Section */}
                              <div>
                                <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#374151" }}>
                                  ✅ Testers ({payment.testers?.length || 0})
                                </h4>
                                {payment.testers && payment.testers.length > 0 ? (
                                  <table style={{ width: "100%", fontSize: "13px", backgroundColor: "white", borderRadius: "4px" }}>
                                    <thead>
                                      <tr style={{ backgroundColor: "#e5e7eb" }}>
                                        <th style={{ padding: "8px", textAlign: "left" }}>Tester Name</th>
                                        <th style={{ padding: "8px", textAlign: "center" }}>Reviewed</th>
                                        <th style={{ padding: "8px", textAlign: "center" }}>Approved</th>
                                        <th style={{ padding: "8px", textAlign: "center" }}>Rejected</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {payment.testers.map((tester, idx) => (
                                        <tr key={idx}>
                                          <td style={{ padding: "8px" }}>{tester.tester_name}</td>
                                          <td style={{ padding: "8px", textAlign: "center" }}>{tester.images_reviewed}</td>
                                          <td style={{ padding: "8px", textAlign: "center" }}>{tester.images_approved}</td>
                                          <td style={{ padding: "8px", textAlign: "center" }}>{tester.images_rejected}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p style={{ color: "#6b7280", fontSize: "13px" }}>No tester data available</p>
                                )}
                              </div>
                            </div>

                            {/* Admin's Own Work (if applicable) */}
                            {payment.adminWork && payment.adminWork.images_annotated > 0 && (
                              <div style={{ marginTop: "20px", padding: "12px", backgroundColor: "#dbeafe", borderRadius: "4px" }}>
                                <h4 style={{ marginTop: 0, marginBottom: "8px", color: "#1e40af" }}>
                                  👤 Admin's Own Work
                                </h4>
                                <div style={{ display: "flex", gap: "20px", fontSize: "13px" }}>
                                  <span>Images Annotated: <strong>{payment.adminWork.images_annotated}</strong></span>
                                  <span>Images Approved: <strong>{payment.adminWork.images_approved}</strong></span>
                                  <span>Images Completed: <strong>{payment.adminWork.images_completed}</strong></span>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "model" && (
          <div className="model-payments-section">
            <h3>Payment by Model Completion</h3>
            <p className="section-hint">Payments are released only after all image sets of a model are finalized.</p>

            {modelPaymentDetails.length === 0 && (
              <div className="no-data">No model data available</div>
            )}

            {modelPaymentDetails.map((model) => {
              const isExpanded = expandedModels[model.modelType] ?? true;
              const completionText = `${model.finalizedImages}/${model.totalImages} ImageSets Completed`;
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
                      <div className="model-name">{model.modelType}</div>
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

            <div className="admin-payments-section">
              <h3>Admin Payments</h3>
              <div className="table-container">
                <table className="payments-table">
                  <thead>
                    <tr>
                      <th>Admin</th>
                      <th>Hours</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Method</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminPaymentDetails.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="no-data">No admin payments</td>
                      </tr>
                    ) : (
                      adminPaymentDetails.map((payment) => (
                        <tr key={payment.id}>
                          <td>{payment.admin_name}</td>
                          <td>{Number(payment.hours || 0).toFixed(2)}</td>
                          <td>₨ {Number(payment.amount || 0).toLocaleString()}</td>
                          <td>
                            <span className={`status-badge status-${payment.status}`}>
                              {payment.status}
                            </span>
                          </td>
                          <td>{payment.payment_method || "-"}</td>
                          <td>{payment.payment_date?.split("T")[0] || payment.created_at?.split("T")[0]}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "create" && (
          <div className="table-container">
            <h3>Create Payment</h3>
            <form onSubmit={handleCreatePayment} className="payment-create-form">
              <div className="form-row">
                <label>Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    handleCreateChange("role", role);
                    handleCreateChange("userId", "");
                    if (role === "admin") {
                      handleCreateChange("modelType", "");
                    }
                  }}
                >
                  <option value="annotator">Annotator</option>
                  <option value="tester">Tester</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {createForm.role !== "admin" && (
                <div className="form-row">
                  <label>Model Type</label>
                  <select
                    value={createForm.modelType}
                    onChange={(e) => {
                      handleCreateChange("modelType", e.target.value);
                      handleCreateChange("userId", "");
                    }}
                  >
                    <option value="">Select model</option>
                    {eligibleModels.map((model) => (
                      <option key={model.modelType} value={model.modelType}>
                        {model.modelType} ({model.finalizedImages}/{model.totalImages} finalized)
                      </option>
                    ))}
                  </select>
                  {createForm.modelType && (
                    <div className="form-hint">
                      {isModelComplete
                        ? "Model completed. Payments allowed for approved image sets."
                        : "Model not completed. Finish all image sets before payment."}
                    </div>
                  )}
                </div>
              )}

              <div className="form-row">
                <label>User</label>
                <select
                  value={createForm.userId}
                  onChange={(e) => handleCreateChange("userId", e.target.value)}
                  disabled={createForm.role !== "admin" && !isModelComplete}
                >
                  <option value="">Select user</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
                {createForm.role !== "admin" && selectedUser && (
                  <div className="form-hint">Approved image sets: {approvedCount}</div>
                )}
              </div>

              <div className="form-row">
                <label>Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.amount}
                  onChange={(e) => handleCreateChange("amount", e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Payment Method</label>
                <select
                  value={createForm.paymentMethod}
                  onChange={(e) => handleCreateChange("paymentMethod", e.target.value)}
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="mobile">Mobile</option>
                </select>
              </div>

              {createError && <div className="dashboard-error">{createError}</div>}
              {createSuccess && <div className="dashboard-success">{createSuccess}</div>}

              <button className="btn-primary" type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Payment"}
              </button>
            </form>
          </div>
        )}

        {activeTab === "history" && (
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

            <div className="table-container">
              <h3>Payment History</h3>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Admin Name</th>
                    <th>Amount</th>
                    <th>Model Type</th>
                    <th>Images</th>
                    <th>Status</th>
                    <th>Method</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory?.history?.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.admin_name || "Unknown"}</td>
                      <td>₨ {(payment.amount || 0).toLocaleString()}</td>
                      <td>{payment.model_type}</td>
                      <td>{payment.images_completed || 0}</td>
                      <td>
                        <span className={`status-badge status-${payment.status}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td>{payment.payment_method || "-"}</td>
                      <td>{payment.payment_date?.split("T")[0] || payment.created_at?.split("T")[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
