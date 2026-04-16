import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import axios from "axios";
import { Menu, X, LayoutDashboard, Image, Users, FileText, Wallet, LogOut, Clock, User } from "lucide-react";
import Notifications from "../../components/Notifications";
import logo from "../../images/logo (2).png";
import "../superadmin/sidebar.css";

export default function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const getProfileSrc = (profilePicture) => {
    if (!profilePicture) return null;
    if (profilePicture.startsWith("http://") || profilePicture.startsWith("https://")) {
      return profilePicture;
    }
    if (profilePicture.startsWith("/")) {
      return `${import.meta.env.VITE_API_BASE_URL}${profilePicture}`;
    }
    return `${import.meta.env.VITE_API_BASE_URL}/${profilePicture}`;
  };

  const profileSrc = getProfileSrc(user.profile_picture);

  const handleLogout = async () => {
    const token = localStorage.getItem("token");

    try {
      if (token) {
        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
    { name: "Manage Images", icon: Image, path: "/admin/manage-images" },
    { name: "Users", icon: Users, path: "/admin/users" },
    { name: "Reports", icon: FileText, path: "/admin/reports" },
    { name: "Payments", icon: Wallet, path: "/admin/payments" },
    { name: "My Work Hours", icon: Clock, path: "/admin/work-hours" },
    { name: "Profile", icon: User, path: "/admin/profile" },
  ];

  return (
    <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
      <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <>
          <div className="sidebar-logo">
            <img src={logo} alt="Logo" />
            <span>PlastiTrack</span>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">
              {profileSrc ? (
                <img className="user-avatar-img" src={profileSrc} alt={user.name || "Admin"} />
              ) : (
                user.name?.charAt(0).toUpperCase() || "A"
              )}
            </div>
            <div className="user-info">
              <div className="user-name">{user.name || "Admin"}</div>
              <div className="user-role">{user.role || "admin"}</div>
            </div>
            <div className="sidebar-notifications">
              <Notifications />
            </div>
          </div>

          <nav className="sidebar-nav">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <button className="nav-item logout" onClick={handleLogout}>
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
