import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./auth.css";
import logo from "../images/logo (2).png";
import otpImg from "../images/register.png";

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
    <div className="otp-container">
      {/* Left Form Section */}
      <div className="otp-form-section">
        <div className="otp-form-content">
          <img src={logo} alt="Logo" className="otp-logo" />
          <h1 className="otp-title">Email Authentication</h1>
          <p className="otp-subtitle">Enter the 4-digit code sent to your email</p>

        {error && <div className="otp-error">{error}</div>}

        <form onSubmit={handleVerifyOtp}>
          {/* OTP Input Group */}
          <div className="otp-input-group">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                type="text"
                className="otp-input"
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                placeholder="0"
                disabled={loading}
                maxLength="1"
              />
            ))}
          </div>

          {/* Button Group */}
          <div className="otp-button-group">
            <button
              type="submit"
              className="otp-button otp-button-confirm"
              disabled={loading || otp.join("").length !== 4}
            >
              {loading ? "Verifying..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="otp-button otp-button-cancel"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>

        <p className="otp-subtitle" style={{ marginTop: "30px" }}>
          Didn't receive code? Check spam or{" "}
          <a onClick={() => navigate("/forgot")} style={{ cursor: "pointer", color: "#8B0000", fontWeight: "600" }}>
            try again
          </a>
        </p>
        </div>

        {/* Right Image Section */}
        <div className="otp-image-section">
          <img src={otpImg} alt="OTP" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      </div>
    </div>
  );
}
