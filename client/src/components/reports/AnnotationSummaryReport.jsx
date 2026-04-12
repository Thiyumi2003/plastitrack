import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { formatChartDate } from "../../utils/dateUtils";

/**
 * Annotation Summary Report Component
 * Shows overall annotation statistics and KPIs
 */
export const AnnotationSummaryReport = () => {
  const { fetchData, loading, error, clearCache } = useReportsData();
  const [summary, setSummary] = useState(null);
  const [summaryPie, setSummaryPie] = useState([]);
  const [summaryPerf, setSummaryPerf] = useState([]);
  const [summaryProgress, setSummaryProgress] = useState([]);
  const [summaryUserContrib, setSummaryUserContrib] = useState([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const summaryColors = ["#8B0000", "#FF6B6B", "#FFA07A", "#FFB6C1", "#DDA0DD", "#FF69B4"];
  const dashboardPieColors = ["#8B0000", "#FF6B6B", "#FFA07A", "#FFB6C1", "#DDA0DD", "#FF69B4"];

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await fetchData("/api/dashboard/reports/annotation-summary", {
          role: roleFilter === "all" ? undefined : roleFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        const progressSource = Array.isArray(data.progressOverTime) ? data.progressOverTime : [];
        
          let dashboardData = null;
          try {
            dashboardData = await fetchData("/api/dashboard/reports");
          } catch (dashboardErr) {
            console.warn("Dashboard contributions fallback load failed:", dashboardErr);
          }

        setSummary(data.summary || {});
        setSummaryPie(data.pie || []);
        setSummaryPerf(data.performance || []);
        setSummaryUserContrib(
            (dashboardData?.userContributions || data.userContributions || []).map((item) => ({
            name: item.name?.split(" ")?.[0] || item.email || "Unknown",
            completed: Number(item.completed_count || 0),
            total: Number(item.images_count || 0),
          }))
        );
        setSummaryProgress(
          (progressSource || []).map((item) => ({
            date: formatChartDate(item.date),
            pending: Number(item.pending || 0),
            inProgress: Number(item.in_progress || 0),
            completed: Number(item.completed || 0),
            approved: Number(item.approved || 0),
            rejected: Number(item.rejected || 0),
          }))
        );
      } catch (err) {
        console.error("Failed to load annotation summary:", err);
      }
    };

    loadSummary();
  }, [startDate, endDate, roleFilter, fetchData]);

  const userContributionData =
    summaryUserContrib.length > 0
      ? summaryUserContrib
      : (summaryPerf || []).map((item) => ({
          name: item.name?.split(" ")?.[0] || item.name,
          completed: Number(item.completed || 0),
          total: Number(item.assigned || 0),
        }));

  const statusChartData = (summaryPie || []).map((item) => ({
    name: String(item.name || "").toLowerCase(),
    value: Number(item.value || 0),
  }));

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
        charts: [
          {
            title: "Image Status Distribution",
            type: "pie",
            data: statusChartData,
            colors: dashboardPieColors,
          },
          {
            title: "User Contributions",
            type: "bar",
            labelKey: "name",
            data: userContributionData,
            series: [
              { key: "completed", label: "Completed", color: "#6BCB77" },
              { key: "total", label: "Total", color: "#4D96FF" },
            ],
          },
          {
            title: "Progress Over Time",
            type: "bar",
            labelKey: "date",
            data: summaryProgress,
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

          <div className="charts-section">
            <div className="chart-container" style={{ margin: 0 }}>
              <h3>Progress Over Time</h3>
              {summaryProgress.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={summaryProgress}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="pending" stroke="#FF6B6B" />
                    <Line type="monotone" dataKey="inProgress" stroke="#FFA07A" />
                    <Line type="monotone" dataKey="completed" stroke="#98D8C8" />
                    <Line type="monotone" dataKey="approved" stroke="#6BCB77" />
                    <Line type="monotone" dataKey="rejected" stroke="#FF5252" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                  No data available
                </div>
              )}
            </div>

            <div className="chart-container" style={{ margin: 0 }}>
              <h3>User Contributions</h3>
              {userContributionData.length > 0 ? (
                <div style={{ width: "100%", overflowX: "auto" }}>
                  <BarChart
                    width={Math.max(700, userContributionData.length * 90)}
                    height={300}
                    data={userContributionData}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" fill="#6BCB77" name="Completed" />
                    <Bar dataKey="total" fill="#4D96FF" name="Total" />
                  </BarChart>
                </div>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                  No data available
                </div>
              )}
            </div>

            <div className="chart-container" style={{ margin: 0 }}>
              <h3>Image Status Distribution</h3>
              {statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={summaryColors[index % summaryColors.length]} />
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
          </div>
        </>
      )}
    </div>
  );
};

export default AnnotationSummaryReport;
