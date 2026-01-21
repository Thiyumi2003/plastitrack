import { useState, useEffect } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import "./admin.css";

export default function ManageImages() {
  const [images, setImages] = useState([]);
  const [users, setUsers] = useState({ annotators: [], testers: [], melbourneUsers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newImageName, setNewImageName] = useState("");
  const [newImageSize, setNewImageSize] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [imagesRes, usersRes] = await Promise.all([
        axios.get("http://localhost:5000/api/dashboard/admin/images", { headers: getAuthHeader() }),
        axios.get("http://localhost:5000/api/dashboard/admin/users-filtered", { headers: getAuthHeader() }),
      ]);
      console.log("Admin manage images - Fetched data:", imagesRes.data);
      setImages(imagesRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error("Admin manage images error:", err);
      setError(err.response?.data?.error || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAnnotator = async (imageId, userId) => {
    if (!userId) return;
    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/admin/images/${imageId}/assign`,
        { annotatorId: userId, status: "in_progress" },
        { headers: getAuthHeader() }
      );
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to assign annotator");
    }
  };

  const handleAssignTester = async (imageId, userId) => {
    if (!userId) return;
    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/admin/images/${imageId}/assign`,
        { testerId: userId },
        { headers: getAuthHeader() }
      );
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to assign tester");
    }
  };

  const handleSendToMelbourne = async (imageId, userId) => {
    if (!userId) return;
    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/admin/images/${imageId}/assign`,
        { melbourneUserId: userId, status: "approved" },
        { headers: getAuthHeader() }
      );
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to send to Melbourne");
    }
  };

  const handleAddImage = async () => {
    if (!newImageName.trim()) {
      alert("Please enter an image name");
      return;
    }

    const fileSizeMB = Number(newImageSize) || 0;

    try {
      await axios.post(
        "http://localhost:5000/api/dashboard/admin/images/add",
        { filename: newImageName.trim(), fileSizeMB },
        { headers: getAuthHeader() }
      );
      setShowUploadModal(false);
      setNewImageName("");
      setNewImageSize("");
      fetchData();
      alert("Image added successfully");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add image");
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: "Pending", class: "status-pending" },
      in_progress: { label: "In Progress", class: "status-progress" },
      completed: { label: "Completed", class: "status-completed" },
      approved: { label: "Approved", class: "status-approved" },
      rejected: { label: "Rejected", class: "status-rejected" },
    };
    const s = statusMap[status] || { label: status, class: "" };
    return <span className={`status-badge ${s.class}`}>{s.label}</span>;
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Admin Manage Images</h1>
          <button className="btn-primary" onClick={() => setShowUploadModal(true)}>
            + Add Image
          </button>
        </div>

        {error && <div style={{ padding: "12px", backgroundColor: "#fee2e2", borderLeft: "4px solid #ef4444", color: "#991b1b", marginBottom: "20px", borderRadius: "4px" }}>{error}</div>}

        <div className="images-grid">
          {images.map((img) => (
            <div key={img.id} className="image-card">
              <div className="image-icon">📷</div>
              <div className="image-info">
                <h3>{img.image_name || img.filename || "Unnamed"}</h3>
                <div className="image-meta">
                  <span>
                    {img.file_size ? (img.file_size / (1024 * 1024)).toFixed(1) : "-"}MB
                  </span>
                  <span>
                    {img.uploaded_at
                      ? new Date(img.uploaded_at).toLocaleDateString()
                      : img.created_at
                      ? new Date(img.created_at).toLocaleDateString()
                      : ""}
                  </span>
                </div>
              </div>
              <div className="image-status">{getStatusBadge(img.status)}</div>

              {img.status === "pending" && (
                <div className="image-actions">
                  <select
                    className="assign-select"
                    onChange={(e) => handleAssignAnnotator(img.id, e.target.value)}
                    defaultValue=""
                  >
                    <option value="">Assign Annotator...</option>
                    {users.annotators.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {img.status === "in_progress" && (
                <div className="assigned-info">
                  <div className="assigned-user">📝 Annotator: {img.annotator_name}</div>
                </div>
              )}

              {img.status === "completed" && (
                <>
                  <div className="assigned-info">
                    <div className="assigned-user">📝 Annotator: {img.annotator_name}</div>
                  </div>
                  <div className="image-actions">
                    <select
                      className="assign-select"
                      onChange={(e) => handleAssignTester(img.id, e.target.value)}
                      defaultValue=""
                    >
                      <option value="">Assign Tester...</option>
                      {users.testers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {img.status === "approved" && (
                <>
                  <div className="assigned-info">
                    <div className="assigned-user">📝 Annotator: {img.annotator_name}</div>
                    <div className="assigned-user">✓ Approved by: {img.tester_name}</div>
                  </div>
                  {img.feedback && (
                    <div className="feedback-box">
                      <strong>Feedback:</strong>
                      <p>{img.feedback}</p>
                    </div>
                  )}
                  <div className="image-actions">
                    <select
                      className="assign-select"
                      onChange={(e) => handleSendToMelbourne(img.id, e.target.value)}
                      defaultValue=""
                    >
                      <option value="">Send Melbourn...</option>
                      {users.melbourneUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {showUploadModal && (
          <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Add Image (name only)</h2>
              <label className="input-label">Image name</label>
              <input
                type="text"
                value={newImageName}
                onChange={(e) => setNewImageName(e.target.value)}
                className="text-input"
                placeholder="e.g. PET_01_9001_9200"
              />
              <label className="input-label">File size (MB, optional)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={newImageSize}
                onChange={(e) => setNewImageSize(e.target.value)}
                className="text-input"
                placeholder="e.g. 2.4"
              />
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleAddImage}>
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
