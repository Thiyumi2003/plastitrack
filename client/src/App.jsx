import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import OtpVerify from "./pages/OtpVerify";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import ManageAdmins from "./pages/superadmin/ManageAdmins";
import ViewAllUsers from "./pages/superadmin/ViewAllUsers";
import ManageRates from "./pages/superadmin/ManageRates";
import Reports from "./pages/superadmin/Reports";
import ManagePayments from "./pages/superadmin/ManagePayments";
import ManageAdminWorkHours from "./pages/superadmin/ManageAdminWorkHours";
import SuperAdminProfile from "./pages/superadmin/SuperAdminProfile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageImages from "./pages/admin/ManageImages";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminReports from "./pages/admin/AdminReports";
import AdminPayments from "./pages/admin/AdminPayments";
import PaymentEligibility from "./pages/admin/PaymentEligibility";
import AdminWorkHours from "./pages/admin/AdminWorkHours";
import AdminProfile from "./pages/admin/AdminProfile";
import AnnotatorDashboard from "./pages/annotator/AnnotatorDashboard";
import AnnotatorProfile from "./pages/annotator/AnnotatorProfile";
import AnnotatorPayments from "./pages/annotator/AnnotatorPayments";
import AnnotatorTaskHistory from "./pages/annotator/AnnotatorTaskHistory";
import TesterDashboard from "./pages/tester/TesterDashboard";
import TesterProfile from "./pages/tester/TesterProfile";
import TesterPayments from "./pages/tester/TesterPayments";
import TesterTaskHistory from "./pages/tester/TesterTaskHistory";
import MelbourneDashboard from "./pages/melbourne/MelbourneDashboard";
import MelbourneProfile from "./pages/melbourne/MelbourneProfile";
import MelbourneAdminDashboard from "./pages/melbourne/MelbourneAdminDashboard";
import MelbourneManageImages from "./pages/melbourne/MelbourneManageImages";
import MelbourneReports from "./pages/melbourne/MelbourneReports";

// Protected Route Component
function ProtectedRoute({ children, requiredRole }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");

  const normalizeRole = (role) => {
    if (role === "superadmin") return "super_admin";
    if (role === "melbourne") return "melbourne_user";
    return role;
  };

  if (!token || !user) {
    return <Navigate to="/login" />;
  }

  const actualRole = normalizeRole(user.role);

  if (requiredRole && actualRole !== requiredRole) {
    // Redirect to appropriate dashboard based on actual role
    if (actualRole === "admin") {
      return <Navigate to="/admin/dashboard" />;
    } else if (actualRole === "super_admin") {
      return <Navigate to="/dashboard" />;
    } else if (actualRole === "annotator") {
      return <Navigate to="/annotator/dashboard" />;
    } else if (actualRole === "tester") {
      return <Navigate to="/tester/dashboard" />;
    } else if (actualRole === "melbourne_user") {
      return <Navigate to="/melbourne/dashboard" />;
    } else {
      return <Navigate to="/" />;
    }
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
          path="/manage-rates"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <ManageRates />
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
        <Route
          path="/admin-work-hours"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <ManageAdminWorkHours />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute requiredRole="super_admin">
              <SuperAdminProfile />
            </ProtectedRoute>
          }
        />

        {/* Admin Dashboard Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/images"
          element={
            <ProtectedRoute requiredRole="admin">
              <ManageImages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminPayments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payment-eligibility"
          element={
            <ProtectedRoute requiredRole="admin">
              <PaymentEligibility />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/work-hours"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminWorkHours />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminProfile />
            </ProtectedRoute>
          }
        />

        {/* Annotator Dashboard Routes */}
        <Route
          path="/annotator/dashboard"
          element={
            <ProtectedRoute requiredRole="annotator">
              <AnnotatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/annotator/profile"
          element={
            <ProtectedRoute requiredRole="annotator">
              <AnnotatorProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/annotator/task-history"
          element={
            <ProtectedRoute requiredRole="annotator">
              <AnnotatorTaskHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/annotator/payments"
          element={
            <ProtectedRoute requiredRole="annotator">
              <AnnotatorPayments />
            </ProtectedRoute>
          }
        />

        {/* Tester Dashboard Routes */}
        <Route
          path="/tester/dashboard"
          element={
            <ProtectedRoute requiredRole="tester">
              <TesterDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tester/task-history"
          element={
            <ProtectedRoute requiredRole="tester">
              <TesterTaskHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tester/profile"
          element={
            <ProtectedRoute requiredRole="tester">
              <TesterProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tester/payments"
          element={
            <ProtectedRoute requiredRole="tester">
              <TesterPayments />
            </ProtectedRoute>
          }
        />

        {/* Melbourne User Dashboard Routes */}
        <Route
          path="/melbourne/dashboard"
          element={
            <ProtectedRoute requiredRole="melbourne_user">
              <MelbourneDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/melbourne/admin-dashboard"
          element={
            <ProtectedRoute requiredRole="melbourne_user">
              <MelbourneAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/melbourne/images"
          element={
            <ProtectedRoute requiredRole="melbourne_user">
              <MelbourneManageImages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/melbourne/reports"
          element={
            <ProtectedRoute requiredRole="melbourne_user">
              <MelbourneReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/melbourne/profile"
          element={
            <ProtectedRoute requiredRole="melbourne_user">
              <MelbourneProfile />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </BrowserRouter>
  );
}
