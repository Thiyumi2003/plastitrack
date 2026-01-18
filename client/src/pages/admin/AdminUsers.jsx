import { useState, useEffect } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import "./admin.css";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:5000/api/dashboard/admin/users-filtered", {
        headers: getAuthHeader(),
      });
      // Combine annotators and testers
      const allUsers = [
        ...(response.data.annotators || []).map(u => ({ ...u, role: 'annotator' })),
        ...(response.data.testers || []).map(u => ({ ...u, role: 'tester' }))
      ];
      setUsers(allUsers);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load users");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = filter === "all" 
    ? users 
    : users.filter(u => u.role === filter);

  if (loading) return <div className="dashboard-loading">Loading users...</div>;

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Users (Annotators & Testers)</h1>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All ({users.length})
            </button>
            <button
              className={`filter-btn ${filter === "annotator" ? "active" : ""}`}
              onClick={() => setFilter("annotator")}
            >
              Annotators ({users.filter(u => u.role === 'annotator').length})
            </button>
            <button
              className={`filter-btn ${filter === "tester" ? "active" : ""}`}
              onClick={() => setFilter("tester")}
            >
              Testers ({users.filter(u => u.role === 'tester').length})
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge role-${user.role}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
