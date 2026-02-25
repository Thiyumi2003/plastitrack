import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Mail, Lock, User, Shield, CheckCircle } from "lucide-react";
import "./auth.css";
import logo from "../images/logo (2).png";
import registerImg from "../images/home.png";

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
    <div className="auth-container">
      <div className="login-shell">
        <section className="login-left">
          <div className="login-brand">
            <img src={logo} alt="PlastiTrack" className="login-logo" />
            <span className="login-name">PlastiTrack</span>
          </div>
          <h1 className="login-title">Create Your PlastiTrack Account</h1>
          <ul className="login-features">
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Choose your role and get started fast
            </li>
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Secure onboarding and account protection
            </li>
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Start annotating plastic waste images
            </li>
          </ul>
        </section>

        <div className="login-art">
          <img src={registerImg} alt="Plastic waste" className="login-art-image" />
        </div>

        <section className="login-right">
          <div className="login-card">
            <h2 className="login-card-title">Create Account</h2>
            <p className="login-card-subtitle">
              Enter your user details to register your account.
            </p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleRegister} className="login-form">
              <label className="login-label" htmlFor="name">Full Name</label>
              <div className="login-input">
                <User className="login-input-icon" size={18} />
                <input
                  id="name"
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <label className="login-label" htmlFor="email">Email Address</label>
              <div className="login-input">
                <Mail className="login-input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              <label className="login-label" htmlFor="role">Select Role</label>
              <div className="login-input">
                <Shield className="login-input-icon" size={18} />
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  disabled={loading}
                  className="login-select"
                >
                  <option value="">Select Role</option>
                  <option value="annotator">Annotator</option>
                  <option value="tester">Tester</option>
                </select>
              </div>

              <label className="login-label" htmlFor="password">Password</label>
              <div className="login-input">
                <Lock className="login-input-icon" size={18} />
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

              {formData.password && (
                <div className="login-password-hints">
                  <div className="login-hint-title">Password Requirements:</div>
                  <div className={passwordValidation.minLength ? "login-hint-item is-valid" : "login-hint-item is-invalid"}>
                    <span className="login-hint-icon">{passwordValidation.minLength ? "✓" : "x"}</span>
                    At least 6 characters
                  </div>
                  <div className={passwordValidation.hasUpperCase ? "login-hint-item is-valid" : "login-hint-item is-invalid"}>
                    <span className="login-hint-icon">{passwordValidation.hasUpperCase ? "✓" : "x"}</span>
                    One uppercase letter (A-Z)
                  </div>
                  <div className={passwordValidation.hasLowerCase ? "login-hint-item is-valid" : "login-hint-item is-invalid"}>
                    <span className="login-hint-icon">{passwordValidation.hasLowerCase ? "✓" : "x"}</span>
                    One lowercase letter (a-z)
                  </div>
                  <div className={passwordValidation.hasNumber ? "login-hint-item is-valid" : "login-hint-item is-invalid"}>
                    <span className="login-hint-icon">{passwordValidation.hasNumber ? "✓" : "x"}</span>
                    One number (0-9)
                  </div>
                  <div className={passwordValidation.hasSpecialChar ? "login-hint-item is-valid" : "login-hint-item is-invalid"}>
                    <span className="login-hint-icon">{passwordValidation.hasSpecialChar ? "✓" : "x"}</span>
                    One special character (!@#$%^&*)
                  </div>
                </div>
              )}

              <label className="login-label" htmlFor="confirmPassword">Confirm Password</label>
              <div className="login-input">
                <Lock className="login-input-icon" size={18} />
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

          {/* Terms Checkbox */}
          <div className="pt-checkbox">
            <input
              type="checkbox"
              id="terms"
              required
              disabled={loading}
            />
            <label htmlFor="terms">I agree to the <a href="#" onClick={(e) => e.preventDefault()}>Terms & Conditions</a></label>
          </div>

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading ? "Registering..." : "Register"}
              </button>
            </form>

            <p className="login-footer">
              Already have an account?{" "}
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

