import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Sidebar from "./Sidebar";
import "./superadmin.css";

const getRoleLabel = (role) => {
  if (role === "annotator") return "Annotator";
  if (role === "tester") return "Tester";
  if (role === "admin") return "Admin";
  if (role === "melbourne_user") return "Melbourne User";
  if (role === "super_admin") return "Super Admin";
  return role;
};

const getPaymentTypeLabel = (type) => (type === "per_hour" ? "Per Hour" : "Per Object");

export default function ManageRates() {
  const [activeTab, setActiveTab] = useState("role-rates");
  const [roleRates, setRoleRates] = useState([]);
  const [userRates, setUserRates] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleEditing, setRoleEditing] = useState({});
  const [userEditing, setUserEditing] = useState({});
  const [newOverride, setNewOverride] = useState({ userId: "", customRate: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const eligibleUsers = useMemo(
    () => users.filter((user) => ["annotator", "tester", "admin"].includes(user.role)),
    [users]
  );

  const selectedUser = useMemo(
    () => eligibleUsers.find((user) => String(user.id) === String(newOverride.userId)),
    [eligibleUsers, newOverride.userId]
  );

  const selectedUserPaymentType = selectedUser?.role === "admin" ? "per_hour" : "per_object";

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [roleRatesRes, userRatesRes, usersRes] = await Promise.all([
        axios.get("http://localhost:5000/api/dashboard/role-rates", { headers: getAuthHeader() }),
        axios.get("http://localhost:5000/api/dashboard/user-rates", { headers: getAuthHeader() }),
        axios.get("http://localhost:5000/api/dashboard/users", { headers: getAuthHeader() }),
      ]);

      setRoleRates(roleRatesRes.data || []);
      setUserRates(userRatesRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load rate management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleRoleSave = async (rate) => {
    try {
      const value = roleEditing[rate.id];
      if (value === undefined || value === "" || Number(value) < 0 || Number.isNaN(Number(value))) {
        setError("Please enter a valid non-negative default rate");
        return;
      }

      await axios.put(
        `http://localhost:5000/api/dashboard/role-rates/${rate.id}`,
        { default_rate: Number(value) },
        { headers: getAuthHeader() }
      );

      setSuccess("Role rate updated successfully");
      setRoleEditing((prev) => ({ ...prev, [rate.id]: undefined }));
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update role rate");
    }
  };

  const handleUserSave = async (rate) => {
    try {
      const value = userEditing[rate.id];
      if (value === undefined || value === "" || Number(value) < 0 || Number.isNaN(Number(value))) {
        setError("Please enter a valid non-negative custom rate");
        return;
      }

      await axios.put(
        `http://localhost:5000/api/dashboard/user-rates/by-user/${rate.user_id}/${rate.payment_type}`,
        { custom_rate: Number(value) },
        { headers: getAuthHeader() }
      );

      setSuccess("User override updated successfully");
      setUserEditing((prev) => ({ ...prev, [rate.id]: undefined }));
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update user override");
    }
  };

  const handleUserDelete = async (rate) => {
    if (!window.confirm(`Delete custom override for ${rate.name}?`)) return;

    try {
      await axios.delete(
        `http://localhost:5000/api/dashboard/user-rates/by-user/${rate.user_id}/${rate.payment_type}`,
        { headers: getAuthHeader() }
      );

      setSuccess("User override removed; role default now applies");
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete user override");
    }
  };

  const handleAddOverride = async (e) => {
    e.preventDefault();

    if (!selectedUser) {
      setError("Please select a user");
      return;
    }

    if (newOverride.customRate === "" || Number(newOverride.customRate) < 0 || Number.isNaN(Number(newOverride.customRate))) {
      setError("Please enter a valid non-negative custom rate");
      return;
    }

    try {
      await axios.post(
        "http://localhost:5000/api/dashboard/user-rates",
        {
          user_id: Number(selectedUser.id),
          payment_type: selectedUserPaymentType,
          custom_rate: Number(newOverride.customRate),
        },
        { headers: getAuthHeader() }
      );

      setSuccess("User override added successfully");
      setNewOverride({ userId: "", customRate: "" });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add user override");
    }
  };

  useEffect(() => {
    if (!error && !success) return;
    const timer = setTimeout(() => {
      setError("");
      setSuccess("");
    }, 3000);
    return () => clearTimeout(timer);
  }, [error, success]);

  if (loading) return <div className="dashboard-loading">Loading rate management...</div>;

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Rate Management</h1>
        </div>

        {error && <div className="dashboard-error">{error}</div>}
        {success && <div className="dashboard-success">{success}</div>}

        <div className="tabs-section">
          <div className="tabs">
            <button
              className={`tab ${activeTab === "role-rates" ? "active" : ""}`}
              onClick={() => setActiveTab("role-rates")}
            >
              Role Rates
            </button>
            <button
              className={`tab ${activeTab === "user-rates" ? "active" : ""}`}
              onClick={() => setActiveTab("user-rates")}
            >
              User Rates
            </button>
          </div>
        </div>

        {activeTab === "role-rates" && (
          <div className="table-container">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Payment Type</th>
                  <th>Default Rate</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {roleRates.map((rate) => (
                  <tr key={rate.id}>
                    <td>{getRoleLabel(rate.role_name)}</td>
                    <td>{getPaymentTypeLabel(rate.payment_type)}</td>
                    <td>
                      <input
                        type="number"
                        className="rate-input"
                        min="0"
                        step="0.01"
                        value={
                          roleEditing[rate.id] !== undefined
                            ? roleEditing[rate.id]
                            : rate.default_rate
                        }
                        onChange={(e) =>
                          setRoleEditing((prev) => ({
                            ...prev,
                            [rate.id]: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button className="btn-save-rate" onClick={() => handleRoleSave(rate)}>
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
                {!roleRates.length && (
                  <tr>
                    <td colSpan={4} className="no-data">No role rates found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "user-rates" && (
          <>
            <form className="rate-override-form" onSubmit={handleAddOverride}>
              <div className="form-group">
                <label>User</label>
                <select
                  value={newOverride.userId}
                  onChange={(e) => setNewOverride((prev) => ({ ...prev, userId: e.target.value }))}
                  required
                >
                  <option value="">Select user</option>
                  {eligibleUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({getRoleLabel(user.role)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Payment Type</label>
                <input
                  type="text"
                  value={selectedUser ? getPaymentTypeLabel(selectedUserPaymentType) : "Select a user first"}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Custom Rate</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newOverride.customRate}
                  onChange={(e) => setNewOverride((prev) => ({ ...prev, customRate: e.target.value }))}
                  placeholder="Enter rate"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  Save Override
                </button>
              </div>
            </form>

            <div className="table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Custom Rate</th>
                    <th>Payment Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {userRates.map((rate) => (
                    <tr key={rate.id}>
                      <td>{rate.name}</td>
                      <td>{rate.email}</td>
                      <td>{getRoleLabel(rate.role)}</td>
                      <td>
                        <input
                          type="number"
                          className="rate-input"
                          min="0"
                          step="0.01"
                          value={
                            userEditing[rate.id] !== undefined
                              ? userEditing[rate.id]
                              : rate.custom_rate
                          }
                          onChange={(e) =>
                            setUserEditing((prev) => ({
                              ...prev,
                              [rate.id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>{getPaymentTypeLabel(rate.payment_type)}</td>
                      <td>
                        <div className="rate-actions">
                          <button className="btn-save-rate" onClick={() => handleUserSave(rate)}>
                            Save
                          </button>
                          <button className="btn-delete-rate" onClick={() => handleUserDelete(rate)}>
                            Delete Override
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!userRates.length && (
                    <tr>
                      <td colSpan={6} className="no-data">No user-specific overrides found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="rate-legend">
          <strong>Logic:</strong> Role rates are defaults, and user custom rates override role defaults.
        </div>
      </div>
    </div>
  );
}
