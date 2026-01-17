import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "./Sidebar";
import "./superadmin.css";

export default function ManagePayments() {
  const [paymentOverview, setPaymentOverview] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState(null);
  const [modelPayments, setModelPayments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    const fetchPaymentData = async () => {
      try {
        setLoading(true);
        const [overviewRes, historyRes, modelRes] = await Promise.all([
          axios.get("http://localhost:5000/api/dashboard/payments", { headers: getAuthHeader() }),
          axios.get("http://localhost:5000/api/dashboard/payment-history", {
            headers: getAuthHeader(),
          }),
          axios.get("http://localhost:5000/api/dashboard/model-payments", {
            headers: getAuthHeader(),
          }),
        ]);

        setPaymentOverview(overviewRes.data);
        setPaymentHistory(historyRes.data);
        setModelPayments(modelRes.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load payment data");
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentData();
  }, []);

  if (loading) return <div className="dashboard-loading">Loading...</div>;

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
              className={`tab ${activeTab === "model" ? "active" : ""}`}
              onClick={() => setActiveTab("model")}
            >
              Model Based Payments
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

        {activeTab === "model" && (
          <div className="table-container">
            <h3>Model Based Payments</h3>
            <table className="payments-table">
              <thead>
                <tr>
                  <th>ImageSet Name</th>
                  <th>Annotator</th>
                  <th>Tester</th>
                  <th>Objects</th>
                  <th>Status</th>
                  <th>Payment Due</th>
                </tr>
              </thead>
              <tbody>
                {modelPayments?.modelDetails?.map((payment, idx) => (
                  <tr key={idx}>
                    <td>{payment.model_type}</td>
                    <td>{payment.name}</td>
                    <td>{payment.images_completed || 0}</td>
                    <td>{payment.images_assigned || 0}</td>
                    <td>
                      <span className={`status-badge status-${payment.status}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td>₨ {(payment.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
