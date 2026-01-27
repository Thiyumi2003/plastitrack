import { Link } from "react-router-dom";
import './home.css'

import logo from '../images/logo (2).png';

export default function Home() {
    
  return (
    <div className="homepage">
      {/* Header Bar */}
      <header className="header-bar">
        <div className="header-container">
          <img src={logo} alt="PlastiTrack Logo" className="header-logo" />
          <nav className="header-nav">
            <a href="#home" className="nav-link">Home</a>
            <Link to="/register" className="nav-link">Register</Link>
            <Link to="/login" className="nav-link">Login</Link>
          </nav>
        </div>
      </header>
      
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

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <h2>Why Choose PlastiTrack?</h2>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Accurate Annotation</h3>
              <p>Precision-focused image annotation tools for detailed plastic waste classification and tracking.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3>Role-Based Access</h3>
              <p>Secure, customized dashboards for admins, annotators, testers, and regional managers.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Real-Time Analytics</h3>
              <p>Track progress, view detailed reports, and monitor annotation quality metrics instantly.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Fast & Efficient</h3>
              <p>Streamlined workflow optimized for speed without compromising on data accuracy.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Secure & Reliable</h3>
              <p>Enterprise-grade security with authentication, authorization, and data protection.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🌍</div>
              <h3>Multi-Region Support</h3>
              <p>Manage operations across multiple locations with centralized control and monitoring.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="how-container">
          <h2>How It Works</h2>
          
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Register Account</h3>
              <p>Create your account and select your role for immediate access.</p>
            </div>
            
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Access Dashboard</h3>
              <p>Log in to view your personalized dashboard with relevant tasks and data.</p>
            </div>
            
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Manage & Annotate</h3>
              <p>Upload, review, annotate, and validate plastic waste images efficiently.</p>
            </div>
            
            <div className="step-card">
              <div className="step-number">4</div>
              <h3>Track Progress</h3>
              <p>Monitor performance, view analytics, and generate detailed reports for insights.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          <div className="stat-item">
            <div className="stat-number">10K+</div>
            <p>Images Processed</p>
          </div>
          <div className="stat-item">
            <div className="stat-number">500+</div>
            <p>Active Users</p>
          </div>
          <div className="stat-item">
            <div className="stat-number">99.9%</div>
            <p>System Uptime</p>
          </div>
          <div className="stat-item">
            <div className="stat-number">24/7</div>
            <p>Support Available</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>&copy; 2025 PlastiTrack. All rights reserved.</p>
      </footer>
    </div>
  )
}
