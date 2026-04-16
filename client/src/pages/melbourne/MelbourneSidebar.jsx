import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard, User, LogOut } from "lucide-react";
import Notifications from "../../components/Notifications";
import logo from "../../images/logo (2).png";
import "../superadmin/sidebar.css";

export default function MelbourneSidebar() {
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

  const menuItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/melbourne/dashboard" },
    { label: "Manage Images", icon: LayoutDashboard, path: "/melbourne/images" },
    { label: "Reports", icon: LayoutDashboard, path: "/melbourne/reports" },
    { label: "Profile", icon: User, path: "/melbourne/profile" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

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
                <img className="user-avatar-img" src={profileSrc} alt={user.name || "User"} />
              ) : (
                user.name?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="user-info">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role || "melbourne_user"}</div>
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
                  <span>{item.label}</span>
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
