import { useState, useEffect } from "react";
import axios from "axios";
import TesterSidebar from "./TesterSidebar";
import "../annotator/annotator.css";

export default function TesterPayments() {
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
        "http://localhost:5000/api/dashboard/tester/payments",
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
      <TesterSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Payment History</h1>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="payment-summary">
          <div className="payment-card-item">
            <div className="payment-card-title">Payment Due</div>
            <div className="payment-card-value">₨ {payments?.paymentDue?.toLocaleString() || 0}</div>
          </div>

          <div className="payment-card-item">
            <div className="payment-card-title">Total Earnings</div>
            <div className="payment-card-value">₨ {payments?.totalEarnings?.toLocaleString() || 0}</div>
          </div>
        </div>

        <div className="payment-warning">
          <p>⚠️ Note: Payment is processed after full model completion. Pending payments will be processed at the end of the current cycle.</p>
        </div>

        {payments?.paymentHistory && payments.paymentHistory.length > 0 && (
          <div className="payment-history-section">
            <h2>Transaction History</h2>
            <div className="table-container">
              <table className="payment-history-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>IMAGE SETS</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.paymentHistory.map((payment, idx) => (
                    <tr key={idx}>
                      <td>{payment.date || "N/A"}</td>
                      <td>{payment.image_sets || 0}</td>
                      <td>₨ {payment.amount?.toLocaleString()}</td>
                      <td>
                        <span className={`status-badge status-${payment.status}`}>
                          {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1)}
                        </span>
                      </td>
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
