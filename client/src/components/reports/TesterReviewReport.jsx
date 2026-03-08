import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useReportsData, usePaginatedData } from "../../hooks/useReportsData";
import { ExportService } from "../../services/ExportService";
import { ReportHeader, PaginationControls, KPICard } from "./FilterManager";

/**
 * Tester Review Report Component
 * Shows tester approval/rejection statistics and review times
 */
export const TesterReviewReport = () => {
  const { fetchData, loading, error, clearCache } = useReportsData();
  const [testerRows, setTesterRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [pageSize, setPageSize] = useState(20);

  const { paginatedData, currentPage, totalPages, goToPage } = usePaginatedData(
    testerRows,
    pageSize
  );

  useEffect(() => {
    const loadTesterReview = async () => {
      try {
        const data = await fetchData("/api/dashboard/reports/tester-review");
        setTesterRows(data.testers || []);
        setSummary(data.summary || {});
      } catch (err) {
        console.error("Failed to load tester review:", err);
      }
    };

    loadTesterReview();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    clearCache("tester-review");
  }, [clearCache]);

  const formatHours = (minutes) => {
    if (!minutes) return "-";
    return `${(minutes / 60).toFixed(2)} h`;
  };

  const handleExportExcel = () => {
    const data = testerRows.map((row) => ({
      "Tester Name": row.name,
      "Assigned Images": row.assignedCount,
      "Approved Images": row.approvedCount,
      "Rejected Images": row.rejectedCount,
      "Accuracy Rate %": row.accuracyRate.toFixed(1),
      "Avg Review Time (hrs)": (row.avgReviewMinutes / 60).toFixed(2),
    }));
    ExportService.exportToExcel(data, "tester-review.xlsx", "Testers");
  };

  const handleExportPDF = async () => {
    await ExportService.exportToPDF(
      "tester-review-report",
      "tester-review.pdf"
    );
  };

  if (error) {
    return <div style={{ color: "#d32f2f", padding: "16px" }}>Error: {error}</div>;
  }

  return (
    <div id="tester-review-report">
      <ReportHeader
        title="Tester Review Report"
        description="Approved vs rejected outcomes and review time analysis"
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
      >
        <button
          onClick={handleRefresh}
          className="btn-secondary"
          style={{ padding: "6px 12px", fontSize: "13px" }}
        >
          ↻ Refresh
        </button>
      </ReportHeader>

      {loading ? (
        <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
          Loading tester review data...
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          {summary && (
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
                value={testerRows.length}
                icon="👥"
                color="#4D96FF"
              />
              <KPICard
                label="Total Assigned"
                value={testerRows.reduce((sum, r) => sum + r.assignedCount, 0)}
                icon="📋"
                color="#FFA07A"
              />
              <KPICard
                label="Total Approved"
                value={testerRows.reduce((sum, r) => sum + r.approvedCount, 0)}
                icon="✓"
                color="#6BCB77"
              />
              <KPICard
                label="Total Rejected"
                value={testerRows.reduce((sum, r) => sum + r.rejectedCount, 0)}
                icon="✗"
                color="#FF6B6B"
              />
              <KPICard
                label="Avg Accuracy"
                value={
                  testerRows.length > 0
                    ? `${(
                        testerRows.reduce((sum, r) => sum + r.accuracyRate, 0) /
                        testerRows.length
                      ).toFixed(1)}%`
                    : "0%"
                }
                icon="🎯"
                color="#8B5CF6"
              />
            </div>
          )}

          {/* Tester Table */}
          {testerRows.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
              No tester data available
            </div>
          ) : (
            <>
              <div className="table-container" style={{ marginBottom: "12px", overflowX: "auto" }}>
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Tester Name</th>
                      <th>Assigned Images</th>
                      <th style={{ color: "#6BCB77" }}>Approved</th>
                      <th style={{ color: "#FF6B6B" }}>Rejected</th>
                      <th>Approval Rate %</th>
                      <th>Accuracy Rate %</th>
                      <th>Avg Review Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((row) => {
                      const approvalRate = row.assignedCount > 0
                        ? ((row.approvedCount / row.assignedCount) * 100).toFixed(1)
                        : "0";
                      return (
                        <tr key={row.id}>
                          <td style={{ fontWeight: "500" }}>{row.name}</td>
                          <td>{row.assignedCount}</td>
                          <td style={{ color: "#6BCB77", fontWeight: "500" }}>
                            {row.approvedCount}
                          </td>
                          <td style={{ color: "#FF6B6B", fontWeight: "500" }}>
                            {row.rejectedCount}
                          </td>
                          <td>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                backgroundColor:
                                  Number(approvalRate) > 80
                                    ? "#d4edda"
                                    : Number(approvalRate) > 50
                                    ? "#fff3cd"
                                    : "#f8d7da",
                                color:
                                  Number(approvalRate) > 80
                                    ? "#155724"
                                    : Number(approvalRate) > 50
                                    ? "#856404"
                                    : "#721c24",
                                fontWeight: "500",
                              }}
                            >
                              {approvalRate}%
                            </span>
                          </td>
                          <td style={{ color: "#4D96FF", fontWeight: "500" }}>
                            {row.accuracyRate.toFixed(1)}%
                          </td>
                          <td>{formatHours(row.avgReviewMinutes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                totalItems={testerRows.length}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default TesterReviewReport;
