import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Mail, Lock, User, Shield } from "lucide-react";
import "./auth.css";
import logo from "../images/logo (2).png";
import registerImg from "../images/register.png";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "user",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");

    // Real-time password validation
    if (name === "password") {
      setPasswordValidation({
        minLength: value.length >= 6,
        hasUpperCase: /[A-Z]/.test(value),
        hasLowerCase: /[a-z]/.test(value),
        hasNumber: /[0-9]/.test(value),
        hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(value),
      });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Invalid email format");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[a-z]/.test(formData.password)) {
      setError("Password must contain at least one lowercase letter");
      return;
    }
    if (!/[0-9]/.test(formData.password)) {
      setError("Password must contain at least one number");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      setError("Password must contain at least one special character");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post("http://localhost:5000/api/auth/register", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      // Store user data and navigate to login
      localStorage.setItem("user", JSON.stringify(response.data.user));
      navigate("/login", { state: { message: "Registration successful! Please log in." } });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
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
          <h1 className="pt-title">Register</h1>
          <p className="pt-subtitle">Enter your user name, email address, role and password to access your account.</p>

          {error && <div className="pt-error">{error}</div>}

          <form onSubmit={handleRegister} className="pt-form">
          {/* Name Field */}
          <div className="pt-form-group">
            <div className="pt-input-wrapper">
              <User className="pt-input-icon" size={18} />
              <input
                id="name"
                type="text"
                name="name"
                placeholder="Username"
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

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

          {/* Role Field */}
          <div className="pt-form-group">
            <div className="pt-input-wrapper">
              <Shield className="pt-input-icon" size={18} />
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={loading}
                className="pt-select"
              >
                <option value="">Select Role</option>
                <option value="annotator">Annotator</option>
                <option value="tester">Tester</option>
              </select>
            </div>
          </div>

          {/* Password Field */}
          <div className="pt-form-group">
            <div className="pt-input-wrapper">
              <Lock className="pt-input-icon" size={18} />
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

          {/* Password Validation Indicators */}
          {formData.password && (
            <div style={{ 
              marginTop: "-10px", 
              marginBottom: "15px", 
              padding: "10px", 
              backgroundColor: "#f9f9f9", 
              borderRadius: "6px",
              fontSize: "13px"
            }}>
              <div style={{ marginBottom: "5px", fontWeight: "600", color: "#333" }}>
                Password Requirements:
              </div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ 
                  color: passwordValidation.minLength ? "#28a745" : "#dc3545",
                  marginRight: "8px",
                  fontWeight: "bold"
                }}>
                  {passwordValidation.minLength ? "✓" : "✗"}
                </span>
                <span style={{ color: passwordValidation.minLength ? "#28a745" : "#666" }}>
                  At least 6 characters
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ 
                  color: passwordValidation.hasUpperCase ? "#28a745" : "#dc3545",
                  marginRight: "8px",
                  fontWeight: "bold"
                }}>
                  {passwordValidation.hasUpperCase ? "✓" : "✗"}
                </span>
                <span style={{ color: passwordValidation.hasUpperCase ? "#28a745" : "#666" }}>
                  One uppercase letter (A-Z)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ 
                  color: passwordValidation.hasLowerCase ? "#28a745" : "#dc3545",
                  marginRight: "8px",
                  fontWeight: "bold"
                }}>
                  {passwordValidation.hasLowerCase ? "✓" : "✗"}
                </span>
                <span style={{ color: passwordValidation.hasLowerCase ? "#28a745" : "#666" }}>
                  One lowercase letter (a-z)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ 
                  color: passwordValidation.hasNumber ? "#28a745" : "#dc3545",
                  marginRight: "8px",
                  fontWeight: "bold"
                }}>
                  {passwordValidation.hasNumber ? "✓" : "✗"}
                </span>
                <span style={{ color: passwordValidation.hasNumber ? "#28a745" : "#666" }}>
                  One number (0-9)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ 
                  color: passwordValidation.hasSpecialChar ? "#28a745" : "#dc3545",
                  marginRight: "8px",
                  fontWeight: "bold"
                }}>
                  {passwordValidation.hasSpecialChar ? "✓" : "✗"}
                </span>
                <span style={{ color: passwordValidation.hasSpecialChar ? "#28a745" : "#666" }}>
                  One special character (!@#$%^&*)
                </span>
              </div>
            </div>
          )}

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

          {/* Terms Checkbox */}
          <div className="pt-checkbox">
            <input
              type="checkbox"
              id="terms"
              required
              disabled={loading}
            />
            <label htmlFor="terms">I agree to all Terms & Condition</label>
          </div>

          {/* Register Button */}
          <button
            type="submit"
            className="pt-button pt-button-primary"
            disabled={loading}
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <p className="pt-footer-text">
          Already have an account?{" "}
          <a onClick={() => navigate("/login")} style={{ cursor: "pointer" }}>
            Log In
          </a>
        </p>
        </div>

        {/* Right Image Section */}
        <div className="pt-image-section">
          <img src={registerImg} alt="Register" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      </div>
    </div>
  );
}

