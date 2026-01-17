import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import OtpVerify from "./pages/OtpVerify";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import ManageAdmins from "./pages/superadmin/ManageAdmins";
import ViewAllUsers from "./pages/superadmin/ViewAllUsers";
import Reports from "./pages/superadmin/Reports";
import ManagePayments from "./pages/superadmin/ManagePayments";

// Protected Route Component
function ProtectedRoute({ children, requiredRole }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");

  if (!token || !user) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/otp" element={<OtpVerify />} />

        {/* Super Admin Dashboard Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-admins"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <ManageAdmins />
            </ProtectedRoute>
          }
        />
        <Route
          path="/view-users"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <ViewAllUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <ManagePayments />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
