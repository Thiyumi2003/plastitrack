import { useState, useEffect } from "react";
import axios from "axios";
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
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/users-filtered`, {
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

  const getProfileSrc = (profilePicture) => {
    if (!profilePicture) return null;
    if (profilePicture.startsWith("http://") || profilePicture.startsWith("https://")) {
      return profilePicture;
    }
    if (profilePicture.startsWith("/")) {
      return `${import.meta.env.VITE_API_BASE_URL}${profilePicture}`;
    }
    return `${import.meta.env.VITE_API_BASE_URL}/${profilePicture}`;
  };

  const getAvatarText = (name) => {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  };

  return (
    <>
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
        {loading && <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: 16 }}>Loading users...</div>}

      <div className="users-table">
        <table>
            <thead>
              <tr>
                <th>PROFILE</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created At</th>
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
    </>
  );
}
