import { useState, useEffect } from "react";
import axios from "axios";
import TesterSidebar from "./TesterSidebar";
import "../annotator/annotator.css";

export default function TesterProfile() {
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [password, setPassword] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setProfile({
      firstName: user.name?.split(" ")[0] || "",
      lastName: user.name?.split(" ").slice(1).join(" ") || "",
      email: user.email || "",
      phone: user.phone || "",
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

  const handleSaveProfile = async () => {
    if (!profile.firstName || !profile.email) {
      setMessage("First name and email are required");
      return;
    }

    setLoading(true);
    try {
      await axios.put(
        "http://localhost:5000/api/dashboard/tester/profile",
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
        "http://localhost:5000/api/dashboard/change-password",
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
      <TesterSidebar />
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
            <div className="avatar-large">{profile.firstName?.charAt(0) || "T"}</div>
            <div className="upload-info">
              <p>Upload a new profile picture</p>
              <p className="small-text">JPG, PNG or GIF. Max size 2MB</p>
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

          <div className="profile-actions">
            <button
              className="btn-secondary"
              onClick={() => {
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                setProfile({
                  firstName: user.name?.split(" ")[0] || "",
                  lastName: user.name?.split(" ").slice(1).join(" ") || "",
                  email: user.email || "",
                  phone: user.phone || "",
                });
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSaveProfile}
              disabled={loading}
            >
              Save Changes
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
            className="btn-update"
            onClick={handleChangePassword}
            disabled={loading}
          >
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}
