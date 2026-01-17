import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Mail, Lock } from "lucide-react";
import "./auth.css";
import logo from "../images/logo (2).png";
import forgotImg from "../images/forgotpw.png";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }
    if (!formData.newPassword) {
      setError("New password is required");
      return;
    }
    if (formData.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // Call forgot-password endpoint to generate OTP
      const response = await axios.post("http://localhost:5000/api/auth/forgot-password", {
        email: formData.email,
      });

      console.log("Forgot password response:", response.data);

      // Store email and password in session for OTP verification
      sessionStorage.setItem("resetEmail", formData.email);
      sessionStorage.setItem("resetPassword", formData.newPassword);
      
      // If OTP is provided in response (email failed), store it
      if (response.data.otp) {
        sessionStorage.setItem("otpCode", response.data.otp);
        console.log("OTP from response:", response.data.otp);
      }

      console.log("Navigating to OTP verify screen...");
      // Navigate to OTP verification
      navigate("/otp");
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.response?.data?.message || "Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-container">
      {/* Left Form Section */}
      <div className="pt-form-section">
        <div className="pt-form-content">
          <img src={logo} alt="Logo" className="pt-logo" />
          <h1 className="pt-title">Forgot Password</h1>
          <p className="pt-subtitle">Enter your details to reset password</p>

        {error && <div className="pt-error">{error}</div>}

        <form onSubmit={handleForgotPassword}>
          {/* Email Field */}
          <div className="pt-form-group">
            <div className="pt-input-wrapper">
              <Mail className="pt-input-icon" size={18} />
              <input
                id="email"
                type="email"
                name="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          {/* New Password Field */}
          <div className="pt-form-group">
            <div className="pt-input-wrapper">
              <Lock className="pt-input-icon" size={18} />
              <input
                id="newPassword"
                type="password"
                name="newPassword"
                placeholder="New password"
                value={formData.newPassword}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="pt-form-group">
            <div className="pt-input-wrapper">
              <Lock className="pt-input-icon" size={18} />
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          {/* Button */}
          <button
            type="submit"
            className="pt-button pt-button-primary"
            disabled={loading}
          >
            {loading ? "Processing..." : "Continue"}
          </button>
        </form>

        <p className="pt-footer-text">
          Remember your password?{" "}
          <a onClick={() => navigate("/login")} style={{ cursor: "pointer" }}>
            Log In
          </a>
        </p>
        </div>

        {/* Right Image Section */}
        <div className="pt-image-section">
          <img src={forgotImg} alt="Forgot Password" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      </div>
    </div>
  );
}
