import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  const [annotatorName, setAnnotatorName] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredAnnotatorPerf = useMemo(() => {
    const needle = String(annotatorName || "").trim().toLowerCase();
    if (!needle) return annotatorPerf;
    return annotatorPerf.filter((row) => String(row.name || "").toLowerCase().includes(needle));
  }, [annotatorPerf, annotatorName]);

  const annotatorNameOptions = useMemo(() => {
    return Array.from(new Set((annotatorPerf || []).map((row) => String(row.name || "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
  }, [annotatorPerf]);

  const { currentPage, totalPages, goToPage } = usePaginatedData(
    filteredAnnotatorPerf,
    pageSize
  );

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (filteredAnnotatorPerf.length === 0) return null;
    return {
      totalAnnotators: filteredAnnotatorPerf.length,
      avgAccuracy: (
        filteredAnnotatorPerf.reduce((sum, row) => sum + Number(row.accuracyRate || 0), 0) /
        filteredAnnotatorPerf.length
      ).toFixed(1),
      totalAssigned: filteredAnnotatorPerf.reduce((sum, row) => sum + Number(row.totalAssigned || 0), 0),
      totalCompleted: filteredAnnotatorPerf.reduce((sum, row) => sum + Number(row.completed || 0), 0),
      approvedObjects: filteredAnnotatorPerf.reduce((sum, row) => sum + Number(row.approvedObjects || 0), 0),
    };
  }, [filteredAnnotatorPerf]);

  const chartData = useMemo(() => {
    return (filteredAnnotatorPerf || []).map((row) => ({
      name: row.name,
      assigned: Number(row.totalAssigned || 0),
      completed: Number(row.completed || 0),
      approved: Number(row.approved || 0),
      rejected: Number(row.rejected || 0),
    }));
  }, [filteredAnnotatorPerf]);

  const chartSeriesOrder = useMemo(
    () => ({ assigned: 0, completed: 1, approved: 2, rejected: 3 }),
    []
  );

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
    if (key === "annotatorName") setAnnotatorName(value);
    goToPage(1);
    clearCache("annotator-performance");
  }, [goToPage, clearCache]);

  const handleResetFilters = useCallback(() => {
    setStartDate("");
    setEndDate("");
    setAnnotatorName("");
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
    let sorted = [...filteredAnnotatorPerf];
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
  }, [filteredAnnotatorPerf, sortConfig]);

  const displayData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleExportExcel = () => {
    const data = filteredAnnotatorPerf.map((row) => ({
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
    const tableRows = (filteredAnnotatorPerf || []).map((row) => ({
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
        charts: [
          {
            title: "Annotator Status Comparison",
            type: "bar",
            labelKey: "name",
            data: chartData,
            series: [
              { key: "assigned", label: "Assigned", color: "#4D96FF" },
              { key: "completed", label: "Completed", color: "#6BCB77" },
              { key: "approved", label: "Approved", color: "#8B5CF6" },
              { key: "rejected", label: "Rejected", color: "#FF6B6B" },
            ],
          },
        ],
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
        filters={{ startDate, endDate, annotatorName }}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        showDateFilters
        showRoleFilter={false}
        showStatusFilter={false}
        customFilters={[
          {
            id: "annotatorName",
            label: "Annotator",
            type: "search-select",
            placeholder: "Search/select annotator name",
            options: annotatorNameOptions,
            width: "240px",
          },
        ]}
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
                color="#4D96FF"
              />
              <KPICard
                label="Avg Accuracy"
                value={`${stats.avgAccuracy}%`}
                color="#6BCB77"
              />
              <KPICard
                label="Total Assigned"
                value={stats.totalAssigned}
                color="#FFA07A"
              />
              <KPICard
                label="Total Completed"
                value={stats.totalCompleted}
                color="#8B5CF6"
              />
              <KPICard
                label="Approved Objects"
                value={stats.approvedObjects}
                color="#FF6B9D"
              />
            </div>
          )}

          {chartData.length > 0 && (
            <div className="chart-container" style={{ marginBottom: "20px" }}>
              <h4 style={{ marginTop: 0, color: "#ffffff" }}>Annotator Status Comparison</h4>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(value, name) => {
                        const labelMap = {
                          assigned: "Assigned",
                          completed: "Completed",
                          approved: "Approved",
                          rejected: "Rejected",
                        };
                        return [value, labelMap[name] || name];
                      }}
                      itemSorter={(entry) => chartSeriesOrder[entry?.dataKey] ?? 999}
                    />
                    <Legend
                      payload={[
                        { value: "Assigned", type: "square", color: "#4D96FF", id: "assigned" },
                        { value: "Completed", type: "square", color: "#6BCB77", id: "completed" },
                        { value: "Approved", type: "square", color: "#8B5CF6", id: "approved" },
                        { value: "Rejected", type: "square", color: "#FF6B6B", id: "rejected" },
                      ]}
                    />
                    <Bar dataKey="assigned" fill="#4D96FF" name="Assigned" />
                    <Bar dataKey="completed" fill="#6BCB77" name="Completed" />
                    <Bar dataKey="approved" fill="#8B5CF6" name="Approved" />
                    <Bar dataKey="rejected" fill="#FF6B6B" name="Rejected" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Data Table */}
          {filteredAnnotatorPerf.length === 0 ? (
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
                totalItems={filteredAnnotatorPerf.length}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AnnotatorPerformanceReport;
