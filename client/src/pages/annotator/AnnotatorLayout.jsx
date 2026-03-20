import { Outlet, useLocation } from "react-router-dom";
import AnnotatorSidebar from "./AnnotatorSidebar";
import "./annotator.css";

const TITLES = {
  "/annotator/dashboard": "Dashboard",
  "/annotator/profile": "Profile",
  "/annotator/task-history": "Task History",
  "/annotator/payments": "Payments",
};

export default function AnnotatorLayout() {
  const location = useLocation();
  const title = TITLES[location.pathname] || "Annotator Portal";

  return (
    <div className="dashboard-container">
      <AnnotatorSidebar />
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
