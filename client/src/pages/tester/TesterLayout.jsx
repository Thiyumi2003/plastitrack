import { Outlet, useLocation } from "react-router-dom";
import TesterSidebar from "./TesterSidebar";
import "../annotator/annotator.css";

const TITLES = {
  "/tester/dashboard": "Dashboard",
  "/tester/task-history": "Task History",
  "/tester/profile": "Profile",
  "/tester/payments": "Payments",
};

export default function TesterLayout() {
  const location = useLocation();
  const title = TITLES[location.pathname] || "Tester Portal";

  return (
    <div className="dashboard-container">
      <TesterSidebar />
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
