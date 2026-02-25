import { Link } from "react-router-dom";
import { Edit3, Eye, DollarSign, Upload, CheckCircle } from "lucide-react";
import './home.css';
import logo from '../images/logo (2).png';
import heroImage from '../images/home.png';

export default function Home() {
  return (
    <div className="homepage">
      {/* Navigation Header */}
      <header className="site-header">
        <div className="header-content">
          <div className="logo-section">
            <img src={logo} alt="PlastiTrack" className="site-logo" />
            <span className="logo-text">PlastiTrack</span>
          </div>
          <nav className="main-nav">
            <a href="#home" className="nav-item">Home</a>
            <a href="#features" className="nav-item">Features</a>
            <a href="#process" className="nav-item">Process</a>
            <Link to="/login" className="nav-item">Sign In</Link>
            <Link to="/register" className="btn-cta">Try for Free</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">Empowering Plastic<br />Waste Management</h1>
            <p className="hero-subtitle">
              The leading platform for annotating, reviewing,<br />
              and managing plastic waste images.
            </p>
            <div className="hero-buttons">
              <Link to="/register" className="btn-get-started">Get Started</Link>
              <button className="btn-watch-demo">
                <span className="demo-icon">▶</span>
                Watch Demo
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <img src={heroImage} alt="Plastic Waste Management" className="hero-main-image" />
            <div className="stats-overlay">
              <div className="stat-card card-top">
                <div className="stat-row">
                  <div className="stat-icon">📸</div>
                  <div className="stat-content">
                    <div className="stat-number">17</div>
                    <div className="stat-label">Assigned Images</div>
                  </div>
                </div>
              </div>
              <div className="stat-card card-middle">
                <div className="stat-row">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-number">4</div>
                    <div className="stat-label">In Progress</div>
                  </div>
                </div>
              </div>
              <div className="stat-card card-bottom">
                <div className="stat-row">
                  <div className="stat-icon">✓</div>
                  <div className="stat-content">
                    <div className="stat-number">3</div>
                    <div className="stat-label">Pending Review</div>
                  </div>
                </div>
              </div>
              {/* Data Table Cards */}
              <div className="data-card data-card-1">
                <div className="data-header">
                  <span className="data-label">IMAGE ID</span>
                  <span className="data-label">USER</span>
                  <span className="data-label">ASSIGNED DATE</span>
                  <span className="data-label">STATUS</span>
                </div>
                <div className="data-row">
                  <span className="data-value">IMG-5</span>
                  <span className="data-value">Sarah</span>
                  <span className="data-value">Dec 13, 2025</span>
                  <span className="status-badge status-review">Review</span>
                </div>
              </div>
              <div className="data-card data-card-2">
                <div className="data-row">
                  <span className="data-value">IMG-7</span>
                  <span className="data-value">O Evangelista</span>
                  <span className="data-value">Nov 22, 2025</span>
                  <span className="status-badge status-review">Review</span>
                </div>
              </div>
              <div className="data-card data-card-3">
                <div className="data-row">
                  <span className="data-value">IMG-9</span>
                  <span className="data-value">Annotator</span>
                  <span className="data-value">Nov 22, 2025</span>
                  <span className="status-badge status-done">Done</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works" id="process">
        <div className="section-container">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            A simple and effective process to annotate plastic waste images.
          </p>
          <div className="works-grid">
            <div className="work-card work-card-green">
              <div className="work-icon work-icon-green">
                <Edit3 size={32} />
              </div>
              <h3>Annotate Images</h3>
              <p>Easily label and classify plastic waste in images using our intuitive annotation tools.</p>
              <button className="learn-more">Learn More →</button>
            </div>
            <div className="work-card work-card-orange">
              <div className="work-icon work-icon-orange">
                <Eye size={32} />
              </div>
              <h3>Review & Approve</h3>
              <p>Seamlessly review and approve annotations with built-in feedback and approval workflows.</p>
              <button className="learn-more">Learn More →</button>
            </div>
            <div className="work-card work-card-teal">
              <div className="work-icon work-icon-teal">
                <DollarSign size={32} />
              </div>
              <h3>Track Payments</h3>
              <p>Monitor and manage payouts for completed annotations. Get rewarded for your work.</p>
              <button className="learn-more">Learn More →</button>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started Section */}
      <section className="get-started" id="features">
        <div className="section-container">
          <h2 className="section-title">Get Started Today</h2>
          <p className="section-subtitle">
            Join PlastiTrack and start annotating plastic waste images to make a difference.
          </p>
          <div className="started-grid">
            <div className="started-card started-card-green">
              <div className="started-icon started-icon-green">
                <Upload size={32} />
              </div>
              <h3>Upload</h3>
              <p>Admins upload images of plastic waste for annotation.</p>
              <button className="learn-more">Learn More →</button>
            </div>
            <div className="started-card started-card-orange">
              <div className="started-icon started-icon-orange">
                <Edit3 size={32} />
              </div>
              <h3>Annotate</h3>
              <p>Annotators label and classify plastic waste in the images.</p>
              <button className="learn-more">Learn More →</button>
            </div>
            <div className="started-card started-card-teal">
              <div className="started-icon started-icon-teal">
                <CheckCircle size={32} />
              </div>
              <h3>Review</h3>
              <p>Reviewers ensure accuracy and approve the annotations.</p>
              <button className="learn-more">Learn More →</button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <p>&copy; 2025 PlastiTrack. All rights reserved.</p>
      </footer>
    </div>
  );
}
