import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useReportsData, usePaginatedData } from "../../hooks/useReportsData";
import { ExportService } from "../../services/ExportService";
import { FilterManager, ReportHeader, PaginationControls, KPICard } from "./FilterManager";

/**
 * Tester Performance Report Component
 * Detailed performance metrics for each tester with pagination and sorting
 */
export const TesterReviewReport = () => {
  const { fetchData, loading, error, clearCache } = useReportsData();
  const [testerPerf, setTesterPerf] = useState([]);
  const [pageSize, setPageSize] = useState(20);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { paginatedData, currentPage, totalPages, goToPage } = usePaginatedData(
    testerPerf,
    pageSize
  );

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (testerPerf.length === 0) return null;
    return {
      totalTesters: testerPerf.length,
      avgAccuracy: (
        testerPerf.reduce((sum, row) => sum + row.accuracy, 0) /
        testerPerf.length
      ).toFixed(1),
      totalAssigned: testerPerf.reduce((sum, row) => sum + row.totalAssigned, 0),
      totalApproved: testerPerf.reduce((sum, row) => sum + row.approved, 0),
      totalRejected: testerPerf.reduce((sum, row) => sum + row.rejected, 0),
    };
  }, [testerPerf]);

  useEffect(() => {
    const loadPerformance = async () => {
      try {
        const data = await fetchData(
          "/api/dashboard/reports/tester-review",
          {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          }
        );
        setTesterPerf(data.rows || []);
      } catch (err) {
        console.error("Failed to load tester performance:", err);
      }
    };

    loadPerformance();
  }, [startDate, endDate, fetchData]);

  const handleFilterChange = useCallback((key, value) => {
    if (key === "startDate") setStartDate(value);
    if (key === "endDate") setEndDate(value);
    goToPage(1);
    clearCache("tester-review");
  }, [goToPage, clearCache]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    let sorted = [...testerPerf];
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
  }, [testerPerf, sortConfig]);

  const displayData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleExportExcel = () => {
    const data = testerPerf.map((row) => ({
      "Name": row.name,
      "Total Assigned": row.totalAssigned,
      "Approved": row.approved,
      "Rejected": row.rejected,
      "Under Review": row.underReview,
      "Total Time (hrs)": (row.totalReviewMinutes / 60).toFixed(2),
      "Accuracy %": row.accuracy.toFixed(1),
      "Avg Review Time (hrs)": (row.avgReviewMinutes / 60).toFixed(2),
    }));
    ExportService.exportToExcel(
      data,
      "tester-performance.xlsx",
      "Performance"
    );
  };

  const handleExportPDF = async () => {
    const tableRows = (testerPerf || []).map((row) => ({
      Name: row.name,
      "Total Assigned": row.totalAssigned,
      Approved: row.approved,
      Rejected: row.rejected,
      "Under Review": row.underReview,
      "Total Time (hrs)": (Number(row.totalReviewMinutes || 0) / 60).toFixed(2),
      "Accuracy %": `${Number(row.accuracy || 0).toFixed(1)}%`,
      "Avg Review Time (hrs)": (Number(row.avgReviewMinutes || 0) / 60).toFixed(2),
    }));

    await ExportService.exportReportTemplateToPDF(
      {
        title: "Tester Performance Report",
        filters: { startDate, endDate },
        kpis: [
          { label: "Total Testers", value: stats?.totalTesters || 0 },
          { label: "Avg Accuracy", value: `${stats?.avgAccuracy || 0}%` },
          { label: "Total Assigned", value: stats?.totalAssigned || 0 },
          { label: "Total Approved", value: stats?.totalApproved || 0 },
          { label: "Total Rejected", value: stats?.totalRejected || 0 },
        ],
        tables: [
          {
            title: "Tester Performance",
            columns: [
              "Name",
              "Total Assigned",
              "Approved",
              "Rejected",
              "Under Review",
              "Total Time (hrs)",
              "Accuracy %",
              "Avg Review Time (hrs)",
            ],
            rows: tableRows,
          },
        ],
      },
      "tester-performance.pdf",
      { orientation: "landscape", documentTitle: "Tester Performance Report" }
    );
  };

  if (error) {
    return <div style={{ color: "#d32f2f", padding: "16px" }}>Error: {error}</div>;
  }

  return (
    <div id="tester-performance-report">
      <ReportHeader
        title="Tester Performance Report"
        description="Full performance metrics including approved, rejected, and under review tasks"
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
                label="Total Testers"
                value={stats.totalTesters}
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
                label="Total Approved"
                value={stats.totalApproved}
                icon="✓"
                color="#6BCB77"
              />
              <KPICard
                label="Total Rejected"
                value={stats.totalRejected}
                icon="✗"
                color="#FF6B6B"
              />
            </div>
          )}

          {/* Data Table */}
          {testerPerf.length === 0 ? (
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
                        onClick={() => handleSort("approved")}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        Approved {sortConfig.key === "approved" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        onClick={() => handleSort("rejected")}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        Rejected {sortConfig.key === "rejected" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th onClick={() => handleSort("underReview")} style={{ cursor: "pointer", userSelect: "none" }}>
                        Under Review {sortConfig.key === "underReview" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th onClick={() => handleSort("totalReviewMinutes")} style={{ cursor: "pointer", userSelect: "none" }}>
                        Total Time {sortConfig.key === "totalReviewMinutes" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        onClick={() => handleSort("accuracy")}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        Accuracy {sortConfig.key === "accuracy" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                      </th>
                      <th style={{ cursor: "default" }}>
                        Avg Review Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: "500" }}>{row.name}</td>
                        <td>{row.totalAssigned}</td>
                        <td style={{ color: "#6BCB77", fontWeight: "500" }}>
                          {row.approved}
                        </td>
                        <td style={{ color: "#FF6B6B", fontWeight: "500" }}>
                          {row.rejected}
                        </td>
                        <td style={{ color: "#FFA500" }}>{row.underReview}</td>
                        <td style={{ color: "#9C27B0" }}>
                          {(row.totalReviewMinutes / 60).toFixed(2)} hrs
                        </td>
                        <td style={{ color: "#4D96FF", fontWeight: "500" }}>
                          {row.accuracy.toFixed(1)}%
                        </td>
                        <td>{(row.avgReviewMinutes / 60).toFixed(2)} hrs</td>
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
                totalItems={testerPerf.length}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default TesterReviewReport;
