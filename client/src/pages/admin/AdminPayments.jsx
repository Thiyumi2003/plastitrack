import { useState, useEffect } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import "./admin.css";

export default function AdminPayments() {
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const response = await axios.get("http://localhost:5000/api/dashboard/admin/payments", {
          headers: getAuthHeader(),
        });
        setPaymentData(response.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load payment data");
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  if (loading) return <div className="dashboard-loading">Loading payments...</div>;

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>admin payment</h1>
        </div>

        {error && <div className="error-message">{error}</div>}

        {paymentData && (
          <>
            <div className="payment-summary">
              <div className="payment-card earned">
                <div className="payment-value">Rs. {paymentData.totalEarned || 0}</div>
                <div className="payment-label">Total Earned</div>
              </div>
              <div className="payment-card hours">
                <div className="payment-value">{paymentData.totalHours || 0}h</div>
                <div className="payment-label">Total hours Worked</div>
              </div>
              <div className="payment-card rate">
                <div className="payment-value">Rs. {paymentData.perHourRate || 10}</div>
                <div className="payment-label">Per hour</div>
              </div>
            </div>

            <div className="payment-history">
              <h3>Payment History Overviow</h3>
              <div className="history-timeline">
                {paymentData.history && paymentData.history.length > 0 ? (
                  paymentData.history.map((payment, index) => (
                    <div key={index} className="history-item">
                      <div className="history-date">
                        <div className="date-value">{new Date(payment.date).toLocaleDateString()}</div>
                        <div className="date-label">{payment.description || payment.type}</div>
                      </div>
                      <div className="history-amount">
                        <div className="amount-value">Rs. {payment.amount?.toLocaleString()}</div>
                        <div className="amount-label">{payment.hours || 0} scm paid</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-data">No payment history available</p>
                )}
              </div>

              {paymentData.monthlyTotal && (
                <div className="monthly-total">
                  <div className="total-value">Rs. {paymentData.monthlyTotal?.toLocaleString()}</div>
                  <div className="total-label">Total Paid This Month</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
