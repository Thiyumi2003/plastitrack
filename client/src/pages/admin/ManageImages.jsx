import { useState, useEffect } from "react";
import axios from "axios";
import { showAppConfirm } from "../../utils/appMessages";
import "./admin.css";

export default function ManageImages() {
  const [images, setImages] = useState([]);
  const [users, setUsers] = useState({ annotators: [], testers: [], melbourneUsers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsMode, setDetailsMode] = useState("details");
  const [selectedImageDetails, setSelectedImageDetails] = useState(null);
  const [imageHistory, setImageHistory] = useState([]);
  const [userProfileMap, setUserProfileMap] = useState({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [reassigningImageId, setReassigningImageId] = useState(null);
  const [newImageName, setNewImageName] = useState("");
  const [newObjectCount, setNewObjectCount] = useState("");
  const [isObjectCountManuallySet, setIsObjectCountManuallySet] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [annotatorFilter, setAnnotatorFilter] = useState("all");
  const [testerFilter, setTesterFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

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
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/images`, { headers: getAuthHeader() }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/users-filtered`, { headers: getAuthHeader() }),
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
      
      // Get tester name from image OR look it up from users testers array
      let testerNameForHistory = image?.tester_name;
      if (!testerNameForHistory && image?.tester_id && users.testers) {
        testerNameForHistory = users.testers.find(t => t.id === image.tester_id)?.name;
      }
      
      // Optimistically update UI - PRESERVE rejection history while reassigning
      setImages(images.map(img => 
        img.id === imageId 
          ? { 
              ...img, 
              annotator_id: userId, 
              annotator_name: selectedUser?.name, 
              status: "in_progress",
              // Preserve rejection history if this was a rejected image
              previous_tester_name: isReassignment ? testerNameForHistory : img.previous_tester_name,
              previous_feedback: isReassignment ? img.tester_feedback : img.previous_feedback,
              previous_rejected_at: isReassignment ? new Date().toISOString() : img.previous_rejected_at
            }
          : img
      ));
      
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/images/${imageId}/assign`,
        { 
          annotatorId: userId, 
          status: "in_progress",
          // Send rejection history to backend if this was a reassignment
          ...(isReassignment && {
            previous_tester_name: testerNameForHistory || image?.tester_name,
            previous_feedback: image?.tester_feedback
          })
        },
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
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/images/${imageId}/assign`,
        { testerId: userId, status: "pending_review" },
        { headers: getAuthHeader() }
      );
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to assign tester");
      fetchData();
    }
  };

  const handleApproveRework = async (imageId) => {
    try {
      const image = images.find((img) => img.id === imageId);
      if (!image?.annotator_id) {
        alert("No annotator assigned to approve rework.");
        return;
      }

      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/images/${imageId}/approve-rework`,
        { annotatorId: image.annotator_id },
        { headers: getAuthHeader() }
      );

      alert("Rework approved for the same annotator.");
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to approve rework");
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
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/images/${imageId}/assign`,
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
    if (!(await showAppConfirm(`Are you sure you want to delete "${imageName}"? This will also delete all related tasks.`, { confirmText: "Delete Image", tone: "danger" }))) {
      return;
    }

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/images/${imageId}`,
        { headers: getAuthHeader() }
      );
      fetchData();
      alert("Image and all related tasks deleted successfully");
    } catch (err) {
      console.error("Delete error:", err.response?.data || err.message);
      alert(err.response?.data?.error || "Failed to delete image: " + err.message);
    }
  };

  const parseEventDetails = (details) => {
    if (!details) return {};
    try {
      return JSON.parse(details);
    } catch {
      return { raw: details };
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const getTimelineLabel = (eventType) => {
    const map = {
      created: "Created",
      assigned_to_annotator: "Assigned to annotator",
      annotation_completed: "Annotation completed",
      rework_requested: "Rework requested",
      rework_approved: "Rework approved",
      assigned_to_tester: "Sent for review",
      reviewed: "Reviewed",
      rejected: "Rejected",
      reassigned: "Reassigned",
      approved: "Approved",
      sent_to_melbourne: "Sent to Melbourne",
    };
    return map[eventType] || eventType;
  };

  const getLatestHistoryDetails = (eventType) => {
    if (!Array.isArray(imageHistory) || imageHistory.length === 0) return null;
    const event = [...imageHistory].reverse().find((item) => item.event_type === eventType);
    return event ? parseEventDetails(event.details) : null;
  };

  const getAnnotationHistory = () => {
    if (!Array.isArray(imageHistory) || imageHistory.length === 0) return [];
    const assignments = imageHistory.filter(
      (item) => item.event_type === "assigned_to_annotator" || item.event_type === "reassigned"
    );
    return assignments.map((assignment) => {
      const details = parseEventDetails(assignment.details);
      const annotatorName = details.reassignedTo || details.annotatorName || assignment.actor_name;
      
      // Find completion event for this annotator
      const completionEvent = imageHistory.find(
        (item) => item.event_type === "annotation_completed" && 
        new Date(item.created_at) > new Date(assignment.created_at)
      );
      
      return {
        annotatorName,
        assignedDate: assignment.created_at,
        completedDate: completionEvent?.created_at || null,
        status: completionEvent ? "Completed" : "In Progress"
      };
    });
  };

  const getReassignmentHistory = () => {
    if (!Array.isArray(imageHistory) || imageHistory.length === 0) return [];
    return imageHistory.filter(
      (item) => item.event_type === "rejected" || item.event_type === "reassigned"
    ).map((event) => {
      const details = parseEventDetails(event.details);
      return {
        date: event.created_at,
        action: event.event_type === "rejected" 
          ? `Rejected by ${details.rejectedBy || event.actor_name}` 
          : `Reassigned to ${details.reassignedTo || "annotator"}`,
        details: details
      };
    });
  };

  const getAvatarText = (name) => {
    if (!name) return "?";
    const normalized = String(name).trim().toLowerCase();
    if (normalized.includes("not assign")) return "?";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  };

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

  const findProfilePictureByName = (userList, name) => {
    if (!Array.isArray(userList) || !name) return null;
    const target = String(name).trim().toLowerCase();
    const user = userList.find((u) => String(u.name || "").trim().toLowerCase() === target);
    return user?.profile_picture || null;
  };

  const findProfilePictureByNameInAllUsers = (name) => {
    if (!name) return null;
    
    // First check userProfileMap from the details endpoint (most reliable)
    if (userProfileMap) {
      // Try exact match first
      if (userProfileMap[name]) {
        return userProfileMap[name];
      }
      // Try lowercase match
      if (userProfileMap[name.toLowerCase()]) {
        return userProfileMap[name.toLowerCase()];
      }
    }
    
    // Fallback: Search in all user lists
    const allUsers = [
      ...(users.annotators || []),
      ...(users.testers || []),
      ...(users.melbourneUsers || [])
    ];
    return findProfilePictureByName(allUsers, name);
  };

  const openImageDetails = async (imageId, mode = "details") => {
    try {
      setIsLoadingDetails(true);
      setDetailsMode(mode);
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/images/${imageId}/details`,
        { headers: getAuthHeader() }
      );
      setSelectedImageDetails(data.image);
      setImageHistory(data.history || []);
      setUserProfileMap(data.userProfileMap || {});
      console.log('Image details loaded:', data);
      console.log('User profile map:', data.userProfileMap);
      setShowDetailsModal(true);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to load image details");
    } finally {
      setIsLoadingDetails(false);
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
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/images/add`,
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

  // Filter and search logic
  const filteredImages = images.filter((img) => {
    // Search filter
    const matchesSearch = !searchQuery || 
      (img.image_name || img.filename || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "all" || img.status === statusFilter;
    
    // Annotator filter
    const matchesAnnotator = annotatorFilter === "all" || 
      img.annotator_id?.toString() === annotatorFilter;
    
    // Tester filter
    const matchesTester = testerFilter === "all" || 
      img.tester_id?.toString() === testerFilter;
    
    // Owner filter (current admin's uploads)
    const currentUserId = JSON.parse(localStorage.getItem("user") || "{}").id;
    const matchesOwner = ownerFilter === "all" || 
      (ownerFilter === "yours" && img.admin_id?.toString() === currentUserId?.toString());
    
    return matchesSearch && matchesStatus && matchesAnnotator && matchesTester && matchesOwner;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredImages.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedImages = filteredImages.slice(startIndex, endIndex);

  const latestReassignedDetails = getLatestHistoryDetails("reassigned") || {};
  const latestRejectedDetails = getLatestHistoryDetails("rejected") || {};
  const previousAnnotatorFromHistory =
    latestReassignedDetails.previousAnnotator ||
    latestRejectedDetails.previousAnnotator ||
    null;
  const rejectedByFromHistory =
    latestReassignedDetails.rejectedBy ||
    latestRejectedDetails.rejectedBy ||
    selectedImageDetails?.previous_tester_name ||
    null;
  const rejectionReasonFromHistory =
    latestReassignedDetails.rejectionReason ||
    latestRejectedDetails.rejectionReason ||
    selectedImageDetails?.previous_feedback ||
    selectedImageDetails?.tester_feedback ||
    null;

  const previousAnnotatorProfileFromEvent =
    latestReassignedDetails.previousAnnotatorProfilePicture ||
    latestRejectedDetails.previousAnnotatorProfilePicture ||
    null;

  const rejectedByProfileFromEvent =
    latestReassignedDetails.rejectedByProfilePicture ||
    latestRejectedDetails.rejectedByProfilePicture ||
    selectedImageDetails?.previous_tester_profile_picture ||
    null;

  const previousAnnotatorProfileFromHistory =
    previousAnnotatorProfileFromEvent ||
    findProfilePictureByNameInAllUsers(previousAnnotatorFromHistory) ||
    (previousAnnotatorFromHistory && previousAnnotatorFromHistory === selectedImageDetails?.annotator_name
      ? selectedImageDetails?.annotator_profile_picture
      : null);

  const rejectedByProfileFromHistory =
    rejectedByProfileFromEvent ||
    findProfilePictureByNameInAllUsers(rejectedByFromHistory) ||
    selectedImageDetails?.previous_tester_profile_picture ||
    (rejectedByFromHistory && rejectedByFromHistory === selectedImageDetails?.tester_name
      ? selectedImageDetails?.tester_profile_picture
      : null);

  const shouldShowRejectionDetails = Boolean(
    selectedImageDetails?.status === "rejected" ||
    rejectionReasonFromHistory ||
    rejectedByFromHistory ||
    previousAnnotatorFromHistory ||
    selectedImageDetails?.previous_feedback ||
    selectedImageDetails?.previous_tester_name
  );

  const currentStatus = selectedImageDetails?.status;
  const hasActiveAnnotator = currentStatus !== "rejected" && Boolean(selectedImageDetails?.annotator_id);
  const hasActiveTester =
    (currentStatus === "pending_review" || currentStatus === "approved") &&
    Boolean(selectedImageDetails?.tester_id);

  // Debug logging
  if (showDetailsModal && selectedImageDetails) {
    console.log('previousAnnotatorFromHistory name:', previousAnnotatorFromHistory);
    console.log('previousAnnotatorProfileFromHistory:', previousAnnotatorProfileFromHistory);
    console.log('rejectedByFromHistory name:', rejectedByFromHistory);
    console.log('rejectedByProfileFromHistory:', rejectedByProfileFromHistory);
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, annotatorFilter, testerFilter, ownerFilter]);

  return (
    <>
      <div className="dashboard-header">
        <h1>Admin Manage Images</h1>
        <button className="btn-primary" onClick={() => setShowUploadModal(true)}>
          + Add Image
        </button>
      </div>

        {loading && <div style={{ color: "rgba(255,255,255,0.72)", marginBottom: 16 }}>Loading images...</div>}

        {error && <div style={{ padding: "12px", backgroundColor: "#fee2e2", borderLeft: "4px solid #ef4444", color: "#991b1b", marginBottom: "20px", borderRadius: "4px" }}>{error}</div>}

        {/* Search and Filter Section */}
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filters-row">
            <div className="filter-group">
              <label>Admin:</label>
              <select 
                value={ownerFilter} 
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="yours">Yours</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Status:</label>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Annotator:</label>
              <select 
                value={annotatorFilter} 
                onChange={(e) => setAnnotatorFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All</option>
                {users.annotators.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Tester:</label>
              <select 
                value={testerFilter} 
                onChange={(e) => setTesterFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All</option>
                {users.testers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="results-info">
            Showing {paginatedImages.length} of {filteredImages.length} image(s)
          </div>
        </div>

        <div className="images-grid">
          {paginatedImages.map((img) => (
            <div key={img.id} className="image-card">
              {(() => {
                const hasPreviousRejection = Boolean(img.previous_tester_name || img.previous_feedback);
                return hasPreviousRejection ? (
                  <div className="previous-rejected-inline">
                    <span className="status-badge status-previous-rejected">Previous Rejected</span>
                  </div>
                ) : null;
              })()}

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

              {img.status === "rejected" ? (
                <div className="card-action-row">
                  <button
                    className="action-btn"
                    onClick={() => openImageDetails(img.id, "rejection")}
                  >
                    View Rejection
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => handleApproveRework(img.id)}
                  >
                    Approve Rework
                  </button>
                  <button
                    className="action-btn warning"
                    onClick={() => setReassigningImageId(reassigningImageId === img.id ? null : img.id)}
                  >
                    Reassign
                  </button>
                </div>
              ) : (
                <div className="card-action-row">
                  <button
                    className="action-btn"
                    onClick={() => openImageDetails(img.id, "details")}
                  >
                    View Details
                  </button>
                </div>
              )}

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
                  
                  {/* Show rejection history if this was a reassignment after rejection */}
                  {img.previous_tester_name && (
                    <div className="rejection-history">
                      <div className="assigned-user" style={{ color: "#ef4444", marginTop: "10px" }}>❌ Previous rejected by: {img.previous_tester_name}</div>
                      {img.previous_feedback && (
                        <div className="feedback-box" style={{ backgroundColor: "#fee2e2", borderColor: "#ef4444", marginTop: "8px" }}>
                          <strong>Previous Rejection Reason:</strong>
                          <p style={{ color: "#111827" }}>{img.previous_feedback}</p>
                        </div>
                      )}
                      <div style={{ color: "#10b981", fontSize: "0.85rem", marginTop: "8px", padding: "8px", backgroundColor: "rgba(16, 185, 129, 0.1)", borderRadius: "4px" }}>✅ Reassigned for rework</div>
                    </div>
                  )}
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
                  {img.tester_feedback && (
                    <div className="feedback-box">
                      <strong>Tester Feedback:</strong>
                      <p>{img.tester_feedback}</p>
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
                  {img.melbourne_user_feedback && (
                    <div className="feedback-box">
                      <strong>Melbourne Feedback:</strong>
                      <p>{img.melbourne_user_feedback}</p>
                    </div>
                  )}
                  {img.tester_feedback && !img.melbourne_user_feedback && (
                    <div className="feedback-box">
                      <strong>Tester Feedback:</strong>
                      <p>{img.tester_feedback}</p>
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
                    <div className="assigned-user">📝 Last Annotator: {img.annotator_name || "N/A"}</div>
                    <div className="assigned-user" style={{ color: "#ef4444" }}>❌ Rejected by Tester: {img.tester_name || img.previous_tester_name || "N/A"}</div>
                    <div className="assigned-user" style={{ color: "#f59e0b" }}>🔄 Current Annotator: Not assigned yet (reassign required)</div>
                  </div>
                  {img.tester_feedback && (
                    <div className="feedback-box" style={{ backgroundColor: "#fee2e2", borderColor: "#ef4444" }}>
                      <strong>Rejection Reason:</strong>
                      <p style={{ color: "#111827" }}>{img.tester_feedback}</p>
                    </div>
                  )}
                  {reassigningImageId === img.id && (
                    <div className="image-actions">
                      <select
                        className="assign-select"
                        onChange={(e) => handleAssignAnnotator(img.id, e.target.value)}
                        defaultValue=""
                        style={{
                          borderColor: "rgba(245, 158, 11, 0.6)",
                          backgroundColor: "rgba(15, 23, 42, 0.75)",
                          color: "rgba(255, 255, 255, 0.9)"
                        }}
                      >
                        <option value="">🔄 Reassign to Annotator...</option>
                        {users.annotators.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
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

        {filteredImages.length === 0 && (
          <div className="no-results">
            <p>No images found matching your filters.</p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn" 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            
            <div className="pagination-numbers">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      className={`pagination-number ${
                        page === currentPage ? "active" : ""
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="pagination-ellipsis">...</span>;
                }
                return null;
              })}
            </div>
            
            <button 
              className="pagination-btn" 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}

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

        {showDetailsModal && (
          <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="modal-content details-modal" onClick={(e) => e.stopPropagation()}>
              <div className="details-modal-header">
                <h2 className="details-title">Image Set Details</h2>
                <button className="btn-secondary details-close-btn" onClick={() => setShowDetailsModal(false)}>
                  ✕ Close
                </button>
              </div>

              {isLoadingDetails ? (
                <p>Loading details...</p>
              ) : selectedImageDetails ? (
                <>
                  {/* Image Information */}
                  <div className="details-section basic-info-section">
                    <h3>Image Information</h3>
                    <div className="detail-row">
                      <span className="detail-label">Image Set Name:</span>
                      <span className="detail-value">{selectedImageDetails.image_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Total Images:</span>
                      <span className="detail-value">{selectedImageDetails.objects_count || "N/A"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Status:</span>
                      <span className={`status-badge status-${selectedImageDetails.status}`}>
                        {selectedImageDetails.status?.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Admin Information */}
                  <div className="details-section">
                    <h3>Admin Information</h3>
                    <div className="detail-row">
                      <span className="detail-label">Assigned By (Admin):</span>
                      <span className="detail-value">{selectedImageDetails.admin_name || "-"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Assigned Date:</span>
                      <span className="detail-value">
                        {selectedImageDetails.assignment_date
                          ? new Date(selectedImageDetails.assignment_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Current Assignment */}
                  <div className="details-section">
                    <h3>Current Assignment</h3>
                    <div className="user-assignment-row">
                      <div className="user-card">
                        <div className="user-card-avatar">
                          {hasActiveAnnotator && getProfileSrc(selectedImageDetails.annotator_profile_picture) ? (
                            <img
                              src={getProfileSrc(selectedImageDetails.annotator_profile_picture)}
                              alt={selectedImageDetails.annotator_name || "Annotator"}
                              className="avatar-img"
                            />
                          ) : (
                            <div className="avatar-placeholder">
                              {getAvatarText(hasActiveAnnotator ? selectedImageDetails.annotator_name : "Not assigned")}
                            </div>
                          )}
                        </div>
                        <div className="user-card-info">
                          <div className="user-card-name">
                            {hasActiveAnnotator ? (selectedImageDetails.annotator_name || "Not assigned") : "Not assigned"}
                          </div>
                          <div className="user-card-label">Current Annotator</div>
                        </div>
                      </div>
                      <div className="user-card">
                        <div className="user-card-avatar">
                          {hasActiveTester && getProfileSrc(selectedImageDetails.tester_profile_picture) ? (
                            <img
                              src={getProfileSrc(selectedImageDetails.tester_profile_picture)}
                              alt={selectedImageDetails.tester_name || "Tester"}
                              className="avatar-img"
                            />
                          ) : (
                            <div className="avatar-placeholder">
                              {getAvatarText(hasActiveTester ? selectedImageDetails.tester_name : "Not assigned")}
                            </div>
                          )}
                        </div>
                        <div className="user-card-info">
                          <div className="user-card-name">
                            {hasActiveTester ? (selectedImageDetails.tester_name || "Not assigned") : "Not assigned"}
                          </div>
                          <div className="user-card-label">Assigned Tester</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rejection Details (If Rejected) */}
                  {shouldShowRejectionDetails && (
                    <div className="details-section rejection-details-section">
                      <h3>Rejection Details</h3>
                      
                      <div className="user-assignment-row">
                        <div className="user-card">
                          <div className="user-card-avatar">
                            {getProfileSrc(rejectedByProfileFromHistory) ? (
                              <img
                                src={getProfileSrc(rejectedByProfileFromHistory)}
                                alt={selectedImageDetails.tester_name || "Tester"}
                                className="avatar-img"
                              />
                            ) : (
                              <div className="avatar-placeholder">{getAvatarText(rejectedByFromHistory || selectedImageDetails.tester_name)}</div>
                            )}
                          </div>
                          <div className="user-card-info">
                            <div className="user-card-name">{rejectedByFromHistory || selectedImageDetails.tester_name || "-"}</div>
                            <div className="user-card-label">Rejected By (Tester)</div>
                          </div>
                        </div>
                        <div className="user-card">
                          <div className="user-card-avatar">
                            {getProfileSrc(previousAnnotatorProfileFromHistory) ? (
                              <img
                                src={getProfileSrc(previousAnnotatorProfileFromHistory)}
                                alt={previousAnnotatorFromHistory || selectedImageDetails.annotator_name || "Annotator"}
                                className="avatar-img"
                              />
                            ) : (
                              <div className="avatar-placeholder">{getAvatarText(previousAnnotatorFromHistory || selectedImageDetails.annotator_name)}</div>
                            )}
                          </div>
                          <div className="user-card-info">
                            <div className="user-card-name">{previousAnnotatorFromHistory || selectedImageDetails.annotator_name || "-"}</div>
                            <div className="user-card-label">Previous Annotator</div>
                          </div>
                        </div>
                      </div>

                      <div className="rejection-reason-box">
                        <div className="rejection-reason-label">Rejection Reason:</div>
                        <div className="rejection-reason-text">
                          {rejectionReasonFromHistory || selectedImageDetails.tester_feedback || "No rejection reason provided."}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p>No details found.</p>
              )}
            </div>
          </div>
        )}
    </>
  );
}
