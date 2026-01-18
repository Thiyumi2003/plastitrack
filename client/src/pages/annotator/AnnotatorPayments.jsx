import { useState, useEffect } from "react";
import axios from "axios";
import AnnotatorSidebar from "./AnnotatorSidebar";
import "./annotator.css";

export default function AnnotatorPayments() {
  const [payments, setPayments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://localhost:5000/api/dashboard/annotator/payments",
        { headers: getAuthHeader() }
      );
      setPayments(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <div className="dashboard-container">
      <AnnotatorSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Payment Summary</h1>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="payment-summary">
          <div className="payment-card-item">
            <div className="payment-card-title">Payment Due</div>
            <div className="payment-card-value">₨ {payments?.paymentDue?.toLocaleString() || 0}</div>
          </div>

          <div className="payment-card-item">
            <div className="payment-card-title">Total (Completed)</div>
            <div className="payment-card-value">{payments?.tasksCompleted || 0}</div>
          </div>

          <div className="payment-card-item">
            <div className="payment-card-title">Total Amount Due</div>
            <div className="payment-card-value">₨ {payments?.totalAmountDue?.toLocaleString() || 0}</div>
          </div>

          <div className="payment-card-item">
            <div className="payment-card-title">Completed Amount</div>
            <div className="payment-card-value">₨ {payments?.completedAmount?.toLocaleString() || 0}</div>
          </div>

          <div className="payment-card-item">
            <div className="payment-card-title">Previous Amount</div>
            <div className="payment-card-value">₨ {payments?.previousAmount?.toLocaleString() || 0}</div>
          </div>
        </div>

        <div className="payment-warning">
          <p>⚠️ Note: Requests regarding Rs. or contribution to payment calculation</p>
        </div>

        {payments?.paymentHistory && payments.paymentHistory.length > 0 && (
          <div className="payment-history-section">
            <h2>Payment History</h2>
            <div className="table-container">
              <table className="payment-history-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                    <th>METHOD</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.paymentHistory.map((payment, idx) => (
                    <tr key={idx}>
                      <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td>₨ {payment.amount?.toLocaleString()}</td>
                      <td>
                        <span className={`status-badge status-${payment.status}`}>
                          {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1)}
                        </span>
                      </td>
                      <td>{payment.payment_method || "Bank Transfer"}</td>
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
