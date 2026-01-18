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
  const [uploadFile, setUploadFile] = useState(null);

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
      setImages(imagesRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load data");
      console.error("Error:", err);
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

  const handleUploadImage = async () => {
    if (!uploadFile) {
      alert("Please select an image file");
      return;
    }

    const formData = new FormData();
    formData.append("image", uploadFile);

    try {
      await axios.post("http://localhost:5000/api/dashboard/admin/images/upload", formData, {
        headers: {
          ...getAuthHeader(),
          "Content-Type": "multipart/form-data",
        },
      });
      setShowUploadModal(false);
      setUploadFile(null);
      fetchData();
      alert("Image uploaded successfully");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to upload image");
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

        {error && <div className="error-message">{error}</div>}

        <div className="images-grid">
          {images.map((img) => (
            <div key={img.id} className="image-card">
              <div className="image-icon">📷</div>
              <div className="image-info">
                <h3>{img.filename}</h3>
                <div className="image-meta">
                  <span>{(img.file_size / (1024 * 1024)).toFixed(1)}MB</span>
                  <span>{new Date(img.uploaded_at).toLocaleDateString()}</span>
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
                <div className="assigned-user">{img.annotator_name}</div>
              )}

              {img.status === "completed" && (
                <>
                  <div className="assigned-user">{img.annotator_name}</div>
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
                  <div className="assigned-user">{img.tester_name || img.annotator_name}</div>
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
              <h2>Upload Image</h2>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="file-input"
              />
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleUploadImage}>
                  Upload
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
