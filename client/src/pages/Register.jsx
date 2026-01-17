import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./auth.css";

import {
  Code2,
  User,
  Mail,
  UserCog,
  Lock,
} from "lucide-react";

import logo from "../images/logo (2).png";
import registerImage from "../images/register.png";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "annotator",
    agree: false,
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!formData.agree) {
      setError("Please agree to Terms & Condition");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("/api/auth/register", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      localStorage.setItem("token", response.data.token);
      navigate("/otp");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-page">
      <div className="pt-frame">
        {/* Top bar like screenshot */}
        <div className="pt-topbar">
          <div className="pt-topbar-title">Register</div>
          <div className="pt-topbar-icon" title="Code">
            <Code2 size={18} />
          </div>
        </div>

        <div className="pt-body">
          {/* LEFT PANEL */}
          <div className="pt-left">
            <div className="pt-logoBox">
              <img src={logo} alt="PlastiTrack" />
            </div>

            <h1 className="pt-title">Register</h1>
            <p className="pt-desc">
              Enter your user name , email address, role and
              <br />
              password to access your account.
            </p>

            {error && <div className="pt-error">{error}</div>}

            <form className="pt-form" onSubmit={handleSubmit}>
              {/* Username */}
              <div className="pt-input">
                <span className="pt-ic">
                  <User size={16} />
                </span>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Username"
                  required
                />
              </div>

              {/* Email */}
              <div className="pt-input">
                <span className="pt-ic">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email"
                  required
                />
              </div>

              {/* Role */}
              <div className="pt-input">
                <span className="pt-ic">
                  <UserCog size={16} />
                </span>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="annotator">Annotator</option>
                  <option value="tester">Tester</option>
                  
                </select>
              </div>

              {/* Password */}
              <div className="pt-input">
                <span className="pt-ic">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password"
                  required
                />
              </div>

              {/* Confirm */}
              <div className="pt-input">
                <span className="pt-ic">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm Password"
                  required
                />
              </div>

              {/* Terms */}
              <label className="pt-terms">
                <input
                  type="checkbox"
                  name="agree"
                  checked={formData.agree}
                  onChange={handleChange}
                />
                <span>
                  I agree to all <b>Terms &amp; Condition</b>
                </span>
              </label>

              <button className="pt-btn" disabled={loading} type="submit">
                {loading ? "Registering..." : "Register"}
              </button>

              <div className="pt-footer">
                <span>Already have an account?</span>{" "}
                <Link to="/login">Login</Link>
              </div>
            </form>
          </div>

          {/* RIGHT IMAGE PANEL */}
          <div className="pt-right">
            <img src={registerImage} alt="Register visual" />
          </div>
        </div>
      </div>
    </div>
  );
}
