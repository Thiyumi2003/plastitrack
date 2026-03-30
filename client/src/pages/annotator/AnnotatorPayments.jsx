import { useState, useEffect } from "react";
import axios from "axios";
import "./annotator.css";
import { ALL_BRANCH_OPTIONS, BANK_OPTIONS } from "../../constants/bankOptions";

export default function AnnotatorPayments() {
  const [payments, setPayments] = useState(null);
  const [methods, setMethods] = useState([]);
  const [savingMethod, setSavingMethod] = useState(false);
  const [methodMessage, setMethodMessage] = useState("");
  const [methodForm, setMethodForm] = useState({
    bank_name: "",
    branch_name: "",
    name: "",
    account_number: "",
    is_default: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchPayments();
    fetchMethods();
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

  const fetchMethods = async () => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/dashboard/payment-methods",
        { headers: getAuthHeader() }
      );
      setMethods(response.data || []);
    } catch (err) {
      setMethodMessage(err.response?.data?.error || "Payment details are currently unavailable");
    }
  };

  const saveMethod = async (e) => {
    e.preventDefault();
    setMethodMessage("");

    if (!methodForm.bank_name || !methodForm.branch_name || !methodForm.name || !methodForm.account_number) {
      setMethodMessage("Bank Name, Branch Name, Name and Account Number are required");
      return;
    }

    try {
      setSavingMethod(true);
      const payload = {
        bank_name: methodForm.bank_name,
        branch_name: methodForm.branch_name,
        card_holder_name: methodForm.name,
        account_number: methodForm.account_number,
        card_type: "Bank Account",
        is_default: !!methodForm.is_default,
      };

      if (methods.length) {
        await axios.put(
          `http://localhost:5000/api/dashboard/payment-methods/${methods[0].id}`,
          payload,
          { headers: getAuthHeader() }
        );
      } else {
        await axios.post(
          "http://localhost:5000/api/dashboard/payment-methods",
          payload,
          { headers: getAuthHeader() }
        );
      }
      setMethodMessage("Payment details saved");
      setMethodForm({
        bank_name: "",
        branch_name: "",
        name: "",
        account_number: "",
        is_default: true,
      });
      fetchMethods();
    } catch (err) {
      setMethodMessage(err.response?.data?.error || "Failed to save payment details");
    } finally {
      setSavingMethod(false);
    }
  };

  const setDefaultMethod = async (methodId) => {
    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/payment-methods/${methodId}/default`,
        {},
        { headers: getAuthHeader() }
      );
      fetchMethods();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update default payment detail");
    }
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h1>Earnings & Payments</h1>
        <p>View your payment summary and earning breakdown</p>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      {/* Payment Summary Cards */}
      <div className="kpi-section">
        <div className="kpi-card">
          <div className="kpi-icon">⏳</div>
          <div className="kpi-label">Pending Approval</div>
          <div className="kpi-value">₨ {payments?.pendingApproval?.toLocaleString() || 0}</div>
        </div>

        <div className="kpi-card" style={{ borderTop: "3px solid #667eea" }}>
          <div className="kpi-icon">✓</div>
          <div className="kpi-label">Approved Amount</div>
          <div className="kpi-value" style={{ color: "#667eea" }}>₨ {payments?.approvedAmount?.toLocaleString() || 0}</div>
        </div>

        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-icon">💳</div>
          <div className="kpi-label">Paid Amount</div>
          <div className="kpi-value" style={{ color: "#10b981" }}>₨ {payments?.paidAmount?.toLocaleString() || 0}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">📊</div>
          <div className="kpi-label">Total Approved Image Sets</div>
          <div className="kpi-value">{payments?.totalApprovedImageSets || 0}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">📦</div>
          <div className="kpi-label">Total Approved Objects</div>
          <div className="kpi-value">{payments?.totalApprovedObjects || 0}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">💰</div>
          <div className="kpi-label">Current Rate</div>
          <div className="kpi-value">₨ {payments?.currentRate?.toLocaleString() || 0}/obj</div>
        </div>
      </div>

      {/* Payment Breakdown Table */}
      {payments?.paymentBreakdown && payments.paymentBreakdown.length > 0 && (
        <div className="payment-history-section">
          <h2>Payment Breakdown by Image Set</h2>
          <div className="table-container" style={{ overflowX: "auto" }}>
            <table className="payment-history-table">
              <thead>
                <tr>
                  <th>MODEL / IMAGE SET</th>
                  <th>APPROVED OBJECTS</th>
                  <th>RATE PER OBJECT</th>
                  <th>AMOUNT</th>
                  <th>PAYMENT STATUS</th>
                </tr>
              </thead>
              <tbody>
                {payments.paymentBreakdown.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.model_name || item.image_set_name || "-"}</td>
                    <td>{item.approved_objects_count || 0}</td>
                    <td>₨ {(item.rate_per_object || 0).toLocaleString()}</td>
                    <td style={{ fontWeight: "600" }}>₨ {(item.amount || 0).toLocaleString()}</td>
                    <td>
                      <span
                        className={`status-badge status-${
                          item.payment_status === "paid"
                            ? "approved"
                            : item.payment_status === "pending"
                            ? "pending"
                            : "completed"
                        }`}
                      >
                        {item.payment_status?.charAt(0).toUpperCase() +
                          item.payment_status?.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Methods Section */}

        <div className="profile-section">
          <h2>My Payment Details</h2>
          <form onSubmit={saveMethod}>
            <div className="form-row">
              <div className="form-group">
                <label className="input-label">Bank Name</label>
                <select
                  className="text-input"
                  value={methodForm.bank_name}
                  onChange={(e) =>
                    setMethodForm((prev) => ({ ...prev, bank_name: e.target.value, branch_name: "" }))
                  }
                >
                  <option value="">Select bank</option>
                  {BANK_OPTIONS.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="input-label">Branch Name</label>
                <select
                  className="text-input"
                  value={methodForm.branch_name}
                  onChange={(e) => setMethodForm((prev) => ({ ...prev, branch_name: e.target.value }))}
                >
                  <option value="">Select branch</option>
                  {ALL_BRANCH_OPTIONS.map((branch) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="input-label">Name</label>
                <input
                  className="text-input"
                  value={methodForm.name}
                  onChange={(e) => setMethodForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter account name"
                />
              </div>
              <div className="form-group">
                <label className="input-label">Account Number</label>
                <input
                  className="text-input"
                  value={methodForm.account_number}
                  onChange={(e) => setMethodForm((prev) => ({ ...prev, account_number: e.target.value }))}
                  placeholder="Enter account number"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="input-label">Set as Default</label>
                <div style={{ marginTop: 12 }}>
                  <input
                    type="checkbox"
                    checked={methodForm.is_default}
                    onChange={(e) => setMethodForm((prev) => ({ ...prev, is_default: e.target.checked }))}
                  />
                </div>
              </div>
            </div>

            {methodMessage && (
              <div className={methodMessage.includes("saved") ? "dashboard-success" : "dashboard-error"}>
                <p>{methodMessage}</p>
              </div>
            )}

            <button type="submit" className="btn-save" disabled={savingMethod}>
              {savingMethod ? "Saving..." : "Save Payment Details"}
            </button>
          </form>

          <div className="table-container" style={{ marginTop: 16 }}>
            <table className="payment-history-table">
              <thead>
                <tr>
                  <th>BANK</th>
                  <th>BRANCH</th>
                  <th>NAME</th>
                  <th>ACCOUNT</th>
                  <th>DEFAULT</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => (
                  <tr key={m.id}>
                    <td>{m.bank_name || "-"}</td>
                    <td>{m.branch_name || "-"}</td>
                    <td>{m.card_holder_name || "-"}</td>
                    <td>{m.masked_card_number}</td>
                    <td>{m.is_default ? "Yes" : "No"}</td>
                    <td>
                      {!m.is_default && (
                        <button className="btn-password" onClick={() => setDefaultMethod(m.id)}>
                          Make Default
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!methods.length && (
                  <tr>
                    <td colSpan="6" className="no-data">No payment details saved yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
    </>
  );
}
