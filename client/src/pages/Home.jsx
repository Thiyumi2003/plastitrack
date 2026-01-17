import { Link } from "react-router-dom";
import './home.css'

import logo from '../images/logo (2).png';

export default function Home() {
    
  return (
    <div className="homepage">
      
        <img src={logo} alt="PlastiTrack Logo" className="logo" />
        
     
      <main className="hero-section">
        <div className="container">
          <h1 className="main-title">Plastic Waste Annotation Management System</h1>
          <p className="subtitle">
            A platform to manage, annotate, and validate plastic waste images efficiently with role-based access for admins, annotators, testers and melbourne user.
          </p>
          
          <div className="cta-buttons">
            <Link to="/login" className="btn-primary">Login</Link>
            <Link to="/register" className="btn-secondary">Register</Link>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>&copy; 2025 PlastiTrack. All rights reserved.</p>
      </footer>
    </div>
  )
}
