import { useState, useEffect } from "react";
import axios from "axios";
import { Edit2, Trash2, UserX, UserCheck } from "lucide-react";
import { showAppConfirm } from "../../utils/appMessages";
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

export default function ViewAllUsers() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "",
    hourly_rate: "",
    annotator_rate: "",
    tester_rate: "",
  });

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:5000/api/dashboard/users", {
        headers: getAuthHeader(),
      });
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = users;

    if (selectedRole) {
      filtered = filtered.filter((user) => user.role === selectedRole);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  }, [selectedRole, searchTerm, users]);

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      hourly_rate: user.hourly_rate || "",
      annotator_rate: user.annotator_rate || "",
      tester_rate: user.tester_rate || "",
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm.name || !editForm.email || !editForm.role) {
      alert("Name, email, and role are required");
      return;
    }

    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/users/${selectedUser.id}`,
        editForm,
        { headers: getAuthHeader() }
      );
      setShowEditModal(false);
      fetchUsers();
      alert("User updated successfully");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update user");
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = !user.is_active;
    const confirmMsg = newStatus
      ? `Enable account for ${user.name}?`
      : `Disable account for ${user.name}? They will not be able to log in.`;

    if (!(await showAppConfirm(confirmMsg, { confirmText: newStatus ? "Enable" : "Disable", tone: newStatus ? "warning" : "danger" }))) return;

    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/users/${user.id}/status`,
        { is_active: newStatus },
        { headers: getAuthHeader() }
      );
      fetchUsers();
      alert(`User account ${newStatus ? "enabled" : "disabled"} successfully`);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update user status");
    }
  };

  const handleDeleteUser = async (user) => {
    if (!(await showAppConfirm(`Are you sure you want to permanently delete ${user.name}? This action cannot be undone.`, { confirmText: "Delete User", tone: "danger" }))) {
      return;
    }

    try {
      await axios.delete(
        `http://localhost:5000/api/dashboard/users/${user.id}`,
        { headers: getAuthHeader() }
      );
      fetchUsers();
      alert("User deleted successfully");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete user");
    }
  };

  return (
    <>
      <div className="dashboard-header">
        <h1>All Users</h1>
      </div>

      {error && <div className="dashboard-error">{error}</div>}
      {loading && <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: 16 }}>Loading users...</div>}

        <div className="filter-section">
          <div className="filter-group">
            <label>Filter by Role:</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="annotator">Annotator</option>
              <option value="tester">Tester</option>
              <option value="admin">Admin</option>
              <option value="melbourne_user">Melbourne User</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

      <div className="table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th style={{ width: "10%" }}>Profile</th>
              <th style={{ width: "20%" }}>Name</th>
              <th style={{ width: "25%" }}>Email</th>
              <th style={{ width: "15%" }}>Role</th>
              <th style={{ width: "10%" }}>Status</th>
              <th style={{ width: "20%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="user-id-cell">
                    <div className="user-id-avatar">
                      {getProfileSrc(user.profile_picture) ? (
                        <img
                          src={getProfileSrc(user.profile_picture)}
                          alt={user.name || "User"}
                          className="user-id-avatar-img"
                        />
                      ) : (
                        <span>{getAvatarText(user.name)}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className="role-badge">{user.role}</span>
                </td>
                <td>
                  <span className={`status-badge ${user.is_active ? "status-active" : "status-inactive"}`}>
                    {user.is_active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td>
                  <button 
                    className="btn-edit" 
                    title="Edit User"
                    onClick={() => handleEditClick(user)}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    className={`btn-toggle ${user.is_active ? "btn-disable" : "btn-enable"}`}
                    title={user.is_active ? "Disable Account" : "Enable Account"}
                    onClick={() => handleToggleStatus(user)}
                  >
                    {user.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                  </button>
                  <button 
                    className="btn-delete" 
                    title="Delete User"
                    onClick={() => handleDeleteUser(user)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit User</h2>
            
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Full Name"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="Email Address"
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              >
                <option value="annotator">Annotator</option>
                <option value="tester">Tester</option>
                <option value="admin">Admin</option>
                <option value="melbourne_user">Melbourne User</option>
              </select>
            </div>

            {editForm.role === "admin" && (
              <div className="form-group">
                <label>Hourly Rate (₨)</label>
                <input
                  type="number"
                  value={editForm.hourly_rate}
                  onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })}
                  placeholder="e.g., 1000"
                  min="0"
                  step="0.01"
                />
              </div>
            )}

            {editForm.role === "annotator" && (
              <div className="form-group">
                <label>Annotator Rate (₨ per object)</label>
                <input
                  type="number"
                  value={editForm.annotator_rate}
                  onChange={(e) => setEditForm({ ...editForm, annotator_rate: e.target.value })}
                  placeholder="e.g., 5"
                  min="0"
                  step="0.01"
                />
              </div>
            )}

            {editForm.role === "tester" && (
              <div className="form-group">
                <label>Tester Rate (₨ per object)</label>
                <input
                  type="number"
                  value={editForm.tester_rate}
                  onChange={(e) => setEditForm({ ...editForm, tester_rate: e.target.value })}
                  placeholder="e.g., 3"
                  min="0"
                  step="0.01"
                />
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleEditSubmit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
