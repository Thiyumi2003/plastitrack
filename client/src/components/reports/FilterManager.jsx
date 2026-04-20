import React, { useMemo, useState } from "react";

/**
 * FilterManager Component
 * Provides unified filter controls across all reports with URL state persistence
 */
export const FilterManager = ({
  filters,
  onFilterChange,
  onMultipleFilterChange,
  onReset,
  availableRoles = ["annotator", "tester"],
  showDateFilters = true,
  showRoleFilter = true,
  showStatusFilter = false,
  statusOptions = ["pending", "approved", "paid", "rejected"],
  customFilters = [],
}) => {
  return null;
};

/**
 * Pagination Controls Component
 */
export const PaginationControls = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
}) => {
  return null;
};

/**
 * Report Header Component with export buttons
 */
export const ReportHeader = ({
  title,
  description,
  onExportExcel,
  onExportPDF,
  onExportCSV,
  showExportButtons = true,
  children,
}) => {
  const [exportStatus, setExportStatus] = useState("");
  const [exportStatusType, setExportStatusType] = useState("success");

  const runExport = async (exportFn, label) => {
    if (!exportFn) return;
    setExportStatus(`${label} download started...`);
    setExportStatusType("success");

    try {
      const result = await Promise.resolve(exportFn());
      if (result && result.success === false) {
        throw new Error(result.error || `${label} download failed`);
      }
      setExportStatus(`${label} downloaded successfully`);
      setExportStatusType("success");
    } catch (err) {
      setExportStatus(err?.message || `${label} download failed`);
      setExportStatusType("error");
    }
  };

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
        flexWrap: "wrap",
        marginBottom: "12px",
      }}>
        <div>
          <h3 style={{ margin: "0 0 4px 0", color: "#ffffff" }}>{title}</h3>
          {description && (
            <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.72)", fontSize: "13px" }}>{description}</p>
          )}
        </div>

        {showExportButtons && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {onExportExcel && (
              <button
                onClick={() => runExport(onExportExcel, "Excel")}
                className="btn-primary"
                title="Export to Excel"
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                📊 Excel
              </button>
            )}
            {onExportPDF && (
              <button
                onClick={() => runExport(onExportPDF, "PDF")}
                className="btn-primary"
                title="Export to PDF"
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                📄 PDF
              </button>
            )}
            {onExportCSV && (
              <button
                onClick={() => runExport(onExportCSV, "CSV")}
                className="btn-primary"
                title="Export to CSV"
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                📋 CSV
              </button>
            )}
          </div>
        )}
      </div>

      {exportStatus && (
        <div
          style={{
            marginBottom: "10px",
            fontSize: "12px",
            color: exportStatusType === "error" ? "#f87171" : "rgba(255, 255, 255, 0.8)",
          }}
        >
          {exportStatus}
        </div>
      )}

      {children}
    </div>
  );
};

/**
 * KPI Card Component for displaying key metrics
 */
export const KPICard = ({
  label,
  value,
  icon,
  color = "#4D96FF",
  trend,
  loading = false,
}) => {
  return (
    <div
      className="kpi-card"
      style={{
        backgroundColor: `${color}15`,
        borderLeft: `4px solid ${color}`,
        padding: "16px",
        borderRadius: "6px",
        minWidth: "150px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
            {label}
          </div>
          <div style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: color,
            marginBottom: "4px",
          }}>
            {loading ? "..." : value}
          </div>
          {trend && (
            <div style={{
              fontSize: "12px",
              color: trend.positive ? "#10b981" : "#ef4444",
            }}>
              {trend.positive ? "↑" : "↓"} {trend.value}%
            </div>
          )}
        </div>
        {icon && (
          <div style={{ fontSize: "24px", opacity: 0.3 }}>{icon}</div>
        )}
      </div>
    </div>
  );
};

export default FilterManager;
