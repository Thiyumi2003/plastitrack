import { useState, useEffect } from "react";
import axios from "axios";
import { Edit2, Trash2 } from "lucide-react";
import Sidebar from "./Sidebar";
import "./superadmin.css";

export default function ViewAllUsers() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
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

    fetchUsers();
  }, []);

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
                <th style={{ width: "15%" }}>Status</th>
                <th style={{ width: "15%" }}>Actions</th>
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
                    <span className="status-badge status-active">Active</span>
                  </td>
                  <td>
                    <button className="btn-edit" title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button className="btn-delete" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
