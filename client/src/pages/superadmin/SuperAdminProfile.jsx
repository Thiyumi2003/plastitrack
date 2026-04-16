import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../annotator/annotator.css";

export default function SuperAdminProfile() {
  const fileInputRef = useRef(null);
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
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
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
      lastName: user.name?.split(" ").slice(1).join(" ") || "",
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

    if (name === "new") {
      setPasswordValidation({
        minLength: value.length >= 6,
        hasUpperCase: /[A-Z]/.test(value),
        hasLowerCase: /[a-z]/.test(value),
        hasNumber: /[0-9]/.test(value),
        hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(value),
      });
    }
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
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/profile-picture`,
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
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/super-admin/profile`,
        {
          name: `${profile.firstName} ${profile.lastName}`.trim(),
          email: profile.email,
          phone: profile.phone,
        },
        { headers: getAuthHeader() }
      );
      setMessage("Profile updated successfully!");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      user.name = `${profile.firstName} ${profile.lastName}`.trim();
      user.email = profile.email;
      user.phone = profile.phone;
      localStorage.setItem("user", JSON.stringify(user));
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
    if (!/[A-Z]/.test(password.new)) {
      setMessage("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[a-z]/.test(password.new)) {
      setMessage("Password must contain at least one lowercase letter");
      return;
    }
    if (!/[0-9]/.test(password.new)) {
      setMessage("Password must contain at least one number");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password.new)) {
      setMessage("Password must contain at least one special character");
      return;
    }

    setLoading(true);
    try {
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/super-admin/change-password`,
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
    <>
      <div className="dashboard-header">
        <h1>Profile Settings</h1>
        <p>Manage your account information and preferences</p>
      </div>

      {message && (
        <div
          className={message.includes("successfully") ? "dashboard-success" : "dashboard-error"}
          style={{ marginBottom: "20px" }}
        >
          {message}
        </div>
      )}

        <div className="profile-section">
          <h2>Profile Picture</h2>
          <div
            style={{
              display: "flex",
              gap: "30px",
              alignItems: "flex-start",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              padding: "30px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {profile.profilePicture ? (
              <img
                src={`${import.meta.env.VITE_API_BASE_URL}${profile.profilePicture}`}
                alt="Profile"
                style={{
                  width: "150px",
                  height: "150px",
                  borderRadius: "12px",
                  objectFit: "cover",
                  marginBottom: "16px",
                  border: "3px solid rgba(16, 185, 129, 0.3)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "150px",
                  height: "150px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(102, 126, 234, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "48px",
                  fontWeight: "600",
                  color: "#667eea",
                  marginBottom: "16px",
                }}
              >
                {profile.firstName?.charAt(0) || "S"}
              </div>
            )}
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ color: "#fff", marginBottom: "12px" }}>Upload Profile Picture</h3>
              <p style={{ color: "rgba(255, 255, 255, 0.6)", marginBottom: "16px", lineHeight: "1.6" }}>
                Choose a JPG, PNG, or GIF image. Maximum file size is 2MB.
                <br />
                Your profile picture will be visible to your team.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleProfilePictureUpload}
                disabled={uploading}
                style={{ display: "none" }}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  backgroundColor: "#667eea",
                  color: "#fff",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                {uploading ? "Uploading..." : "Choose File"}
              </button>
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
            <button
              className="btn-cancel"
              onClick={() => {
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                setProfile({
                  firstName: user.name?.split(" ")[0] || "",
                  lastName: user.name?.split(" ").slice(1).join(" ") || "",
                  email: user.email || "",
                  phone: user.phone || "",
                  profilePicture: user.profile_picture || null,
                });
              }}
            >
              Cancel
            </button>
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

            {password.new && (
              <div className="profile-password-hints">
                <div className="profile-hint-title">Password Requirements:</div>
                <div className={passwordValidation.minLength ? "profile-hint-item is-valid" : "profile-hint-item is-invalid"}>
                  <span>{passwordValidation.minLength ? "✓" : "x"}</span>
                  At least 6 characters
                </div>
                <div className={passwordValidation.hasUpperCase ? "profile-hint-item is-valid" : "profile-hint-item is-invalid"}>
                  <span>{passwordValidation.hasUpperCase ? "✓" : "x"}</span>
                  One uppercase letter (A-Z)
                </div>
                <div className={passwordValidation.hasLowerCase ? "profile-hint-item is-valid" : "profile-hint-item is-invalid"}>
                  <span>{passwordValidation.hasLowerCase ? "✓" : "x"}</span>
                  One lowercase letter (a-z)
                </div>
                <div className={passwordValidation.hasNumber ? "profile-hint-item is-valid" : "profile-hint-item is-invalid"}>
                  <span>{passwordValidation.hasNumber ? "✓" : "x"}</span>
                  One number (0-9)
                </div>
                <div className={passwordValidation.hasSpecialChar ? "profile-hint-item is-valid" : "profile-hint-item is-invalid"}>
                  <span>{passwordValidation.hasSpecialChar ? "✓" : "x"}</span>
                  One special character (!@#$%^&*)
                </div>
              </div>
            )}
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
          Update Password
        </button>
      </div>
    </>
  );
}
