import { Link } from "react-router-dom";
import { useState } from "react";
import { Edit3, Eye, DollarSign, Upload, CheckCircle, X } from "lucide-react";
import './home.css';
import logo from '../images/logo (2).png';
import heroImage from '../images/home.png';

export default function Home() {
  const [modalContent, setModalContent] = useState(null);

  const learnMoreContent = {
    annotationWorkflow: {
      title: "Annotation Workflow",
      details: [
        "Annotators receive assigned image sets from admins.",
        "They complete annotation tasks using external annotation tools.",
        "After finishing, they update the status in PlastiTrack.",
        "The system tracks progress such as In Progress, Completed, or Pending Review."
      ],
      example: "PlastiTrack helps manage the annotation workflow by allowing annotators to update task progress and mark assigned image sets as completed."
    },
    reviewApprove: {
      title: "Review and Approval Process",
      details: [
        "Testers review completed annotation tasks.",
        "They check annotation accuracy and quality.",
        "Tasks can be approved or rejected.",
        "Rejected tasks return to annotators for correction."
      ],
      example: "The review process ensures the accuracy of plastic waste annotations before they are finalized for dataset use."
    },
    trackPayments: {
      title: "Payment Tracking",
      details: [
        "The system calculates payments based on completed annotation tasks.",
        "Payment records are generated for annotators and testers.",
        "The Super Admin validates and approves payments.",
        "Reports can be generated for payment history."
      ],
      example: "PlastiTrack provides payment tracking and reporting features to manage rewards for completed annotation work."
    },
    manageImageSets: {
      title: "Image Set Management",
      details: [
        "Admins upload plastic waste image datasets.",
        "Images are grouped into image sets.",
        "Admins allocate image sets to annotators.",
        "Each image set has a status: Assigned, In Progress, Pending Review, or Completed."
      ],
      example: "PlastiTrack allows administrators to upload and manage plastic waste image datasets. Image sets are assigned to annotators to track annotation progress efficiently."
    },
    annotationTaskWorkflow: {
      title: "Annotation Task Workflow",
      details: [
        "Annotators receive assigned image sets.",
        "They complete annotations using external tools.",
        "They update task status in the system.",
        "Progress tracking is available in the dashboard."
      ],
      example: "Annotators work on assigned image sets and update the task status in PlastiTrack. The system tracks annotation progress and ensures tasks move through the correct workflow stages."
    },
    review: {
      title: "Review and Approval Process",
      details: [
        "Testers review completed annotation tasks.",
        "Melbourne users perform final validation.",
        "Tasks can be approved or rejected.",
        "Rejected tasks return to annotators for correction."
      ],
      example: "Completed annotations are reviewed to ensure accuracy. Reviewers can approve or reject tasks, maintaining high-quality plastic waste datasets."
    }
  };

  const openModal = (contentKey) => {
    setModalContent(learnMoreContent[contentKey]);
  };

  const closeModal = () => {
    setModalContent(null);
  };

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
            <Link to="/register" className="btn-cta">Sign Up</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">Empowering Plastic<br />Waste Management</h1>
            <p className="hero-subtitle">
              PlastiTrack is a management platform designed to organize plastic waste image annotation workflows, review processes, reporting and payment tracking for completed annotation tasks.<br />
              
            </p>
            <div className="hero-buttons">
              <Link to="/register" className="btn-get-started">Get Started</Link>
              <Link to="/login" className="btn-login">Sign In</Link>
              
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
              <h3>Annotation Workflow Management</h3>
              <p>Annotators update annotation progress and mark images as completed.</p>
              <button className="learn-more" onClick={() => openModal('annotationWorkflow')}>Learn More →</button>
            </div>
            <div className="work-card work-card-orange">
              <div className="work-icon work-icon-orange">
                <Eye size={32} />
              </div>
              <h3>Review & Approve</h3>
              <p>Seamlessly review and approve annotations with built-in feedback and approval workflows.</p>
              <button className="learn-more" onClick={() => openModal('reviewApprove')}>Learn More →</button>
            </div>
            <div className="work-card work-card-teal">
              <div className="work-icon work-icon-teal">
                <DollarSign size={32} />
              </div>
              <h3>Track Payments</h3>
              <p>Monitor payments and generate reports for completed annotation tasks. Payments are approved by the Super Admin.</p>
              <button className="learn-more" onClick={() => openModal('trackPayments')}>Learn More →</button>
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
              <h3>Manage Image Sets</h3>
              <p>Admins upload and allocate image sets for annotation.</p>
              <button className="learn-more" onClick={() => openModal('manageImageSets')}>Learn More →</button>
            </div>
            <div className="started-card started-card-orange">
              <div className="started-icon started-icon-orange">
                <Edit3 size={32} />
              </div>
              <h3>Annotation Workflow</h3>
              <p>Annotators complete annotation tasks and update the status of assigned image sets.</p>
              <button className="learn-more" onClick={() => openModal('annotationTaskWorkflow')}>Learn More →</button>
            </div>
            <div className="started-card started-card-teal">
              <div className="started-icon started-icon-teal">
                <CheckCircle size={32} />
              </div>
              <h3>Review</h3>
              <p>Reviewers ensure annotation quality and approve or reject submissions.</p>
              <button className="learn-more" onClick={() => openModal('review')}>Learn More →</button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <p>&copy; 2025 PlastiTrack. All rights reserved.</p>
      </footer>

      {/* Learn More Modal */}
      {modalContent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              <X size={24} />
            </button>
            <h2 className="modal-title">{modalContent.title}</h2>
            <div className="modal-details">
              <h3>Details:</h3>
              <ul className="modal-list">
                {modalContent.details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </div>
            <div className="modal-example">
              <h3>Example:</h3>
              <p>{modalContent.example}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
