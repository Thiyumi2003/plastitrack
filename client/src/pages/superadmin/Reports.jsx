import React, { useState } from "react";
import Sidebar from "./Sidebar";
import ErrorBoundary from "../../components/reports/ErrorBoundary";
import { AnnotationSummaryReport } from "../../components/reports/AnnotationSummaryReport";
import { AnnotatorPerformanceReport } from "../../components/reports/AnnotatorPerformanceReport";
import { TesterReviewReport } from "../../components/reports/TesterReviewReport";
import { PaymentReport } from "../../components/reports/PaymentReport";
import "./superadmin.css";

export default function Reports() {
  const [activeReport, setActiveReport] = useState("summary");
  const [generalError, setGeneralError] = useState("");

  const reports = [
    {
      id: "summary",
      label: "Annotation Summary",
      icon: "Summary",
      component: AnnotationSummaryReport,
    },
    {
      id: "performance",
      label: "Annotator Performance",
      icon: "Performance",
      component: AnnotatorPerformanceReport,
    },
    {
      id: "tester",
      label: "Tester Review",
      icon: "Tester",
      component: TesterReviewReport,
    },
    {
      id: "payment",
      label: "Payment Report",
      icon: "Payment",
      component: PaymentReport,
    },
  ];

  const ActiveComponent = reports.find((r) => r.id === activeReport)?.component;

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Reports and Analytics</h1>
          <div className="header-date">{new Date().toLocaleDateString()}</div>
        </div>

        {generalError && (
          <div
            style={{
              backgroundColor: "#fff2f0",
              color: "#8b0000",
              padding: "12px 16px",
              borderRadius: "6px",
              marginBottom: "16px",
              border: "1px solid #ffccc7",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{generalError}</span>
            <button
              onClick={() => setGeneralError("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              x
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "20px",
            overflowX: "auto",
            paddingBottom: "8px",
            borderBottom: "2px solid #e8e8e8",
          }}
        >
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id)}
              style={{
                padding: "10px 16px",
                border: "none",
                borderBottom: activeReport === report.id ? "3px solid #0066cc" : "none",
                backgroundColor: activeReport === report.id ? "#e6f2ff" : "transparent",
                color: activeReport === report.id ? "#0066cc" : "#666",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: activeReport === report.id ? "600" : "400",
                whiteSpace: "nowrap",
                borderRadius: "4px 4px 0 0",
                transition: "all 0.2s ease",
              }}
            >
              {report.icon} {report.label}
            </button>
          ))}
        </div>

        {ActiveComponent && (
          <ErrorBoundary key={activeReport}>
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <ActiveComponent />
            </div>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
