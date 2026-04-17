import React, { useCallback, useState } from "react";
import axios from "axios";
import ErrorBoundary from "../../components/reports/ErrorBoundary";
import { ExportService } from "../../services/ExportService";
import { AnnotationSummaryReport } from "../../components/reports/AnnotationSummaryReport";
import { AnnotatorPerformanceReport } from "../../components/reports/AnnotatorPerformanceReport";
import { TesterReviewReport } from "../../components/reports/TesterReviewReport";
import { PaymentReport } from "../../components/reports/PaymentReport";
import { ImageDetailsReport } from "../../components/reports/ImageDetailsReport";
import PaymentEligibility from "./PaymentEligibility";
import "./admin.css";

export default function AdminReports() {
  const [activeReport, setActiveReport] = useState("summary");
  const [generalError, setGeneralError] = useState("");
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const reports = [
    {
      id: "summary",
      label: "Annotation Summary",
      icon: "",
      component: AnnotationSummaryReport,
    },
    {
      id: "performance",
      label: "Annotator Performance",
      icon: "",
      component: AnnotatorPerformanceReport,
    },
    {
      id: "tester",
      label: "Tester Review",
      icon: "",
      component: TesterReviewReport,
    },
    {
      id: "image-details",
      label: "Image Details",
      icon: "",
      component: ImageDetailsReport,
    },
    {
      id: "payment-eligibility",
      label: "Payment Eligible",
      icon: "",
      component: PaymentEligibility,
    },
    {
      id: "payment",
      label: "Payment Report",
      icon: "",
      component: PaymentReport,
    },
  ];

  const handleDownloadAllPDF = useCallback(async () => {
    if (isDownloadingAll) return;
    const headers = {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    };
    const formatDate = (value) => (value ? new Date(value).toLocaleString() : "-");
    const safeText = (value) => (value && String(value).trim() ? value : "-");

    try {
      setIsDownloadingAll(true);
      const [summaryRes, annotatorRes, testerRes, imageRes, paymentEligibilityRes, paymentRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/reports/annotation-summary`, { headers }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/reports/annotator-performance`, { headers }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/reports/tester-review`, { headers }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/reports/image-details`, { headers }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/admin/payment-eligibility`, { headers }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/dashboard/reports/payment-report`, { headers }),
      ]);

      const summaryData = summaryRes.data || {};
      const annotatorData = annotatorRes.data || {};
      const testerData = testerRes.data || {};
      const imageData = imageRes.data || {};
      const paymentEligibilityData = paymentEligibilityRes.data || {};
      const paymentData = paymentRes.data || {};

      const paymentEligibilityTasks = paymentEligibilityData.tasks || [];
      const paymentEligibilitySummary = {
        total: paymentEligibilityTasks.length,
        eligible: paymentEligibilityTasks.filter((task) => task.eligible_for_payment).length,
        notEligible: paymentEligibilityTasks.filter((task) => !task.eligible_for_payment).length,
        reassigned: paymentEligibilityTasks.filter((task) => Number(task.total_assignments || 0) > 1).length,
      };

      const reportsForPdf = [
        {
          title: "Annotation Summary Report",
          filters: summaryData.filters || {},
          charts: [
            {
              title: "Image Status Distribution",
              type: "pie",
              data: summaryData.pie || [],
              colors: ["#8B0000", "#FF6B6B", "#FFA07A", "#FFB6C1", "#DDA0DD", "#FF69B4"],
            },
            {
              title: "User Contributions",
              type: "bar",
              labelKey: "name",
              data: (summaryData.userContributions || []).map((row) => ({
                name: row.name?.split(" ")?.[0] || row.name || row.email,
                completed: Number(row.completed_count || 0),
                total: Number(row.images_count || 0),
              })),
              series: [
                { key: "completed", label: "Completed", color: "#6BCB77" },
                { key: "total", label: "Total", color: "#4D96FF" },
              ],
            },
            {
              title: "Progress Over Time",
              type: "bar",
              labelKey: "date",
              data: (summaryData.progressOverTime || []).map((item) => ({
                date: item.date,
                pending: Number(item.pending || 0),
                inProgress: Number(item.in_progress || 0),
                completed: Number(item.completed || 0),
                approved: Number(item.approved || 0),
                rejected: Number(item.rejected || 0),
              })),
              series: [
                { key: "pending", label: "Pending", color: "#FF6B6B" },
                { key: "inProgress", label: "In Progress", color: "#FFA07A" },
                { key: "completed", label: "Completed", color: "#98D8C8" },
                { key: "approved", label: "Approved", color: "#6BCB77" },
                { key: "rejected", label: "Rejected", color: "#FF5252" },
              ],
            },
          ],
          kpis: [
            { label: "Total Image Sets", value: summaryData.summary?.totalImageSets || 0 },
            { label: "Total Assigned", value: summaryData.summary?.totalAssigned || 0 },
            { label: "Completed", value: summaryData.summary?.completedAnnotations || 0 },
            { label: "Pending", value: summaryData.summary?.pendingAnnotations || 0 },
            { label: "Rejected", value: summaryData.summary?.rejectedAnnotations || 0 },
            { label: "Approval Rate", value: `${Number(summaryData.summary?.approvalRate || 0).toFixed(1)}%` },
          ],
          tables: [
            {
              title: "Status Distribution",
              columns: ["Status", "Count"],
              rows: (summaryData.pie || []).map((row) => ({ Status: row.name, Count: row.value })),
            },
            {
              title: "Performance by Annotator",
              columns: ["Name", "Assigned", "Completed"],
              rows: (summaryData.performance || []).map((row) => ({
                Name: row.name,
                Assigned: row.assigned,
                Completed: row.completed,
              })),
            },
          ],
        },
        {
          title: "Annotator Performance Report",
          filters: annotatorData.filters || {},
          charts: [
            {
              title: "Annotator Status Comparison",
              type: "bar",
              labelKey: "name",
              data: (annotatorData.rows || []).map((row) => ({
                name: row.name,
                assigned: Number(row.totalAssigned || 0),
                completed: Number(row.completed || 0),
                approved: Number(row.approved || 0),
                rejected: Number(row.rejected || 0),
              })),
              series: [
                { key: "assigned", label: "Assigned", color: "#4D96FF" },
                { key: "completed", label: "Completed", color: "#6BCB77" },
                { key: "approved", label: "Approved", color: "#8B5CF6" },
                { key: "rejected", label: "Rejected", color: "#FF6B6B" },
              ],
            },
          ],
          kpis: [
            { label: "Total Annotators", value: (annotatorData.rows || []).length },
            {
              label: "Avg Accuracy",
              value: `${((annotatorData.rows || []).reduce((sum, row) => sum + Number(row.accuracyRate || 0), 0) / Math.max((annotatorData.rows || []).length, 1)).toFixed(1)}%`,
            },
            { label: "Total Assigned", value: (annotatorData.rows || []).reduce((sum, row) => sum + Number(row.totalAssigned || 0), 0) },
            { label: "Total Completed", value: (annotatorData.rows || []).reduce((sum, row) => sum + Number(row.completed || 0), 0) },
          ],
          tables: [
            {
              title: "Annotator Performance",
              columns: ["Name", "Total Assigned", "Completed", "In Progress", "Under Review", "Approved", "Rejected", "Reassigned", "Approved Objects", "Accuracy %", "Avg Completion Time (hrs)"],
              rows: (annotatorData.rows || []).map((row) => ({
                Name: row.name,
                "Total Assigned": row.totalAssigned,
                Completed: row.completed,
                "In Progress": row.inProgress,
                "Under Review": row.underReview,
                Approved: row.approved,
                Rejected: row.rejected,
                Reassigned: row.reassigned,
                "Approved Objects": row.approvedObjects,
                "Accuracy %": `${Number(row.accuracyRate || 0).toFixed(1)}%`,
                "Avg Completion Time (hrs)": (Number(row.avgCompletionMinutes || 0) / 60).toFixed(2),
              })),
            },
          ],
        },
        {
          title: "Tester Performance Report",
          filters: testerData.filters || {},
          charts: [
            {
              title: "Tester Status Comparison",
              type: "bar",
              labelKey: "name",
              data: (testerData.rows || []).map((row) => ({
                name: row.name,
                assigned: Number(row.totalAssigned || 0),
                approved: Number(row.approved || 0),
                rejected: Number(row.rejected || 0),
              })),
              series: [
                { key: "assigned", label: "Assigned", color: "#4D96FF" },
                { key: "approved", label: "Approved", color: "#6BCB77" },
                { key: "rejected", label: "Rejected", color: "#FF6B6B" },
              ],
            },
          ],
          kpis: [
            { label: "Total Testers", value: (testerData.rows || []).length },
            {
              label: "Avg Accuracy",
              value: `${((testerData.rows || []).reduce((sum, row) => sum + Number(row.accuracy || 0), 0) / Math.max((testerData.rows || []).length, 1)).toFixed(1)}%`,
            },
            { label: "Total Assigned", value: (testerData.rows || []).reduce((sum, row) => sum + Number(row.totalAssigned || 0), 0) },
            { label: "Total Approved", value: (testerData.rows || []).reduce((sum, row) => sum + Number(row.approved || 0), 0) },
            { label: "Total Rejected", value: (testerData.rows || []).reduce((sum, row) => sum + Number(row.rejected || 0), 0) },
          ],
          tables: [
            {
              title: "Tester Performance",
              columns: ["Name", "Total Assigned", "Approved", "Rejected", "Under Review", "Total Time (hrs)", "Accuracy %", "Avg Review Time (hrs)"],
              rows: (testerData.rows || []).map((row) => ({
                Name: row.name,
                "Total Assigned": row.totalAssigned,
                Approved: row.approved,
                Rejected: row.rejected,
                "Under Review": row.underReview,
                "Total Time (hrs)": (Number(row.totalReviewMinutes || 0) / 60).toFixed(2),
                "Accuracy %": `${Number(row.accuracy || 0).toFixed(1)}%`,
                "Avg Review Time (hrs)": (Number(row.avgReviewMinutes || 0) / 60).toFixed(2),
              })),
            },
          ],
        },
        {
          title: "Image Details Report",
          filters: imageData.filters || {},
          charts: [
            {
              title: "Image Status Mix",
              type: "pie",
              data: Object.entries((imageData.images || []).reduce((counts, img) => {
                const key = String(img.status || "unknown").replace(/_/g, " ");
                counts[key] = (counts[key] || 0) + 1;
                return counts;
              }, {})).map(([name, value]) => ({ name, value })),
              colors: ["#4D96FF", "#6BCB77", "#FFA07A", "#FF6B6B", "#9C27B0"],
            },
          ],
          kpis: [
            { label: "Total Images", value: imageData.summary?.totalImages || 0 },
            { label: "Total Objects", value: imageData.summary?.totalObjects || 0 },
          ],
          tables: [
            {
              title: "Core Image Details",
              columns: ["Image ID", "Image Name", "Model", "Status", "Objects", "Annotator", "Tester", "Melbourne"],
              rows: (imageData.images || []).map((img) => ({
                "Image ID": img.id,
                "Image Name": img.imageName,
                Model: img.modelType,
                Status: img.status,
                Objects: img.objectsCount,
                Annotator: img.annotatorName,
                Tester: img.testerName,
                Melbourne: img.melbourneUserName,
              })),
            },
            {
              title: "Feedback and Previous Assignments",
              columns: ["Image ID", "Annotator Feedback", "Tester Feedback", "Melbourne Feedback", "Previous Annotator", "Previous Tester", "Previous Feedback"],
              rows: (imageData.images || []).map((img) => ({
                "Image ID": img.id,
                "Annotator Feedback": safeText(img.annotatorFeedback),
                "Tester Feedback": safeText(img.testerFeedback),
                "Melbourne Feedback": safeText(img.melbourneFeedback),
                "Previous Annotator": safeText(img.previousAnnotatorName),
                "Previous Tester": safeText(img.previousTesterName),
                "Previous Feedback": safeText(img.previousFeedback),
              })),
            },
            {
              title: "Timeline",
              columns: ["Image ID", "Created", "Updated", "Annotation Assigned", "Annotation Completed", "Testing Assigned", "Testing Completed"],
              rows: (imageData.images || []).map((img) => ({
                "Image ID": img.id,
                Created: formatDate(img.createdAt),
                Updated: formatDate(img.updatedAt),
                "Annotation Assigned": formatDate(img.annotationAssignedDate),
                "Annotation Completed": formatDate(img.annotationCompletedDate),
                "Testing Assigned": formatDate(img.testingAssignedDate),
                "Testing Completed": formatDate(img.testingCompletedDate),
              })),
            },
          ],
        },
        {
          title: "Payment Eligible Report",
          filters: paymentEligibilityData.filters || {},
          charts: [
            {
              title: "Eligibility Mix",
              type: "pie",
              data: [
                { name: "Eligible", value: paymentEligibilitySummary.eligible },
                { name: "Not Eligible", value: paymentEligibilitySummary.notEligible },
                { name: "Reassigned", value: paymentEligibilitySummary.reassigned },
              ],
              colors: ["#6BCB77", "#FF6B6B", "#FFA07A"],
            },
          ],
          kpis: [
            { label: "Total Records", value: paymentEligibilitySummary.total },
            { label: "Eligible", value: paymentEligibilitySummary.eligible },
            { label: "Not Eligible", value: paymentEligibilitySummary.notEligible },
            { label: "Reassigned Cases", value: paymentEligibilitySummary.reassigned },
          ],
          tables: [
            {
              title: "Eligibility Details",
              columns: [
                "Image ID",
                "Image Name",
                "Annotator Name",
                "Annotator Email",
                "Status",
                "Assigned Date",
                "Completed Date",
                "Assigned By",
                "Total Assignments",
                "Payment Eligible",
              ],
              rows: paymentEligibilityTasks.map((task) => ({
                "Image ID": task.image_id,
                "Image Name": task.image_name,
                "Annotator Name": task.annotator_name,
                "Annotator Email": task.annotator_email,
                Status: task.status,
                "Assigned Date": task.assigned_date ? new Date(task.assigned_date).toLocaleString() : "-",
                "Completed Date": task.completed_date ? new Date(task.completed_date).toLocaleString() : "-",
                "Assigned By": task.assigned_by_name || "-",
                "Total Assignments": Number(task.total_assignments || 0),
                "Payment Eligible": task.eligible_for_payment ? "ELIGIBLE" : "NOT ELIGIBLE",
              })),
            },
          ],
        },
        {
          title: "Payment Report",
          filters: paymentData.filters || {},
          charts: [
            {
              title: "Payment Status Mix",
              type: "pie",
              data: [
                { name: "Pending", value: paymentData.summary?.pendingCount || 0 },
                { name: "Approved", value: paymentData.summary?.approvedCount || 0 },
                { name: "Paid", value: paymentData.summary?.paidCount || 0 },
                { name: "Rejected", value: paymentData.summary?.rejectedCount || 0 },
              ],
              colors: ["#FFB74D", "#4D96FF", "#6BCB77", "#FF6B6B"],
            },
          ],
          kpis: [
            { label: "Total Payments", value: paymentData.summary?.totalPayments || 0 },
            { label: "Total Amount (Rs)", value: Number(paymentData.summary?.totalAmount || 0).toLocaleString("en-IN") },
            { label: "Pending", value: paymentData.summary?.pendingCount || 0 },
            { label: "Approved", value: paymentData.summary?.approvedCount || 0 },
            { label: "Paid", value: paymentData.summary?.paidCount || 0 },
            { label: "Rejected", value: paymentData.summary?.rejectedCount || 0 },
          ],
          tables: [
            {
              title: "Payment Details",
              columns: ["Annotator Name", "Completed Tasks", "Amount (Rs)", "Status", "Approved By", "Payment Date"],
              rows: (paymentData.payments || []).map((payment) => ({
                "Annotator Name": payment.annotatorName,
                "Completed Tasks": payment.completedTasks,
                "Amount (Rs)": payment.amount,
                Status: payment.status,
                "Approved By": payment.approvedBy || "-",
                "Payment Date": payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "-",
              })),
            },
          ],
        },
      ];

      await ExportService.exportAllReportTemplatesToPDF(
        reportsForPdf,
        `all-reports-${new Date().toISOString().slice(0, 10)}.pdf`,
        { orientation: "landscape", documentTitle: "PlastiTrack Reports" }
      );
      setGeneralError("");
    } catch (err) {
      console.error("All reports export error:", err);
      setGeneralError(err?.response?.data?.error || err.message || "Failed to download all reports");
    } finally {
      setIsDownloadingAll(false);
    }
  }, [isDownloadingAll]);

  const ActiveComponent = reports.find((r) => r.id === activeReport)?.component;

  return (
    <>
      <div className="dashboard-header">
        <h1>Reports and Analytics</h1>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleDownloadAllPDF}
              disabled={isDownloadingAll}
              className="btn-primary"
              style={{ padding: "6px 12px", fontSize: "13px", opacity: isDownloadingAll ? 0.7 : 1 }}
              title="Download all reports in one PDF"
            >
              {isDownloadingAll ? "Preparing PDF..." : "Download All PDF"}
            </button>
        </div>
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

      <div>
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
    </>
  );
}
