import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useReportsData, usePaginatedData } from "../../hooks/useReportsData";
import { ExportService } from "../../services/ExportService";
import { FilterManager, ReportHeader, PaginationControls, KPICard } from "./FilterManager";

/**
 * Annotator Performance Report Component
 * Detailed performance metrics for each annotator with pagination and sorting
 */
export const AnnotatorPerformanceReport = () => {
  const { fetchData, loading, error, clearCache } = useReportsData();
  const [annotatorPerf, setAnnotatorPerf] = useState([]);
  const [pageSize, setPageSize] = useState(20);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { paginatedData, currentPage, totalPages, goToPage } = usePaginatedData(
    annotatorPerf,
    pageSize
  );

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (annotatorPerf.length === 0) return null;
    return {
      totalAnnotators: annotatorPerf.length,
      avgAccuracy: (
        annotatorPerf.reduce((sum, row) => sum + row.accuracyRate, 0) /
        annotatorPerf.length
      ).toFixed(1),
      totalAssigned: annotatorPerf.reduce((sum, row) => sum + row.totalAssigned, 0),
      totalCompleted: annotatorPerf.reduce((sum, row) => sum + row.completed, 0),
      approvedObjects: annotatorPerf.reduce((sum, row) => sum + row.approvedObjects, 0),
    };
  }, [annotatorPerf]);

  useEffect(() => {
    const loadPerformance = async () => {
      try {
        const data = await fetchData(
          "/api/dashboard/reports/annotator-performance",
          {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          }
        );
        setAnnotatorPerf(data.rows || []);
      } catch (err) {
        console.error("Failed to load annotator performance:", err);
      }
    };

    loadPerformance();
  }, [startDate, endDate, fetchData]);

  const handleFilterChange = useCallback((key, value) => {
    if (key === "startDate") setStartDate(value);
    if (key === "endDate") setEndDate(value);
    goToPage(1);
    clearCache("annotator-performance");
  }, [goToPage, clearCache]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    let sorted = [...annotatorPerf];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [annotatorPerf, sortConfig]);

  const displayData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleExportExcel = () => {
    const data = annotatorPerf.map((row) => ({
      "Name": row.name,
      "Total Assigned": row.totalAssigned,
      "Completed": row.completed,
      "In Progress": row.inProgress,
      "Under Review": row.underReview,
      "Approved": row.approved,
      "Rejected": row.rejected,
      "Reassigned": row.reassigned,
      "Approved Objects": row.approvedObjects,
      "Accuracy Rate %": row.accuracyRate.toFixed(1),
      "Avg Completion Time (hrs)": (row.avgCompletionMinutes / 60).toFixed(2),
    }));
    ExportService.exportToExcel(
      data,
      "annotator-performance.xlsx",
      "Performance"
    );
  };

  const handleExportPDF = async () => {
    const tableRows = (annotatorPerf || []).map((row) => ({
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
    }));

    await ExportService.exportReportTemplateToPDF(
      {
        title: "Annotator Performance Report",
        filters: { startDate, endDate },
        kpis: [
          { label: "Total Annotators", value: stats?.totalAnnotators || 0 },
          { label: "Avg Accuracy", value: `${stats?.avgAccuracy || 0}%` },
          { label: "Total Assigned", value: stats?.totalAssigned || 0 },
          { label: "Total Completed", value: stats?.totalCompleted || 0 },
          { label: "Approved Objects", value: stats?.approvedObjects || 0 },
        ],
        tables: [
          {
            title: "Annotator Performance",
            columns: [
              "Name",
              "Total Assigned",
              "Completed",
              "In Progress",
              "Under Review",
              "Approved",
              "Rejected",
              "Reassigned",
              "Approved Objects",
              "Accuracy %",
              "Avg Completion Time (hrs)",
            ],
            rows: tableRows,
          },
        ],
      },
      "annotator-performance.pdf",
      { orientation: "landscape", documentTitle: "Annotator Performance Report" }
    );
  };

  if (error) {
    return <div style={{ color: "#d32f2f", padding: "16px" }}>Error: {error}</div>;
  }

  return (
    <div id="annotator-performance-report">
      <ReportHeader
        title="Annotator Performance Report"
        description="Full historical performance metrics including current assignments, completed work, and previously rejected tasks"
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
      />

      <FilterManager
        filters={{ startDate, endDate }}
        onFilterChange={handleFilterChange}
        showDateFilters
        showRoleFilter={false}
        showStatusFilter={false}
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
          Loading performance data...
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          {stats && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <KPICard
                label="Total Annotators"
                value={stats.totalAnnotators}
                icon="👥"
                color="#4D96FF"
              />
              <KPICard
                label="Avg Accuracy"
                value={`${stats.avgAccuracy}%`}
                icon="🎯"
                color="#6BCB77"
              />
              <KPICard
                label="Total Assigned"
                value={stats.totalAssigned}
                icon="📋"
                color="#FFA07A"
              />
              <KPICard
                label="Total Completed"
                value={stats.totalCompleted}
                icon="✓"
                color="#8B5CF6"
              />
              <KPICard
                label="Approved Objects"
                value={stats.approvedObjects}
                icon="🎨"
                color="#FF6B9D"
              />
            </div>
          )}

          {/* Data Table */}
          {annotatorPerf.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
              No performance data available for the selected date range
            </div>
          ) : (
            <>
              <div className="table-container" style={{ marginBottom: "12px", overflowX: "auto" }}>
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th
                        onClick={() => handleSort("name")}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        Name {sortConfig.key === "name" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        onClick={() => handleSort("totalAssigned")}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        Total Assigned {sortConfig.key === "totalAssigned" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        onClick={() => handleSort("completed")}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        Completed {sortConfig.key === "completed" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        onClick={() => handleSort("inProgress")}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        In Progress {sortConfig.key === "inProgress" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th onClick={() => handleSort("underReview")} style={{ cursor: "pointer", userSelect: "none" }}>
                        Under Review {sortConfig.key === "underReview" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th onClick={() => handleSort("approved")} style={{ cursor: "pointer", userSelect: "none" }}>
                        Approved {sortConfig.key === "approved" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th onClick={() => handleSort("rejected")} style={{ cursor: "pointer", userSelect: "none" }}>
                        Rejected {sortConfig.key === "rejected" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th onClick={() => handleSort("reassigned")} style={{ cursor: "pointer", userSelect: "none" }}>
                        Reassigned {sortConfig.key === "reassigned" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th onClick={() => handleSort("approvedObjects")} style={{ cursor: "pointer", userSelect: "none" }}>
                        Approved Objects {sortConfig.key === "approvedObjects" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        onClick={() => handleSort("accuracyRate")}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        Accuracy {sortConfig.key === "accuracyRate" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th style={{ cursor: "default" }}>
                        Avg Completion Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: "500" }}>{row.name}</td>
                        <td>{row.totalAssigned}</td>
                        <td style={{ color: "#6BCB77", fontWeight: "500" }}>
                          {row.completed}
                        </td>
                        <td style={{ color: "#4D96FF" }}>{row.inProgress}</td>
                        <td style={{ color: "#FFA500" }}>{row.underReview}</td>
                        <td style={{ color: "#6BCB77" }}>{row.approved}</td>
                        <td style={{ color: "#FF6B6B" }}>{row.rejected}</td>
                        <td style={{ color: "#FF9800" }}>{row.reassigned}</td>
                        <td style={{ color: "#9C27B0" }}>{row.approvedObjects}</td>
                        <td style={{ color: "#4D96FF", fontWeight: "500" }}>
                          {row.accuracyRate.toFixed(1)}%
                        </td>
                        <td>{(row.avgCompletionMinutes / 60).toFixed(2)} hrs</td>
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
                totalItems={annotatorPerf.length}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AnnotatorPerformanceReport;
