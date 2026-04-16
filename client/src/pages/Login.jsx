import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Mail, Lock, CheckCircle } from "lucide-react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import "./auth.css";
import logo from "../images/logo (2).png";
import loginImg from "../images/home.png";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(location.state?.message || "");
  const [loading, setLoading] = useState(false);

  const normalizeRole = (role) => {
    if (role === "superadmin") return "super_admin";
    if (role === "melbourne") return "melbourne_user";
    return role;
  };

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
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/login`, {
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

      // Navigate to appropriate dashboard based on role
      const userRole = normalizeRole(response.data.user.role);
      if (userRole === "super_admin") {
        navigate("/dashboard", { state: { message: "Login successful!" } });
      } else if (userRole === "admin") {
        navigate("/admin/dashboard", { state: { message: "Login successful!" } });
      } else if (userRole === "annotator") {
        navigate("/annotator/dashboard", { state: { message: "Login successful!" } });
      } else if (userRole === "tester") {
        navigate("/tester/dashboard", { state: { message: "Login successful!" } });
      } else if (userRole === "melbourne_user") {
        navigate("/melbourne/dashboard", { state: { message: "Login successful!" } });
      } else {
        navigate("/", { state: { message: "Login successful!" } });
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    setError("");
    setLoading(true);

    try {
      console.log("🔵 Starting Google login with credential");
      
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/google-login`, {
        credential: credentialResponse.credential,
      });

      console.log("✓ Google login successful:", response.data);

      // Store token and user info
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Show success message for new users
      const message = response.data.user.isNewUser
        ? "Account created successfully via Google! Welcome!"
        : "Login successful!";

      // Navigate to appropriate dashboard based on role
      const userRole = normalizeRole(response.data.user.role);
      if (userRole === "super_admin") {
        navigate("/dashboard", { state: { message } });
      } else if (userRole === "admin") {
        navigate("/admin/dashboard", { state: { message } });
      } else if (userRole === "annotator") {
        navigate("/annotator/dashboard", { state: { message } });
      } else if (userRole === "tester") {
        navigate("/tester/dashboard", { state: { message } });
      } else if (userRole === "melbourne_user") {
        navigate("/melbourne/dashboard", { state: { message } });
      } else {
        navigate("/", { state: { message } });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message || "Google login failed";
      console.error("❌ Google login failed:", errorMessage);
      console.error("Full error:", err);
      setError(errorMessage);
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
          <h1 className="login-title">Premium Plastic Waste Annotation Platform</h1>
          <ul className="login-features">
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Role-based secure access
            </li>
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Smart annotation workflow
            </li>
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Review and approval system
            </li>
          </ul>
        </section>

        <div className="login-art">
          <img src={loginImg} alt="Plastic waste" className="login-art-image" />
        </div>

        <section className="login-right">
          <div className="login-card">
            <h2 className="login-card-title">Welcome Back</h2>
            <p className="login-card-subtitle">
              Enter your user name and password to access your panel.
            </p>

            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <form onSubmit={handleLogin} className="login-form">
              <label className="login-label" htmlFor="email">Email or Username</label>
              <div className="login-input">
                <Mail className="login-input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="Email or username"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                />
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

              <div className="login-meta">
                <label className="login-check">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={formData.remember}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  className="login-link"
                  onClick={() => navigate("/forgot")}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="login-button"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="login-divider">
              <span>or</span>
            </div>

            <GoogleOAuthProvider
              clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}
              language="en"
            >
              <div className="login-google">
                <GoogleLogin
                  onSuccess={handleGoogleLogin}
                  onError={() => setError("Google login failed")}
                  locale="en"
                  text="signin_with"
                  size="large"
                />
              </div>
            </GoogleOAuthProvider>

            <p className="login-footer">
              Don't have an account?{" "}
              <button
                type="button"
                className="login-link"
                onClick={() => navigate("/register")}
              >
                Create account
              </button>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
