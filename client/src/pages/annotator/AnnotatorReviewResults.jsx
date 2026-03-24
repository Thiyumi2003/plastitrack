import { useState, useEffect } from "react";
import axios from "axios";
import { Eye, RefreshCw, Calendar, User, MessageSquare } from "lucide-react";
import "./annotator.css";

export default function AnnotatorReviewResults() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://localhost:5000/api/dashboard/annotator/review-results",
        { headers: getAuthHeader() }
      );
      setReviews(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load review results");
    } finally {
      setLoading(false);
    }
  };

  const handleReworkTask = async (taskId) => {
    try {
      await axios.put(
        `http://localhost:5000/api/dashboard/annotator/tasks/${taskId}/rework`,
        { status: "in_progress" },
        { headers: getAuthHeader() }
      );
      fetchReviews();
      alert("Task marked for reworking. You can continue annotation.");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update task");
    }
  };

  const openFeedbackModal = (review) => {
    setSelectedReview(review);
    setShowFeedbackModal(true);
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  const summary = {
    underReview: reviews.filter((r) => r.review_status === "pending").length,
    approved: reviews.filter((r) => r.review_status === "approved").length,
    rejected: reviews.filter((r) => r.review_status === "rejected").length,
  };

  const filteredReviews =
    filter === "all"
      ? reviews
      : reviews.filter((r) => r.review_status === filter);

  return (
    <>
      <div className="dashboard-header">
        <h1>Tester Review Results</h1>
        <p>Track your submissions and tester feedback</p>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      {/* Summary Cards */}
      <div className="kpi-section">
        <div className="kpi-card">
          <div className="kpi-icon">⏳</div>
          <div className="kpi-value">{summary.underReview}</div>
          <div className="kpi-label">Under Review</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-icon">✓</div>
          <div className="kpi-value" style={{ color: "#10b981" }}>{summary.approved}</div>
          <div className="kpi-label">Approved</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #ef4444" }}>
          <div className="kpi-icon">✕</div>
          <div className="kpi-value" style={{ color: "#ef4444" }}>{summary.rejected}</div>
          <div className="kpi-label">Rejected</div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="filter-section annotator-transparent-filter">
        <button
          className={`filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All Results
        </button>
        <button
          className={`filter-btn ${filter === "pending" ? "active" : ""}`}
          onClick={() => setFilter("pending")}
        >
          Under Review
        </button>
        <button
          className={`filter-btn ${filter === "approved" ? "active" : ""}`}
          onClick={() => setFilter("approved")}
        >
          Approved
        </button>
        <button
          className={`filter-btn ${filter === "rejected" ? "active" : ""}`}
          onClick={() => setFilter("rejected")}
        >
          Rejected
        </button>
      </div>

      {/* Review Results Table */}
      <div className="table-container">
        <table className="tasks-table">
          <thead>
            <tr>
              <th>IMAGE SET</th>
              <th>TESTER</th>
              <th>STATUS</th>
              <th>REVIEW DATE</th>
              <th>FEEDBACK</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredReviews.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">
                  {filter === "all"
                    ? "No review results yet"
                    : `No ${filter} results`}
                </td>
              </tr>
            ) : (
              filteredReviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <div className="task-image-col">{review.image_set_name}</div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <User size={16} />
                      <span>{review.tester_name || "-"}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`status-badge status-${
                        review.review_status === "pending"
                          ? "pending"
                          : review.review_status === "approved"
                          ? "approved"
                          : "rejected"
                      }`}
                    >
                      {review.review_status === "pending"
                        ? "Under Review"
                        : review.review_status.charAt(0).toUpperCase() +
                          review.review_status.slice(1)}
                    </span>
                  </td>
                  <td>
                    {review.review_date ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Calendar size={14} />
                        <span>{new Date(review.review_date).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <span style={{ color: "#999" }}>-</span>
                    )}
                  </td>
                  <td>
                    {review.feedback_comments ? (
                      <button
                        className="action-btn"
                        style={{ fontSize: "12px", padding: "6px 10px" }}
                        onClick={() => openFeedbackModal(review)}
                      >
                        <MessageSquare size={14} /> View
                      </button>
                    ) : (
                      <span style={{ color: "#999" }}>No comments</span>
                    )}
                  </td>
                  <td>
                    {review.review_status === "rejected" ? (
                      <button
                        className="action-btn"
                        style={{
                          fontSize: "12px",
                          padding: "6px 10px",
                          backgroundColor: "#667eea",
                        }}
                        onClick={() => handleReworkTask(review.id)}
                      >
                        <RefreshCw size={14} /> Rework
                      </button>
                    ) : (
                      <span style={{ color: "#999" }}>-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && selectedReview && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "600px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2>Review Feedback</h2>
              <button
                onClick={() => setShowFeedbackModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#fff",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", color: "#999", fontSize: "12px", marginBottom: "4px" }}>
                IMAGE SET
              </label>
              <p style={{ margin: 0, color: "#fff", fontWeight: "600" }}>
                {selectedReview.image_set_name}
              </p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", color: "#999", fontSize: "12px", marginBottom: "4px" }}>
                TESTER
              </label>
              <p style={{ margin: 0, color: "#fff" }}>{selectedReview.tester_name}</p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", color: "#999", fontSize: "12px", marginBottom: "4px" }}>
                STATUS
              </label>
              <span
                className={`status-badge status-${
                  selectedReview.review_status === "approved"
                    ? "approved"
                    : "rejected"
                }`}
              >
                {selectedReview.review_status.charAt(0).toUpperCase() +
                  selectedReview.review_status.slice(1)}
              </span>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#999", fontSize: "12px", marginBottom: "8px" }}>
                FEEDBACK COMMENTS
              </label>
              <div
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: "8px",
                  padding: "16px",
                  color: "#fff",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  minHeight: "120px",
                }}
              >
                {selectedReview.feedback_comments || "No feedback provided"}
              </div>
            </div>

            {selectedReview.review_status === "rejected" && (
              <button
                className="action-btn"
                style={{
                  width: "100%",
                  backgroundColor: "#667eea",
                  padding: "12px 16px",
                  fontSize: "14px",
                }}
                onClick={() => {
                  handleReworkTask(selectedReview.id);
                  setShowFeedbackModal(false);
                }}
              >
                <RefreshCw size={16} style={{ marginRight: "8px" }} />
                Rework This Task
              </button>
            )}

            <button
              onClick={() => setShowFeedbackModal(false)}
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "12px 16px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#fff",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
