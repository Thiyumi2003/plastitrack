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
  const [newObjectCount, setNewObjectCount] = useState("");
  const [isObjectCountManuallySet, setIsObjectCountManuallySet] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
      const image = images.find(img => img.id === imageId);
      const isReassignment = image?.status === "rejected";
      
    try {
      const selectedUser = users.annotators.find(u => u.id.toString() === userId.toString());
      // Optimistically update UI
      setImages(images.map(img => 
        img.id === imageId 
          ? { ...img, annotator_id: userId, annotator_name: selectedUser?.name, status: "in_progress" }
          : img
      ));
      
      await axios.put(
        `http://localhost:5000/api/dashboard/admin/images/${imageId}/assign`,
        { annotatorId: userId, status: "in_progress" },
        { headers: getAuthHeader() }
      );
      
            if (isReassignment) {
              alert(`✅ Image successfully reassigned to ${selectedUser?.name}. The previous annotator will not receive payment for this work.`);
            }
      
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to assign annotator");
      fetchData();
    }
  };

  const handleAssignTester = async (imageId, userId) => {
    if (!userId) return;
    try {
      const selectedUser = users.testers.find(u => u.id.toString() === userId.toString());
      // Optimistically update UI
      setImages(images.map(img => 
        img.id === imageId 
          ? { ...img, tester_id: userId, tester_name: selectedUser?.name, status: "pending_review" }
          : img
      ));
      
      await axios.put(
        `http://localhost:5000/api/dashboard/admin/images/${imageId}/assign`,
        { testerId: userId, status: "pending_review" },
        { headers: getAuthHeader() }
      );
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to assign tester");
      fetchData();
    }
  };

  const handleSendToMelbourne = async (imageId, userId) => {
    if (!userId) return;
    try {
      const selectedUser = users.melbourneUsers.find(u => u.id.toString() === userId.toString());
      // Optimistically update UI
      setImages(images.map(img => 
        img.id === imageId 
          ? { ...img, melbourne_user_id: userId, melbourne_name: selectedUser?.name, status: "approved" }
          : img
      ));
      
      await axios.put(
        `http://localhost:5000/api/dashboard/admin/images/${imageId}/assign`,
        { melbourneUserId: userId, status: "approved" },
        { headers: getAuthHeader() }
      );
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to send to Melbourne");
      fetchData();
    }
  };

  const handleDeleteImage = async (imageId, imageName) => {
    if (!window.confirm(`Are you sure you want to delete "${imageName}"? This will also delete all related tasks.`)) {
      return;
    }

    try {
      await axios.delete(
        `http://localhost:5000/api/dashboard/admin/images/${imageId}`,
        { headers: getAuthHeader() }
      );
      fetchData();
      alert("Image and all related tasks deleted successfully");
    } catch (err) {
      console.error("Delete error:", err.response?.data || err.message);
      alert(err.response?.data?.error || "Failed to delete image: " + err.message);
    }
  };

  const handleAddImage = async () => {
    if (!newImageName.trim()) {
      alert("Please enter an image name");
      return;
    }

    // Auto-calculate object count from image name if not manually entered
    let objectCount = Number(newObjectCount) || 0;
    
    if (!objectCount) {
      objectCount = extractObjectCountFromName(newImageName);
    }

    try {
      setIsUploading(true);
      await axios.post(
        "http://localhost:5000/api/dashboard/admin/images/add",
        { 
          filename: newImageName.trim(),
          objectsCount: objectCount
        },
        { headers: getAuthHeader() }
      );
      setShowUploadModal(false);
      setNewImageName("");
      setNewObjectCount("");
      setIsObjectCountManuallySet(false);
      fetchData();
      alert("Image added successfully");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add image");
    } finally {
      setIsUploading(false);
    }
  };

  // Extract and calculate object count from image name
  // Pattern: NAME_LOWER_UPPER (e.g., PET_01_9001_9200)
  // Object count = UPPER - LOWER + 1
  const extractObjectCountFromName = (imageName) => {
    const parts = imageName.trim().split('_');
    if (parts.length >= 3) {
      const lower = parseInt(parts[parts.length - 2], 10);
      const upper = parseInt(parts[parts.length - 1], 10);
      
      if (!isNaN(lower) && !isNaN(upper) && upper >= lower) {
        return upper - lower + 1;
      }
    }
    return 0;
  };

  // Handle image name change - auto-calculate object count
  const handleImageNameChange = (e) => {
    const name = e.target.value;
    setNewImageName(name);
    
    // Auto-calculate if user hasn't manually set object count
    if (!isObjectCountManuallySet) {
      const calculatedCount = extractObjectCountFromName(name);
      if (calculatedCount > 0) {
        setNewObjectCount(calculatedCount.toString());
      } else {
        setNewObjectCount("");
      }
    }
  };

  // Handle manual object count change
  const handleObjectCountChange = (e) => {
    setNewObjectCount(e.target.value);
    setIsObjectCountManuallySet(e.target.value !== "");
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
                    {img.objects_count || "-"} objects
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
                    <div className="assigned-user">📝 Annotator: {img.annotator_name || "N/A"}</div>
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

              {img.status === "pending_review" && (
                <>
                  <div className="assigned-info">
                    <div className="assigned-user">📝 Annotator: {img.annotator_name || "N/A"}</div>
                    <div className="assigned-user" style={{ color: "#10b981", fontWeight: "bold" }}>✓ Testing by: {img.tester_name || "N/A"}</div>
                  </div>
                  {img.feedback && (
                    <div className="feedback-box">
                      <strong>Tester Feedback:</strong>
                      <p>{img.feedback}</p>
                    </div>
                  )}
                </>
              )}

              {img.status === "approved" && (
                <>
                  <div className="assigned-info">
                    <div className="assigned-user">📝 Annotator: {img.annotator_name || "N/A"}</div>
                    <div className="assigned-user">✓ Approved by: {img.tester_name || "N/A"}</div>
                    {img.melbourne_name && (
                      <div className="assigned-user" style={{ color: "#10b981", fontWeight: "bold" }}>✓ Melbourne: {img.melbourne_name}</div>
                    )}
                  </div>
                  {img.feedback && (
                    <div className="feedback-box">
                      <strong>Feedback:</strong>
                      <p>{img.feedback}</p>
                    </div>
                  )}
                  {!img.melbourne_name && (
                    <div className="image-actions">
                      <select
                        className="assign-select"
                        onChange={(e) => handleSendToMelbourne(img.id, e.target.value)}
                        defaultValue=""
                      >
                        <option value="">Send to Melbourne...</option>
                        {users.melbourneUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {img.status === "rejected" && (
                <>
                  <div className="assigned-info">
                    <div className="assigned-user">📝 Previous Annotator: {img.annotator_name || "N/A"}</div>
                    <div className="assigned-user" style={{ color: "#ef4444" }}>❌ Rejected by: {img.tester_name || "N/A"}</div>
                  </div>
                  {img.feedback && (
                    <div className="feedback-box" style={{ backgroundColor: "#fee2e2", borderColor: "#ef4444" }}>
                      <strong>Rejection Reason:</strong>
                      <p>{img.feedback}</p>
                    </div>
                  )}
                  <div className="image-actions">
                    <select
                      className="assign-select"
                      onChange={(e) => handleAssignAnnotator(img.id, e.target.value)}
                      defaultValue=""
                      style={{ borderColor: "#f59e0b", backgroundColor: "#fffbeb" }}
                    >
                      <option value="">🔄 Reassign to Annotator...</option>
                      {users.annotators.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Delete button - available for all statuses */}
              <div style={{ marginTop: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                <button 
                  className="action-btn" 
                  onClick={() => handleDeleteImage(img.id, img.image_name)}
                  style={{ backgroundColor: "#ef4444", color: "white", width: "100%", cursor: "pointer" }}
                  title="Delete this image and all related tasks"
                >
                  🗑️ Delete Image
                </button>
              </div>
            </div>
          ))}
        </div>

        {showUploadModal && (
          <div className="modal-overlay" onClick={() => {
            setShowUploadModal(false);
            setNewImageName("");
            setNewObjectCount("");
            setIsObjectCountManuallySet(false);
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Add Image</h2>
              
              <label className="input-label">Image Name *</label>
              <input
                type="text"
                value={newImageName}
                onChange={handleImageNameChange}
                className="text-input"
                placeholder="e.g. PET_01_9001_9200"
                disabled={isUploading}
              />

              <label className="input-label">Object Count * (auto-calculated from image name)</label>
              <input
                type="number"
                min="0"
                value={newObjectCount}
                onChange={handleObjectCountChange}
                className="text-input"
                placeholder="Auto-calculated from image name"
                disabled={isUploading}
              />

              <div className="modal-actions">
                <button 
                  className="btn-secondary" 
                  onClick={() => {
                    setShowUploadModal(false);
                    setNewImageName("");
                    setNewObjectCount("");
                    setIsObjectCountManuallySet(false);
                  }}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleAddImage}
                  disabled={isUploading}
                >
                  {isUploading ? "Adding..." : "Add Image"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
