import React, { useState, useEffect, useCallback } from "react";
import { useReportsData, usePaginatedData } from "../../hooks/useReportsData";
import { ExportService } from "../../services/ExportService";
import { FilterManager, ReportHeader, PaginationControls, KPICard } from "./FilterManager";

/**
 * Image Details Report Component
 * Displays full image-level details with assignments, status and feedback
 */
export const ImageDetailsReport = () => {
  const { fetchData, loading, error, clearCache } = useReportsData();
  const [images, setImages] = useState([]);
  const [summary, setSummary] = useState({});
  const [pageSize, setPageSize] = useState(20);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { paginatedData, currentPage, totalPages, goToPage } = usePaginatedData(
    images,
    pageSize
  );

  useEffect(() => {
    const loadReport = async () => {
      try {
        const data = await fetchData(
          "/api/dashboard/reports/image-details",
          {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            status: statusFilter !== "all" ? statusFilter : undefined,
          }
        );
        setImages(data.images || []);
        setSummary(data.summary || {});
      } catch (err) {
        console.error("Failed to load image details report:", err);
      }
    };

    loadReport();
  }, [startDate, endDate, statusFilter, fetchData]);

  const handleFilterChange = useCallback((key, value) => {
    switch (key) {
      case "startDate":
        setStartDate(value);
        break;
      case "endDate":
        setEndDate(value);
        break;
      case "status":
        setStatusFilter(value);
        break;
      default:
        break;
    }
    goToPage(1);
    clearCache("image-details");
  }, [goToPage, clearCache]);

  const formatDate = (dateValue) => {
    if (!dateValue) return "-";
    return new Date(dateValue).toLocaleString();
  };

  const safeText = (text) => {
    return text && String(text).trim().length > 0 ? text : "-";
  };

  const handleExportExcel = () => {
    const data = images.map((img) => ({
      "Image ID": img.id,
      "Image Name": img.imageName,
      "Model Type": img.modelType,
      "Status": img.status,
      "Objects Count": img.objectsCount,
      "Annotator": img.annotatorName,
      "Tester": img.testerName,
      "Melbourne User": img.melbourneUserName,
      "Annotator Feedback": safeText(img.annotatorFeedback),
      "Tester Feedback": safeText(img.testerFeedback),
      "Melbourne Feedback": safeText(img.melbourneFeedback),
      "Previous Annotator": safeText(img.previousAnnotatorName),
      "Previous Tester": safeText(img.previousTesterName),
      "Previous Feedback": safeText(img.previousFeedback),
      "Created At": formatDate(img.createdAt),
      "Updated At": formatDate(img.updatedAt),
      "Annotation Assigned": formatDate(img.annotationAssignedDate),
      "Annotation Completed": formatDate(img.annotationCompletedDate),
      "Testing Assigned": formatDate(img.testingAssignedDate),
      "Testing Completed": formatDate(img.testingCompletedDate),
    }));
    ExportService.exportToExcel(data, "image-details-report.xlsx", "Image Details");
  };

  const handleExportPDF = async () => {
    const coreRows = (images || []).map((img) => ({
      "Image ID": img.id,
      "Image Name": img.imageName,
      Model: img.modelType,
      Status: img.status,
      Objects: img.objectsCount,
      Annotator: img.annotatorName,
      Tester: img.testerName,
      Melbourne: img.melbourneUserName,
    }));

    const feedbackRows = (images || []).map((img) => ({
      "Image ID": img.id,
      "Annotator Feedback": safeText(img.annotatorFeedback),
      "Tester Feedback": safeText(img.testerFeedback),
      "Melbourne Feedback": safeText(img.melbourneFeedback),
      "Previous Annotator": safeText(img.previousAnnotatorName),
      "Previous Tester": safeText(img.previousTesterName),
      "Previous Feedback": safeText(img.previousFeedback),
    }));

    const timelineRows = (images || []).map((img) => ({
      "Image ID": img.id,
      Created: formatDate(img.createdAt),
      Updated: formatDate(img.updatedAt),
      "Annotation Assigned": formatDate(img.annotationAssignedDate),
      "Annotation Completed": formatDate(img.annotationCompletedDate),
      "Testing Assigned": formatDate(img.testingAssignedDate),
      "Testing Completed": formatDate(img.testingCompletedDate),
    }));

    await ExportService.exportReportTemplateToPDF(
      {
        title: "Image Details Report",
        filters: {
          startDate,
          endDate,
          status: statusFilter === "all" ? "All" : statusFilter,
        },
        kpis: [
          { label: "Total Images", value: summary.totalImages || 0 },
          { label: "Total Objects", value: summary.totalObjects || 0 },
        ],
        tables: [
          {
            title: "Core Image Details",
            columns: [
              "Image ID",
              "Image Name",
              "Model",
              "Status",
              "Objects",
              "Annotator",
              "Tester",
              "Melbourne",
            ],
            rows: coreRows,
          },
          {
            title: "Feedback and Previous Assignments",
            columns: [
              "Image ID",
              "Annotator Feedback",
              "Tester Feedback",
              "Melbourne Feedback",
              "Previous Annotator",
              "Previous Tester",
              "Previous Feedback",
            ],
            rows: feedbackRows,
          },
          {
            title: "Timeline",
            columns: [
              "Image ID",
              "Created",
              "Updated",
              "Annotation Assigned",
              "Annotation Completed",
              "Testing Assigned",
              "Testing Completed",
            ],
            rows: timelineRows,
          },
        ],
      },
      "image-details-report.pdf",
      { orientation: "landscape", documentTitle: "Image Details Report" }
    );
  };

  if (error) {
    return <div style={{ color: "#d32f2f", padding: "16px" }}>Error: {error}</div>;
  }

  return (
    <div id="image-details-report">
      <ReportHeader
        title="Image Details Report"
        description="Complete image-level details including assignments, status history and feedback"
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
      />

      <FilterManager
        filters={{ startDate, endDate, statusFilter }}
        onFilterChange={handleFilterChange}
        showDateFilters
        showRoleFilter={false}
        showStatusFilter
        statusOptions={["pending", "in_progress", "completed", "pending_review", "approved", "rejected"]}
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
          Loading image details...
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <KPICard
              label="Total Images"
              value={summary.totalImages || 0}
              icon="🖼"
              color="#4D96FF"
              loading={loading}
            />
            <KPICard
              label="Total Objects"
              value={summary.totalObjects || 0}
              icon="🔢"
              color="#6BCB77"
              loading={loading}
            />
          </div>

          {images.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
              No image details found for selected filters
            </div>
          ) : (
            <>
              <div className="table-container" style={{ marginBottom: "12px", overflowX: "auto" }}>
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Image ID</th>
                      <th>Image Name</th>
                      <th>Model</th>
                      <th>Status</th>
                      <th>Objects</th>
                      <th>Annotator</th>
                      <th>Tester</th>
                      <th>Melbourne</th>
                      <th>Annotator Feedback</th>
                      <th>Tester Feedback</th>
                      <th>Melbourne Feedback</th>
                      <th>Previous Annotator</th>
                      <th>Previous Tester</th>
                      <th>Previous Feedback</th>
                      <th>Created</th>
                      <th>Updated</th>
                      <th>Annotation Assigned</th>
                      <th>Annotation Completed</th>
                      <th>Testing Assigned</th>
                      <th>Testing Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((img) => (
                      <tr key={img.id}>
                        <td>{img.id}</td>
                        <td style={{ fontWeight: "500" }}>{img.imageName}</td>
                        <td>{img.modelType}</td>
                        <td>{img.status}</td>
                        <td>{img.objectsCount}</td>
                        <td>{img.annotatorName}</td>
                        <td>{img.testerName}</td>
                        <td>{img.melbourneUserName}</td>
                        <td>{safeText(img.annotatorFeedback)}</td>
                        <td>{safeText(img.testerFeedback)}</td>
                        <td>{safeText(img.melbourneFeedback)}</td>
                        <td>{safeText(img.previousAnnotatorName)}</td>
                        <td>{safeText(img.previousTesterName)}</td>
                        <td>{safeText(img.previousFeedback)}</td>
                        <td>{formatDate(img.createdAt)}</td>
                        <td>{formatDate(img.updatedAt)}</td>
                        <td>{formatDate(img.annotationAssignedDate)}</td>
                        <td>{formatDate(img.annotationCompletedDate)}</td>
                        <td>{formatDate(img.testingAssignedDate)}</td>
                        <td>{formatDate(img.testingCompletedDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                totalItems={images.length}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ImageDetailsReport;
