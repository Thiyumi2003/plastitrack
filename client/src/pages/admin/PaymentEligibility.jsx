import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useReportsData, usePaginatedData } from "../../hooks/useReportsData";
import { ExportService } from "../../services/ExportService";
import { FilterManager, ReportHeader, PaginationControls, KPICard } from "../../components/reports/FilterManager";
import "./admin.css";

export default function PaymentEligibility() {
  const { fetchData, loading, error, clearCache } = useReportsData();
  const [tasks, setTasks] = useState([]);
  const [pageSize, setPageSize] = useState(20);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eligibleFilter, setEligibleFilter] = useState("all");
  const [annotatorFilter, setAnnotatorFilter] = useState("");
  const [imageFilter, setImageFilter] = useState("");

  useEffect(() => {
    const loadReport = async () => {
      const data = await fetchData("/api/dashboard/admin/payment-eligibility", {}, "payment-eligibility");
      setTasks(data.tasks || []);
    };
    loadReport();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const taskStatus = String(task.status || "").toLowerCase();
      const annotatorName = String(task.annotator_name || "").toLowerCase();
      const imageName = String(task.image_name || "").toLowerCase();
      const eligible = task.eligible_for_payment ? "eligible" : "not_eligible";

      const assignedDate = task.assigned_date ? new Date(task.assigned_date) : null;
      const rangeStart = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const rangeEnd = endDate ? new Date(`${endDate}T23:59:59`) : null;

      if (statusFilter !== "all" && taskStatus !== statusFilter) return false;
      if (eligibleFilter !== "all" && eligible !== eligibleFilter) return false;
      if (annotatorFilter && !annotatorName.includes(String(annotatorFilter).toLowerCase())) return false;
      if (imageFilter && !imageName.includes(String(imageFilter).toLowerCase())) return false;
      if (rangeStart && (!assignedDate || assignedDate < rangeStart)) return false;
      if (rangeEnd && (!assignedDate || assignedDate > rangeEnd)) return false;

      return true;
    });
  }, [tasks, statusFilter, eligibleFilter, annotatorFilter, imageFilter, startDate, endDate]);

  const summary = useMemo(() => {
    const eligibleCount = filteredTasks.filter((task) => task.eligible_for_payment).length;
    const notEligibleCount = filteredTasks.length - eligibleCount;
    const reassignedCount = filteredTasks.filter((task) => Number(task.total_assignments || 0) > 1).length;

    return {
      total: filteredTasks.length,
      eligible: eligibleCount,
      notEligible: notEligibleCount,
      reassigned: reassignedCount,
    };
  }, [filteredTasks]);

  const { paginatedData, currentPage, totalPages, goToPage } = usePaginatedData(
    filteredTasks,
    pageSize
  );

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
      case "eligible":
        setEligibleFilter(value);
        break;
      case "annotator":
        setAnnotatorFilter(value);
        break;
      case "image":
        setImageFilter(value);
        break;
      default:
        break;
    }
    goToPage(1);
  }, [goToPage]);

  const handleResetFilters = useCallback(() => {
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setEligibleFilter("all");
    setAnnotatorFilter("");
    setImageFilter("");
    goToPage(1);
    clearCache("payment-eligibility");
  }, [goToPage, clearCache]);

  const formatDate = (value) => (value ? new Date(value).toLocaleString() : "-");

  const handleExportExcel = () => {
    const rows = filteredTasks.map((task) => ({
      "Image ID": task.image_id,
      "Image Name": task.image_name,
      "Annotator Name": task.annotator_name,
      "Annotator Email": task.annotator_email,
      Status: task.status,
      "Assigned Date": formatDate(task.assigned_date),
      "Completed Date": formatDate(task.completed_date),
      "Assigned By": task.assigned_by_name || "-",
      "Total Assignments": Number(task.total_assignments || 0),
      "Payment Eligible": task.eligible_for_payment ? "ELIGIBLE" : "NOT ELIGIBLE",
    }));

    ExportService.exportToExcel(rows, "payment-eligible-report.xlsx", "Payment Eligible");
  };

  const handleExportPDF = async () => {
    const rows = filteredTasks.map((task) => ({
      "Image ID": task.image_id,
      "Image Name": task.image_name,
      "Annotator Name": task.annotator_name,
      "Annotator Email": task.annotator_email,
      Status: task.status,
      "Assigned Date": formatDate(task.assigned_date),
      "Completed Date": formatDate(task.completed_date),
      "Assigned By": task.assigned_by_name || "-",
      "Total Assignments": Number(task.total_assignments || 0),
      "Payment Eligible": task.eligible_for_payment ? "ELIGIBLE" : "NOT ELIGIBLE",
    }));

    await ExportService.exportReportTemplateToPDF(
      {
        title: "Payment Eligible Report",
        filters: {
          startDate,
          endDate,
          status: statusFilter === "all" ? "All" : statusFilter,
          eligibility: eligibleFilter === "all" ? "All" : eligibleFilter,
          annotator: annotatorFilter || "All",
          image: imageFilter || "All",
        },
        kpis: [
          { label: "Total Records", value: summary.total },
          { label: "Eligible", value: summary.eligible },
          { label: "Not Eligible", value: summary.notEligible },
          { label: "Reassigned Cases", value: summary.reassigned },
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
            rows,
          },
        ],
      },
      "payment-eligible-report.pdf",
      { orientation: "landscape", documentTitle: "Payment Eligible Report" }
    );
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  if (error) {
    return <div style={{ color: "#d32f2f", padding: "16px" }}>Error: {error}</div>;
  }

  return (
    <div id="payment-eligibility-report">
      <ReportHeader
        title="Payment Eligible Report"
        description="Eligibility view by image assignment history, reviewer outcome, and reassignment"
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
      />

      <FilterManager
        filters={{
          startDate,
          endDate,
          status: statusFilter,
          eligible: eligibleFilter,
          annotator: annotatorFilter,
          image: imageFilter,
        }}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        showDateFilters
        showRoleFilter={false}
        showStatusFilter
        statusOptions={["pending", "in_progress", "pending_review", "approved", "rejected"]}
        customFilters={[
          {
            id: "eligible",
            label: "Eligibility",
            type: "select",
            options: [
              { value: "eligible", label: "Eligible" },
              { value: "not_eligible", label: "Not Eligible" },
            ],
            width: "140px",
          },
          {
            id: "annotator",
            label: "Annotator",
            type: "text",
            placeholder: "Search annotator",
            width: "170px",
          },
          {
            id: "image",
            label: "Image",
            type: "text",
            placeholder: "Search image",
            width: "170px",
          },
        ]}
      />

      <div
        className="info-box"
        style={{
          background: "#e3f2fd",
          border: "1px solid #2196f3",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        <strong style={{ color: "#1976d2" }}>Payment Fairness Policy:</strong>
        <span style={{ marginLeft: "8px", color: "#334155", fontSize: "13px" }}>
          Eligible = accepted/in-review work. Not Eligible = rejected and reassigned. Only the successful final annotator is paid.
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <KPICard label="Total Records" value={summary.total} color="#4D96FF" loading={loading} />
        <KPICard label="Eligible" value={summary.eligible} color="#22c55e" loading={loading} />
        <KPICard label="Not Eligible" value={summary.notEligible} color="#ef4444" loading={loading} />
        <KPICard label="Reassigned Cases" value={summary.reassigned} color="#f59e0b" loading={loading} />
      </div>

      {filteredTasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          No payment eligible records found for selected filters
        </div>
      ) : (
        <>
          <div className="table-container" style={{ marginBottom: "12px", overflowX: "auto" }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Image ID</th>
                  <th>Image Name</th>
                  <th>Annotator</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Assigned Date</th>
                  <th>Completed Date</th>
                  <th>Assigned By</th>
                  <th>Total Assignments</th>
                  <th>Payment Eligible</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((task) => (
                  <tr key={task.id}>
                    <td>{task.image_id}</td>
                    <td style={{ fontWeight: "500" }}>{task.image_name || "-"}</td>
                    <td>{task.annotator_name || "-"}</td>
                    <td>{task.annotator_email || "-"}</td>
                    <td>{task.status || "-"}</td>
                    <td>{formatDate(task.assigned_date)}</td>
                    <td>{formatDate(task.completed_date)}</td>
                    <td>{task.assigned_by_name || "-"}</td>
                    <td>{Number(task.total_assignments || 0)}</td>
                    <td>
                      <span
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: task.eligible_for_payment ? "#166534" : "#991b1b",
                          backgroundColor: task.eligible_for_payment ? "#dcfce7" : "#fee2e2",
                        }}
                      >
                        {task.eligible_for_payment ? "ELIGIBLE" : "NOT ELIGIBLE"}
                      </span>
                    </td>
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
            totalItems={filteredTasks.length}
          />
        </>
      )}
    </div>
  );
}
