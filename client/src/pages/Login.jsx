import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Mail, Lock, Shield } from "lucide-react";
import "./auth.css";
import logo from "../images/logo (2).png";
import loginImg from "../images/register.png";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    role: "user",
    remember: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(location.state?.message || "");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
    setSuccess("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }
    if (!formData.password) {
      setError("Password is required");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post("http://localhost:5000/api/auth/login", {
        email: formData.email,
        password: formData.password,
      });

      // Store token and user info
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Remember me
      if (formData.remember) {
        localStorage.setItem("rememberEmail", formData.email);
      }

      // Navigate to dashboard
      navigate("/dashboard", { state: { message: "Login successful!" } });
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Left Form Section */}
      <div className="auth-form-section">
        <div className="auth-form-content">
          <img src={logo} alt="Logo" className="auth-logo" />
          <h1 className="auth-title">Log-in</h1>
          <p className="auth-subtitle">Enter your user name and password to access your panel.</p>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleLogin}>
          {/* Email Field */}
          <div className="auth-form-group">
            <div className="auth-input-wrapper">
              <Mail className="auth-input-icon" size={18} />
              <input
                id="email"
                type="email"
                name="email"
                placeholder="Username or Email"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          {/* Role Field */}
          <div className="auth-form-group">
            <div className="auth-input-wrapper">
              <Shield className="auth-input-icon" size={18} />
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={loading}
                className="auth-select"
              >
                <option value="">Select Role</option>
                <option value="annotator">Annotator</option>
                <option value="tester">Tester</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
                <option value="melbourne_user">Melbourne User</option>
              </select>
            </div>
          </div>

          {/* Password Field */}
          <div className="auth-form-group">
            <div className="auth-input-wrapper">
              <Lock className="auth-input-icon" size={18} />
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <label className="auth-checkbox">
            <input
              type="checkbox"
              name="remember"
              checked={formData.remember}
              onChange={handleChange}
              disabled={loading}
            />
            <span>Remember me</span>
          </label>

          <a
            onClick={() => navigate("/forgot")}
            className="auth-link"
            style={{ cursor: "pointer" }}
          >
            Forgot Password?
          </a>

          {/* Button Group */}
          <button
            type="submit"
            className="auth-button auth-button-primary"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Log-in"}
          </button>
        </form>

        <p className="auth-footer-text">
          Don't have an account?{" "}
          <a onClick={() => navigate("/register")} style={{ cursor: "pointer" }}>
            Register
          </a>
        </p>
        </div>

        {/* Right Image Section */}
        <div className="auth-image-section">
          <img src={loginImg} alt="Login" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      </div>
    </div>
  );
}
