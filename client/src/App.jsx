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
import AdminWorkHours from "./pages/admin/AdminWorkHours";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminDashboardLayout from "./pages/admin/AdminDashboardLayout";
import SuperAdminLayout from "./pages/superadmin/SuperAdminLayout";
import AnnotatorDashboard from "./pages/annotator/AnnotatorDashboard";
import AnnotatorProfile from "./pages/annotator/AnnotatorProfile";
import AnnotatorPayments from "./pages/annotator/AnnotatorPayments";
import AnnotatorTaskHistory from "./pages/annotator/AnnotatorTaskHistory";
import AnnotatorReviewResults from "./pages/annotator/AnnotatorReviewResults";
import AnnotatorLayout from "./pages/annotator/AnnotatorLayout";
import TesterDashboard from "./pages/tester/TesterDashboard";
import TesterProfile from "./pages/tester/TesterProfile";
import TesterPayments from "./pages/tester/TesterPayments";
import TesterTaskHistory from "./pages/tester/TesterTaskHistory";
import TesterLayout from "./pages/tester/TesterLayout";
import MelbourneDashboard from "./pages/melbourne/MelbourneDashboard";
import MelbourneProfile from "./pages/melbourne/MelbourneProfile";
import MelbourneAdminDashboard from "./pages/melbourne/MelbourneAdminDashboard";
import MelbourneManageImages from "./pages/melbourne/MelbourneManageImages";
import MelbourneReports from "./pages/melbourne/MelbourneReports";
import MelbourneLayout from "./pages/melbourne/MelbourneLayout";
import ReceiptViewRedirect from "./pages/ReceiptViewRedirect";
import SystemMessages from "./components/SystemMessages";

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
      <SystemMessages />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/otp" element={<OtpVerify />} />
        <Route path="/receipt-view/:id" element={<ReceiptViewRedirect />} />

        {/* Super Admin Dashboard Routes (Nested Layout) */}
        <Route
          element={
            <ProtectedRoute requiredRole="super_admin">
              <SuperAdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/manage-admins" element={<ManageAdmins />} />
          <Route path="/view-users" element={<ViewAllUsers />} />
          <Route path="/manage-rates" element={<ManageRates />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/payments" element={<ManagePayments />} />
          <Route path="/admin-work-hours" element={<ManageAdminWorkHours />} />
          <Route path="/profile" element={<SuperAdminProfile />} />
        </Route>

        {/* Admin Dashboard Routes (Nested Layout) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="manage-images" element={<ManageImages />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="payment-eligibility" element={<Navigate to="/admin/reports" replace />} />
          <Route path="work-hours" element={<AdminWorkHours />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>

        {/* Backward-compatible admin route aliases */}
        <Route path="/admin/images" element={<Navigate to="/admin/manage-images" replace />} />

        {/* Annotator Dashboard Routes (Nested Layout) */}
        <Route
          path="/annotator"
          element={
            <ProtectedRoute requiredRole="annotator">
              <AnnotatorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AnnotatorDashboard />} />
          <Route path="task-history" element={<AnnotatorTaskHistory />} />
          <Route path="review-results" element={<AnnotatorReviewResults />} />
          <Route path="payments" element={<AnnotatorPayments />} />
          <Route path="profile" element={<AnnotatorProfile />} />
        </Route>

        {/* Tester Dashboard Routes (Nested Layout) */}
        <Route
          path="/tester"
          element={
            <ProtectedRoute requiredRole="tester">
              <TesterLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<TesterDashboard />} />
          <Route path="task-history" element={<TesterTaskHistory />} />
          <Route path="profile" element={<TesterProfile />} />
          <Route path="payments" element={<TesterPayments />} />
        </Route>

        {/* Melbourne User Dashboard Routes (Nested Layout) */}
        <Route
          path="/melbourne"
          element={
            <ProtectedRoute requiredRole="melbourne_user">
              <MelbourneLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<MelbourneDashboard />} />
          <Route path="admin-dashboard" element={<MelbourneAdminDashboard />} />
          <Route path="images" element={<MelbourneManageImages />} />
          <Route path="reports" element={<MelbourneReports />} />
          <Route path="profile" element={<MelbourneProfile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </BrowserRouter>
  );
}
