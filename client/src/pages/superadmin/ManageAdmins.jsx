import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Edit2, Trash2 } from "lucide-react";
import "./superadmin.css";

const getProfileSrc = (profilePicture) => {
  if (!profilePicture) return null;
  if (profilePicture.startsWith("http://") || profilePicture.startsWith("https://")) {
    return profilePicture;
  }
  if (profilePicture.startsWith("/")) {
    return `http://localhost:5000${profilePicture}`;
  }
  return `http://localhost:5000/${profilePicture}`;
};

const getAvatarText = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

export default function ManageAdmins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", hourly_rate: "" });

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:5000/api/dashboard/admins", {
        headers: getAuthHeader(),
      });
      setAdmins(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (editingAdminId) {
      try {
        await axios.put(
          `http://localhost:5000/api/dashboard/users/${editingAdminId}`,
          {
            name: formData.name,
            email: formData.email,
            role: "admin",
            hourly_rate: formData.hourly_rate === "" ? null : Number(formData.hourly_rate),
          },
          { headers: getAuthHeader() }
        );
        setSuccess("Admin updated successfully");
        setFormData({ name: "", email: "", password: "", hourly_rate: "" });
        setEditingAdminId(null);
        setShowForm(false);
        fetchAdmins();
      } catch (err) {
        setError(err.response?.data?.error || "Failed to update admin");
      }
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/dashboard/admins", formData, {
        headers: getAuthHeader(),
      });
      setSuccess("Admin added successfully");
      setFormData({ name: "", email: "", password: "", hourly_rate: "" });
      setShowForm(false);
      fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add admin");
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (!window.confirm("Are you sure you want to delete this admin?")) return;
    setError("");
    setSuccess("");
    try {
      await axios.delete(`http://localhost:5000/api/dashboard/users/${id}`, {
        headers: getAuthHeader(),
      });
      setSuccess("Admin deleted successfully");
      fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete admin");
    }
  };

  const handleEditAdmin = (admin) => {
    setError("");
    setSuccess("");
    setEditingAdminId(admin.id);
    setFormData({
      name: admin.name || "",
      email: admin.email || "",
      password: "",
      hourly_rate: admin.hourly_rate ?? "",
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAdminId(null);
    setFormData({ name: "", email: "", password: "", hourly_rate: "" });
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <>
      <div className="dashboard-header">
        <h1>Manage Admins</h1>
        <button className="btn-add" onClick={() => setShowForm(!showForm)}>
          <Plus size={20} /> Add Admin
        </button>
      </div>

      {error && <div className="dashboard-error">{error}</div>}
      {success && <div className="dashboard-success">{success}</div>}

        {showForm && (
          <div className="form-card">
            <h3>{editingAdminId ? "Edit Admin" : "Add New Admin"}</h3>
            <form onSubmit={handleAddAdmin}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              {!editingAdminId && (
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label>Hourly Rate (LKR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  placeholder="Leave empty to use default admin rate"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingAdminId ? "Update Admin" : "Add Admin"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCancelForm}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

      <div className="table-container">
        <table className="admins-table">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td>
                  <div className="user-id-cell">
                    <div className="user-id-avatar">
                      {getProfileSrc(admin.profile_picture) ? (
                        <img
                          src={getProfileSrc(admin.profile_picture)}
                          alt={admin.name || "Admin"}
                          className="user-id-avatar-img"
                        />
                      ) : (
                        <span>{getAvatarText(admin.name)}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td>{admin.name}</td>
                <td>{admin.email}</td>
                <td>
                  <span className="role-badge">{admin.role}</span>
                </td>
                <td>{admin.created_at?.split("T")[0]}</td>
                <td>
                  <button
                    className="btn-edit"
                    onClick={() => handleEditAdmin(admin)}
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteAdmin(admin.id)}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
