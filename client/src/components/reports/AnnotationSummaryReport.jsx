import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useReportsData, usePaginatedData } from "../../hooks/useReportsData";
import { ExportService } from "../../services/ExportService";
import { FilterManager, ReportHeader, KPICard } from "./FilterManager";

/**
 * Annotation Summary Report Component
 * Shows overall annotation statistics and KPIs
 */
export const AnnotationSummaryReport = () => {
  const { fetchData, loading, error, clearCache } = useReportsData();
  const [summary, setSummary] = useState(null);
  const [summaryPie, setSummaryPie] = useState([]);
  const [summaryPerf, setSummaryPerf] = useState([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const summaryColors = ["#6BCB77", "#FFA07A", "#FF6B6B", "#4D96FF"];

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await fetchData("/api/dashboard/reports/annotation-summary", {
          role: roleFilter === "all" ? undefined : roleFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        setSummary(data.summary || {});
        setSummaryPie(data.pie || []);
        setSummaryPerf(data.performance || []);
      } catch (err) {
        console.error("Failed to load annotation summary:", err);
      }
    };

    loadSummary();
  }, [startDate, endDate, roleFilter, fetchData]);

  const handleFilterChange = useCallback((key, value) => {
    switch (key) {
      case "startDate":
        setStartDate(value);
        break;
      case "endDate":
        setEndDate(value);
        break;
      case "role":
        setRoleFilter(value);
        break;
      default:
        break;
    }
    clearCache("annotation-summary");
  }, [clearCache]);

  const handleExportExcel = () => {
    const data = [
      {
        "Metric": "Total Image Sets",
        "Value": summary?.totalImageSets || 0,
      },
      {
        "Metric": "Total Assigned",
        "Value": summary?.totalAssigned || 0,
      },
      {
        "Metric": "Completed Annotations",
        "Value": summary?.completedAnnotations || 0,
      },
      {
        "Metric": "Pending Annotations",
        "Value": summary?.pendingAnnotations || 0,
      },
      {
        "Metric": "Rejected Annotations",
        "Value": summary?.rejectedAnnotations || 0,
      },
      {
        "Metric": "Approval Rate",
        "Value": `${(summary?.approvalRate || 0).toFixed(1)}%`,
      },
      ...summaryPerf.map((perf) => ({
        "Name": perf.name,
        "Assigned": perf.assigned,
        "Completed": perf.completed,
      })),
    ];
    ExportService.exportToExcel(data, "annotation-summary.xlsx", "Summary");
  };

  const handleExportPDF = async () => {
    const performanceRows = (summaryPerf || []).map((item) => ({
      Name: item.name,
      Assigned: item.assigned,
      Completed: item.completed,
    }));

    const statusRows = (summaryPie || []).map((item) => ({
      Status: item.name,
      Count: item.value,
    }));

    await ExportService.exportReportTemplateToPDF(
      {
        title: "Annotation Summary Report",
        filters: {
          role: roleFilter === "all" ? "All" : roleFilter,
          startDate,
          endDate,
        },
        kpis: [
          { label: "Total Image Sets", value: summary?.totalImageSets || 0 },
          { label: "Total Assigned", value: summary?.totalAssigned || 0 },
          { label: "Completed", value: summary?.completedAnnotations || 0 },
          { label: "Pending", value: summary?.pendingAnnotations || 0 },
          { label: "Rejected", value: summary?.rejectedAnnotations || 0 },
          { label: "Approval Rate", value: `${(summary?.approvalRate || 0).toFixed(1)}%` },
        ],
        tables: [
          {
            title: "Status Distribution",
            columns: ["Status", "Count"],
            rows: statusRows,
          },
          {
            title: "Performance by Annotator",
            columns: ["Name", "Assigned", "Completed"],
            rows: performanceRows,
          },
        ],
      },
      "annotation-summary.pdf",
      { orientation: "landscape", documentTitle: "Annotation Summary Report" }
    );
  };

  if (error) {
    return <div style={{ color: "#d32f2f", padding: "16px" }}>Error: {error}</div>;
  }

  return (
    <div id="annotation-summary-report">
      <ReportHeader
        title="Annotation Summary Report"
        description="Overview of annotation activity and performance metrics"
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
      />

      <FilterManager
        filters={{ roleFilter, startDate, endDate }}
        onFilterChange={handleFilterChange}
        showDateFilters
        showRoleFilter
        showStatusFilter={false}
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
          Loading summary data...
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <KPICard
              label="Total Image Sets"
              value={summary?.totalImageSets || 0}
              icon="📦"
              color="#4D96FF"
              loading={loading}
            />
            <KPICard
              label="Total Assigned"
              value={summary?.totalAssigned || 0}
              icon="📋"
              color="#FFA07A"
              loading={loading}
            />
            <KPICard
              label="Completed"
              value={summary?.completedAnnotations || 0}
              icon="✓"
              color="#6BCB77"
              loading={loading}
            />
            <KPICard
              label="Pending"
              value={summary?.pendingAnnotations || 0}
              icon="⏳"
              color="#FFB74D"
              loading={loading}
            />
            <KPICard
              label="Rejected"
              value={summary?.rejectedAnnotations || 0}
              icon="✗"
              color="#FF6B6B"
              loading={loading}
            />
            <KPICard
              label="Approval Rate"
              value={`${(summary?.approvalRate || 0).toFixed(1)}%`}
              icon="📊"
              color="#8B5CF6"
              loading={loading}
            />
          </div>

          {/* Charts */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Pie Chart */}
            <div className="chart-container" style={{ margin: 0 }}>
              <h4>Completed vs Pending</h4>
              {summaryPie.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={summaryPie}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={90}
                      dataKey="value"
                    >
                      {summaryPie.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={summaryColors[index % summaryColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                  No data available
                </div>
              )}
            </div>

            {/* Bar Chart */}
            <div className="chart-container" style={{ margin: 0 }}>
              <h4>Performance by Annotator</h4>
              {summaryPerf.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={summaryPerf}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="assigned" fill="#4D96FF" name="Assigned" />
                    <Bar dataKey="completed" fill="#6BCB77" name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                  No data available
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnnotationSummaryReport;
