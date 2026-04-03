import { Outlet, useLocation } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import "./admin.css";

const PAGE_TITLES = {
  "/admin/dashboard": "Dashboard",
  "/admin/manage-images": "Manage Images",
  "/admin/users": "Users",
  "/admin/reports": "Reports",
  "/admin/payments": "Payments",
  "/admin/payment-eligibility": "Payment Eligible",
  "/admin/work-hours": "My Work Hours",
  "/admin/profile": "Profile",
};

export default function AdminDashboardLayout() {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || "Admin Portal";

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <div className="dashboard-main">
        <div className="admin-layout-topbar">
          <div className="admin-layout-title">{pageTitle}</div>
          <div className="admin-layout-date">{new Date().toLocaleDateString()}</div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}