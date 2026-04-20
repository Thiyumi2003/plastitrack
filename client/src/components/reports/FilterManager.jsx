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
  const handleDateChange = (field, value) => {
    onFilterChange(field, value);
  };

  const handleSelectChange = (field, value) => {
    onFilterChange(field, value);
  };

  return (
    <div className="filters-container" style={{
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
      alignItems: "center",
      padding: "12px",
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      backdropFilter: "blur(14px)",
      borderRadius: "6px",
      marginBottom: "16px",
      border: "1px solid rgba(255, 255, 255, 0.12)",
    }}>
      {/* Date Range Filters */}
      {showDateFilters && (
        <>
          <label style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.75)", marginRight: "4px" }}>
            Start Date:
          </label>
          <input
            type="date"
            value={filters.startDate || ""}
            onChange={(e) => handleDateChange("startDate", e.target.value)}
            className="text-input"
            style={{ padding: "6px 8px", fontSize: "13px" }}
          />
          <label style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.75)", marginLeft: "8px", marginRight: "4px" }}>
            End Date:
          </label>
          <input
            type="date"
            value={filters.endDate || ""}
            onChange={(e) => handleDateChange("endDate", e.target.value)}
            className="text-input"
            style={{ padding: "6px 8px", fontSize: "13px" }}
          />
        </>
      )}

      {/* Role Filter */}
      {showRoleFilter && (
        <>
          <label style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.75)", marginLeft: "8px", marginRight: "4px" }}>
            Role:
          </label>
          <select
            value={filters.role || "all"}
            onChange={(e) => handleSelectChange("role", e.target.value)}
            className="assign-select"
            style={{ minWidth: "120px", padding: "6px 8px", fontSize: "13px" }}
          >
            <option value="all">All Roles</option>
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Status Filter */}
      {showStatusFilter && (
        <>
          <label style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.75)", marginLeft: "8px", marginRight: "4px" }}>
            Status:
          </label>
          <select
            value={filters.status || "all"}
            onChange={(e) => handleSelectChange("status", e.target.value)}
            className="assign-select"
            style={{ minWidth: "120px", padding: "6px 8px", fontSize: "13px" }}
          >
            <option value="all">All Status</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Custom Filters */}
      {customFilters.map((filter) => (
        <div key={filter.id} style={{ marginLeft: "8px" }}>
          <label style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.75)", marginRight: "4px" }}>
            {filter.label}:
          </label>
          {filter.type === "select" ? (
            <select
              value={filters[filter.id] || ""}
              onChange={(e) => handleSelectChange(filter.id, e.target.value)}
              className="assign-select"
              style={{ minWidth: filter.width || "120px", padding: "6px 8px", fontSize: "13px" }}
            >
              <option value="">All</option>
              {filter.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : filter.type === "search-select" ? (
            <>
              <input
                type="text"
                list={`filter-list-${filter.id}`}
                value={filters[filter.id] || ""}
                onChange={(e) => handleSelectChange(filter.id, e.target.value)}
                placeholder={filter.placeholder || `Search ${filter.label}`}
                className="text-input"
                style={{ padding: "6px 8px", fontSize: "13px", minWidth: filter.width || "220px" }}
              />
              <datalist id={`filter-list-${filter.id}`}>
                {filter.options?.map((opt) => {
                  const value = typeof opt === "string" ? opt : opt.value;
                  return (
                    <option key={`${filter.id}-${value}`} value={value} />
                  );
                })}
              </datalist>
            </>
          ) : filter.type === "date" ? (
            <input
              type="date"
              value={filters[filter.id] || ""}
              onChange={(e) => handleSelectChange(filter.id, e.target.value)}
              className="text-input"
              style={{ padding: "6px 8px", fontSize: "13px" }}
            />
          ) : (
            <input
              type={filter.type || "text"}
              value={filters[filter.id] || ""}
              onChange={(e) => handleSelectChange(filter.id, e.target.value)}
              placeholder={filter.placeholder}
              className="text-input"
              style={{ padding: "6px 8px", fontSize: "13px", minWidth: filter.width || "120px" }}
            />
          )}
        </div>
      ))}

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="btn-secondary"
        style={{
          marginLeft: "auto",
          padding: "6px 12px",
          fontSize: "13px",
          whiteSpace: "nowrap",
        }}
      >
        Clear Filters
      </button>
    </div>
  );
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
