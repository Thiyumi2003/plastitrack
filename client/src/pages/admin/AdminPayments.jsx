import { useState, useEffect } from "react";
import axios from "axios";
import "./admin.css";
import { ALL_BRANCH_OPTIONS, BANK_OPTIONS } from "../../constants/bankOptions";

export default function AdminPayments() {
  const [paymentData, setPaymentData] = useState(null);
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
    fetchMethods();
  }, []);

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
        account_name: methodForm.name,
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

  if (loading) return <div className="dashboard-loading">Loading payments...</div>;

  return (
    <>
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

            <div className="payment-history" style={{ marginTop: 24 }}>
              <h3>My Payment Details</h3>
              <form onSubmit={saveMethod}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                  <div>
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
                  <div>
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
                  <div>
                    <label className="input-label">Name</label>
                    <input
                      className="text-input"
                      value={methodForm.name}
                      onChange={(e) => setMethodForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter account name"
                    />
                  </div>
                  <div>
                    <label className="input-label">Account Number</label>
                    <input
                      className="text-input"
                      value={methodForm.account_number}
                      onChange={(e) => setMethodForm((prev) => ({ ...prev, account_number: e.target.value }))}
                      placeholder="Enter account number"
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 32 }}>
                    <input
                      type="checkbox"
                      checked={methodForm.is_default}
                      onChange={(e) => setMethodForm((prev) => ({ ...prev, is_default: e.target.checked }))}
                    />
                    <span>Set as default</span>
                  </div>
                </div>

                {methodMessage && (
                  <div className={methodMessage.includes("saved") ? "dashboard-success" : "error-message"} style={{ marginTop: 12 }}>
                    {methodMessage}
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={savingMethod} style={{ marginTop: 14 }}>
                  {savingMethod ? "Saving..." : "Save Payment Details"}
                </button>
              </form>

              <div style={{ marginTop: 16, overflowX: "auto" }}>
                <table className="payment-history-table" style={{ width: "100%" }}>
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
                        <td>{m.account_name || m.card_holder_name || "-"}</td>
                        <td>{m.masked_card_number}</td>
                        <td>{m.is_default ? "Yes" : "No"}</td>
                        <td>
                          {!m.is_default && (
                            <button className="btn-secondary" onClick={() => setDefaultMethod(m.id)}>
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
        </>
      )}
    </>
  );
}
