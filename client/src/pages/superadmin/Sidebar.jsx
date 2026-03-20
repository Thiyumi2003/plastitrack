import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard, Users, BarChart3, CreditCard, DollarSign, LogOut, User } from "lucide-react";
import Notifications from "../../components/Notifications";
import logo from "../../images/logo (2).png";
import "./sidebar.css";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const getProfileSrc = (profilePicture) => {
    if (!profilePicture) return null;
    if (profilePicture.startsWith("http://") || profilePicture.startsWith("https://")) {
      return profilePicture;
    }
    if (profilePicture.startsWith("/")) {
      return `http://localhost:5000${profilePicture}`;
    }
    return `http://localhost:5000/${profilePicture}`;
  };

  const profileSrc = getProfileSrc(user.profile_picture);

  const menuItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Manage Admins", icon: Users, path: "/manage-admins" },
    { label: "View All Users", icon: Users, path: "/view-users" },
    { label: "Rate Management", icon: DollarSign, path: "/manage-rates" },
    { label: "Manage Payments", icon: CreditCard, path: "/payments" },
    { label: "Reports", icon: BarChart3, path: "/reports" },
    { label: "Profile", icon: User, path: "/profile" },
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
              <div className="user-role">{user.role}</div>
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
