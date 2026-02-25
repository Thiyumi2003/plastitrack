import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Mail, Lock, CheckCircle } from "lucide-react";
import "./auth.css";
import logo from "../images/logo (2).png";
import forgotImg from "../images/home.png";

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
    <div className="auth-container">
      <div className="login-shell">
        <section className="login-left">
          <div className="login-brand">
            <img src={logo} alt="PlastiTrack" className="login-logo" />
            <span className="login-name">PlastiTrack</span>
          </div>
          <h1 className="login-title">Reset Your Password</h1>
          <ul className="login-features">
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Secure password recovery with OTP
            </li>
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Create a new strong password
            </li>
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Return to your workspace quickly
            </li>
          </ul>
        </section>

        <div className="login-art">
          <img src={forgotImg} alt="Plastic waste" className="login-art-image" />
        </div>

        <section className="login-right">
          <div className="login-card">
            <h2 className="login-card-title">Forgot Password</h2>
            <p className="login-card-subtitle">Enter your details to reset password</p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleForgotPassword} className="login-form">
              <label className="login-label" htmlFor="email">Email</label>
              <div className="login-input">
                <Mail className="login-input-icon" size={18} />
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

              <label className="login-label" htmlFor="newPassword">New Password</label>
              <div className="login-input">
                <Lock className="login-input-icon" size={18} />
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

              <label className="login-label" htmlFor="confirmPassword">Confirm Password</label>
              <div className="login-input">
                <Lock className="login-input-icon" size={18} />
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

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading ? "Processing..." : "Continue"}
              </button>
            </form>

            <p className="login-footer">
              Remember your password?{" "}
              <button
                type="button"
                className="login-link"
                onClick={() => navigate("/login")}
              >
                Sign In
              </button>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

