import { useState, useEffect } from "react";
import axios from "axios";
import "../annotator/annotator.css";

export default function MelbourneManageImages() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedImage, setSelectedImage] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    status: "",
    feedback: ""
  });
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:5000/api/dashboard/admin/images", {
        headers: getAuthHeader(),
      });
      console.log("Images data:", response.data); // Debug log
      setImages(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load images");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredImages = filterStatus === "all" 
    ? images 
    : images.filter(img => img.status === filterStatus);

  const handleViewDetails = (image) => {
    setSelectedImage(image);
    setReviewForm({ status: "", feedback: "" });
    setShowDetailsModal(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewForm.status) {
      alert("Please select an action (Approve or Reject)");
      return;
    }

    try {
      setSubmitting(true);
      await axios.put(
        `http://localhost:5000/api/dashboard/melbourne/datasets/${selectedImage.id}/review`,
        {
          status: reviewForm.status,
          feedback: reviewForm.feedback.trim() || null
        },
        { headers: getAuthHeader() }
      );

      alert(`Dataset ${reviewForm.status === "approved" ? "approved" : "rejected"} successfully`);
      setShowDetailsModal(false);
      fetchImages();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="dashboard-header">
        <h1>Dataset Management</h1>
        <div className="header-date">{new Date().toLocaleDateString()}</div>
      </div>

      {error && <div className="dashboard-error">{error}</div>}
      {loading && <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: 16 }}>Loading images...</div>}

        {/* Filter Section */}
        <div className="filter-section">
          <button
            className={`filter-btn ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            All ({images.length})
          </button>
          <button
            className={`filter-btn ${filterStatus === "pending" ? "active" : ""}`}
            onClick={() => setFilterStatus("pending")}
          >
            Pending ({images.filter(i => i.status === "pending").length})
          </button>
          <button
            className={`filter-btn ${filterStatus === "in_progress" ? "active" : ""}`}
            onClick={() => setFilterStatus("in_progress")}
          >
            In Progress ({images.filter(i => i.status === "in_progress").length})
          </button>
          <button
            className={`filter-btn ${filterStatus === "completed" ? "active" : ""}`}
            onClick={() => setFilterStatus("completed")}
          >
            Completed ({images.filter(i => i.status === "completed").length})
          </button>
          <button
            className={`filter-btn ${filterStatus === "approved" ? "active" : ""}`}
            onClick={() => setFilterStatus("approved")}
          >
            Approved ({images.filter(i => i.status === "approved").length})
          </button>
          <button
            className={`filter-btn ${filterStatus === "rejected" ? "active" : ""}`}
            onClick={() => setFilterStatus("rejected")}
          >
            Rejected ({images.filter(i => i.status === "rejected").length})
          </button>
        </div>

        {/* Images Table */}
      <div className="tasks-section">
        <h2>Images</h2>
        <div className="table-container">
          <table className="tasks-table">
            <thead>
              <tr>
                <th>DATASET NAME</th>
                <th>ADMIN NAME</th>
                <th>ANNOTATOR</th>
                <th>TESTER</th>
                <th>STATUS</th>
                <th>CREATED DATE</th>
                <th>DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {filteredImages.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">
                    No images found
                  </td>
                </tr>
              ) : (
                filteredImages.map((image) => (
                  <tr key={image.id}>
                    <td><strong>{image.image_name || image.name || "-"}</strong></td>
                    <td><strong>{image.admin_name || "-"}</strong></td>
                    <td>{image.annotator_name || "-"}</td>
                    <td>{image.tester_name || "-"}</td>
                    <td>
                      <span
                        className={`status-badge status-${image.status?.replace("_", "-")}`}
                      >
                        {image.status === "in_progress"
                          ? "In Progress"
                          : image.status === "pending_review"
                          ? "Pending Review"
                          : image.status?.charAt(0).toUpperCase() + image.status?.slice(1)}
                      </span>
                    </td>
                    <td>{new Date(image.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="action-btn"
                        onClick={() => handleViewDetails(image)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedImage && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Image Set Details - #{selectedImage.id}</h2>

            {/* User Assignment Section */}
            <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f5f5f5", borderRadius: "6px", border: "1px solid #ddd" }}>
              <h3 style={{ marginTop: 0, marginBottom: "15px", fontSize: "16px", color: "#333" }}>User Assignment</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px" }}>
                <div style={{ padding: "12px", backgroundColor: "white", borderRadius: "6px", borderLeft: "4px solid #667eea" }}>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", fontWeight: "600" }}>ADMIN NAME</div>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: "#333" }}>{selectedImage.admin_name || "Not Assigned"}</div>
                </div>
                <div style={{ padding: "12px", backgroundColor: "white", borderRadius: "6px", borderLeft: "4px solid #10b981" }}>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", fontWeight: "600" }}>ANNOTATOR NAME</div>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: "#333" }}>{selectedImage.annotator_name || "Not Assigned"}</div>
                </div>
                <div style={{ padding: "12px", backgroundColor: "white", borderRadius: "6px", borderLeft: "4px solid #f59e0b" }}>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", fontWeight: "600" }}>TESTER NAME</div>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: "#333" }}>{selectedImage.tester_name || "Not Assigned"}</div>
                </div>
              </div>
            </div>

            {/* Image Details */}
            <div className="modal-info">
              <div className="info-grid">
                <div className="info-item">
                  <strong>Dataset Name:</strong>
                  <span>{selectedImage.image_name || selectedImage.name || "-"}</span>
                </div>
                <div className="info-item">
                  <strong>Status:</strong>
                  <span className={`status-badge status-${selectedImage.status?.replace("_", "-")}`}>
                    {selectedImage.status === "in_progress"
                      ? "In Progress"
                      : selectedImage.status === "pending_review"
                      ? "Pending Review"
                      : selectedImage.status?.charAt(0).toUpperCase() + selectedImage.status?.slice(1)}
                  </span>
                </div>
                <div className="info-item">
                  <strong>Objects Count:</strong>
                  <span>{selectedImage.objects_count || 0}</span>
                </div>
                <div className="info-item">
                  <strong>Created Date:</strong>
                  <span>{new Date(selectedImage.created_at).toLocaleDateString()}</span>
                </div>
                <div className="info-item">
                  <strong>Created Time:</strong>
                  <span>{new Date(selectedImage.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
              {selectedImage.tester_feedback && (
                <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#f3f4f6", borderRadius: "6px", borderLeft: "4px solid #667eea" }}>
                  <strong style={{ display: "block", marginBottom: "8px" }}>Tester Feedback:</strong>
                  <p style={{ margin: 0, color: "#555" }}>{selectedImage.tester_feedback}</p>
                </div>
              )}

              {/* Melbourne Feedback */}
              {selectedImage.melbourne_feedback && (
                <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#f0fdf4", borderRadius: "6px", borderLeft: "4px solid #10b981" }}>
                  <strong style={{ display: "block", marginBottom: "8px" }}>Your Previous Feedback:</strong>
                  <p style={{ margin: 0, color: "#555" }}>{selectedImage.melbourne_feedback}</p>
                </div>
              )}
            </div>

            {/* Review Form */}
            {(selectedImage.status === "approved" || selectedImage.status === "completed") && !selectedImage.melbourne_feedback && (
              <>
                <div style={{ marginTop: "20px", borderTop: "1px solid #e5e7eb", paddingTop: "20px" }}>
                  <h3 style={{ marginTop: 0, marginBottom: "15px", color: "#333" }}>Review & Provide Feedback</h3>

                  {/* Status Options */}
                  <div className="status-options">
                    <label className={`radio-label ${reviewForm.status === "approved" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="status"
                        value="approved"
                        checked={reviewForm.status === "approved"}
                        onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                      />
                      <span>✓ Approve Dataset</span>
                    </label>

                    <label className={`radio-label ${reviewForm.status === "rejected" ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="status"
                        value="rejected"
                        checked={reviewForm.status === "rejected"}
                        onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}
                      />
                      <span>✗ Reject Dataset</span>
                    </label>
                  </div>

                  {/* Feedback Textarea */}
                  <div className="form-group">
                    <label>Feedback <span style={{ color: "#999", fontWeight: "normal" }}>(optional)</span></label>
                    <textarea
                      value={reviewForm.feedback}
                      onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                      placeholder="Add any feedback or comments (optional)..."
                      rows={5}
                      style={{ width: "100%", padding: "10px", fontSize: "14px", fontFamily: "inherit", borderRadius: "4px", border: "1px solid #ddd" }}
                    />
                  </div>

                  {/* Modal Actions */}
                  <div className="modal-actions">
                    <button 
                      className="btn-cancel" 
                      onClick={() => setShowDetailsModal(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-save"
                      onClick={handleSubmitReview}
                      disabled={!reviewForm.status || submitting}
                    >
                      {submitting ? "Submitting..." : "Submit Review"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* View Only Mode */}
            {selectedImage.melbourne_feedback && (
              <div className="modal-actions" style={{ marginTop: "20px" }}>
                <button 
                  className="btn-cancel" 
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
