import { useState, useEffect } from "react";
import axios from "axios";
import AnnotatorSidebar from "./AnnotatorSidebar";
import "./annotator.css";

export default function AnnotatorProfile() {
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    profilePicture: null,
  });
  const [password, setPassword] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setProfile({
      firstName: user.name?.split(" ")[0] || "",
      lastName: user.name?.split(" ")[1] || "",
      email: user.email || "",
      phone: user.phone || "",
      profilePicture: user.profile_picture || null,
    });
  }, []);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPassword((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setMessage("Only JPG, PNG, or GIF files are allowed");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("File size must be less than 2MB");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("profilePicture", file);

    try {
      const response = await axios.post(
        "http://localhost:5000/api/dashboard/profile-picture",
        formData,
        {
          headers: {
            ...getAuthHeader(),
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const newPicturePath = response.data.profilePicture;
      setProfile((prev) => ({ ...prev, profilePicture: newPicturePath }));

      const user = JSON.parse(localStorage.getItem("user") || "{}");
      user.profile_picture = newPicturePath;
      localStorage.setItem("user", JSON.stringify(user));

      setMessage("Profile picture uploaded successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile.firstName || !profile.email) {
      setMessage("First name and email are required");
      return;
    }

    setLoading(true);
    try {
      await axios.put(
        "http://localhost:5000/api/dashboard/annotator/profile",
        {
          name: `${profile.firstName} ${profile.lastName}`,
          email: profile.email,
          phone: profile.phone,
        },
        { headers: getAuthHeader() }
      );
      setMessage("Profile updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!password.current || !password.new || !password.confirm) {
      setMessage("All password fields are required");
      return;
    }

    if (password.new !== password.confirm) {
      setMessage("New passwords do not match");
      return;
    }

    if (password.new.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await axios.put(
        "http://localhost:5000/api/dashboard/annotator/change-password",
        {
          currentPassword: password.current,
          newPassword: password.new,
        },
        { headers: getAuthHeader() }
      );
      setMessage("Password updated successfully!");
      setPassword({ current: "", new: "", confirm: "" });
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <AnnotatorSidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Profile Settings</h1>
          <p>Manage your account information and preferences</p>
        </div>

        {message && (
          <div className={`message ${message.includes("successfully") ? "success" : "error"}`}>
            {message}
          </div>
        )}

        <div className="profile-section">
          <h2>Profile Picture</h2>
          <div className="profile-picture-box">
            {profile.profilePicture ? (
              <img
                src={`http://localhost:5000${profile.profilePicture}`}
                alt="Profile"
                className="avatar-large"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div className="avatar-large">
                {profile.firstName?.charAt(0) || "A"}
              </div>
            )}
            <div className="upload-info">
              <p>Upload a new profile picture</p>
              <p className="small-text">JPG, PNG or GIF. Max size 2MB</p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleProfilePictureUpload}
                disabled={uploading}
                style={{ marginTop: "10px" }}
              />
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h2>Personal Information</h2>
          <div className="form-row">
            <div className="form-group">
              <label className="input-label">First Name</label>
              <input
                type="text"
                className="text-input"
                name="firstName"
                value={profile.firstName}
                onChange={handleProfileChange}
              />
            </div>
            <div className="form-group">
              <label className="input-label">Last Name</label>
              <input
                type="text"
                className="text-input"
                name="lastName"
                value={profile.lastName}
                onChange={handleProfileChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="input-label">Email Address</label>
              <input
                type="email"
                className="text-input"
                name="email"
                value={profile.email}
                onChange={handleProfileChange}
              />
            </div>
            <div className="form-group">
              <label className="input-label">Phone Number</label>
              <input
                type="tel"
                className="text-input"
                name="phone"
                value={profile.phone}
                onChange={handleProfileChange}
              />
            </div>
          </div>

          <div className="button-group">
            <button className="btn-cancel">Cancel</button>
            <button
              className="btn-save"
              onClick={handleSaveProfile}
              disabled={loading}
            >
              💾 Save Changes
            </button>
          </div>
        </div>

        <div className="profile-section">
          <h2>Change Password</h2>
          <div className="form-group">
            <label className="input-label">Current Password</label>
            <input
              type="password"
              className="text-input"
              name="current"
              value={password.current}
              onChange={handlePasswordChange}
              placeholder="Enter your current password"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="input-label">New Password</label>
              <input
                type="password"
                className="text-input"
                name="new"
                value={password.new}
                onChange={handlePasswordChange}
                placeholder="Enter new password"
              />
            </div>
            <div className="form-group">
              <label className="input-label">Confirm New Password</label>
              <input
                type="password"
                className="text-input"
                name="confirm"
                value={password.confirm}
                onChange={handlePasswordChange}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <button
            className="btn-password"
            onClick={handleChangePassword}
            disabled={loading}
          >
            🔑 Update Password
          </button>
        </div>
      </div>
    </div>
  );
}
