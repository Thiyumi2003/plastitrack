import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import "./superadmin.css";

const TITLES = {
  "/dashboard": "Dashboard",
  "/manage-admins": "Manage Admins",
  "/view-users": "View Users",
  "/manage-rates": "Rate Management",
  "/payments": "Manage Payments",
  "/reports": "Reports",
  "/profile": "Profile",
  "/admin-work-hours": "Admin Work Hours",
};

export default function SuperAdminLayout() {
  const location = useLocation();
  const title = TITLES[location.pathname] || "Super Admin Portal";

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <div className="admin-layout-topbar">
          <div className="admin-layout-title">{title}</div>
          <div className="admin-layout-date">{new Date().toLocaleDateString()}</div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
