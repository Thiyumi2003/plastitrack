import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { CheckCircle } from "lucide-react";
import "./auth.css";
import logo from "../images/logo (2).png";
import otpImg from "../images/home.png";

export default function OtpVerify() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const inputRefs = useRef([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Get email and password from session storage
  const resetEmail = sessionStorage.getItem("resetEmail");
  const resetPassword = sessionStorage.getItem("resetPassword");

  useEffect(() => {
    // Focus on first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (value, index) => {
    // Only allow numbers
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    // Auto-focus next input if value is entered
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    // Handle backspace to go to previous input
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");

    const otpCode = otp.join("");

    if (otpCode.length !== 4) {
      setError("Please enter a 4-digit OTP");
      return;
    }

    setLoading(true);

    try {
      // Call verify-otp endpoint
      await axios.post("http://localhost:5000/api/auth/verify-otp", {
        email: resetEmail,
        otp_code: otpCode,
        newPassword: resetPassword,
      });

      // Clear session storage
      sessionStorage.removeItem("resetEmail");
      sessionStorage.removeItem("resetPassword");

      // Navigate to login with success message
      navigate("/login", { state: { message: "Password reset successful! Please log in with your new password." } });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/login");
  };

  return (
    <div className="auth-container">
      <div className="login-shell">
        <section className="login-left">
          <div className="login-brand">
            <img src={logo} alt="PlastiTrack" className="login-logo" />
            <span className="login-name">PlastiTrack</span>
          </div>
          <h1 className="login-title">Email Authentication</h1>
          <ul className="login-features">
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Verify your identity with a 4-digit OTP
            </li>
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Secure password reset in seconds
            </li>
            <li>
              <CheckCircle size={16} className="login-feature-icon" />
              Return to your dashboard safely
            </li>
          </ul>
        </section>

        <div className="login-art">
          <img src={otpImg} alt="Plastic waste" className="login-art-image" />
        </div>

        <section className="login-right">
          <div className="login-card">
            <h2 className="login-card-title">Enter Verification Code</h2>
            <p className="login-card-subtitle">Enter the 4-digit code sent to your email</p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleVerifyOtp} className="login-form">
              <div className="login-otp-input-group">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    type="text"
                    className="login-otp-input"
                    value={digit}
                    onChange={(e) => handleChange(e.target.value, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    placeholder="0"
                    disabled={loading}
                    maxLength="1"
                  />
                ))}
              </div>

              <div className="login-button-group">
                <button
                  type="submit"
                  className="login-button"
                  disabled={loading || otp.join("").length !== 4}
                >
                  {loading ? "Verifying..." : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="login-button login-button-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>

            <p className="login-footer">
              Didn't receive code?{" "}
              <button
                type="button"
                className="login-link"
                onClick={() => navigate("/forgot")}
              >
                Try again
              </button>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
