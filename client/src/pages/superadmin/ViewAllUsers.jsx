import { useState, useEffect } from "react";
import axios from "axios";
import { Edit2, Trash2, UserX, UserCheck } from "lucide-react";
import Sidebar from "./Sidebar";
import "./superadmin.css";

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

    if (!confirm(confirmMsg)) return;

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
    if (!confirm(`Are you sure you want to permanently delete ${user.name}? This action cannot be undone.`)) {
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

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>All Users</h1>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

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
                    <div className="user-avatar">{user.name?.charAt(0).toUpperCase()}</div>
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
    </div>
  );
}
