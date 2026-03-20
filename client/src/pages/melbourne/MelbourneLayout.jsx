import { Outlet, useLocation } from "react-router-dom";
import MelbourneSidebar from "./MelbourneSidebar";
import "../annotator/annotator.css";

const TITLES = {
  "/melbourne/dashboard": "Dashboard",
  "/melbourne/admin-dashboard": "Admin Dashboard",
  "/melbourne/images": "Manage Images",
  "/melbourne/reports": "Reports",
  "/melbourne/profile": "Profile",
};

export default function MelbourneLayout() {
  const location = useLocation();
  const title = TITLES[location.pathname] || "Melbourne Portal";

  return (
    <div className="dashboard-container">
      <MelbourneSidebar />
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
