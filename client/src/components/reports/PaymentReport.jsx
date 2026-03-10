import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useReportsData, usePaginatedData } from "../../hooks/useReportsData";
import { ExportService } from "../../services/ExportService";
import { FilterManager, ReportHeader, PaginationControls, KPICard } from "./FilterManager";

/**
 * Payment Report Component
 * Tracks annotator payments with status filtering and detailed tables
 */
export const PaymentReport = () => {
  const { fetchData, loading, error, clearCache } = useReportsData();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [pageSize, setPageSize] = useState(20);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { paginatedData, currentPage, totalPages, goToPage } = usePaginatedData(
    payments,
    pageSize
  );

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const data = await fetchData(
          "/api/dashboard/reports/payment-report",
          {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            status: statusFilter !== "all" ? statusFilter : undefined,
          }
        );
        setPayments(data.payments || []);
        setSummary(data.summary || {});
      } catch (err) {
        console.error("Failed to load payment report:", err);
      }
    };

    loadPayments();
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
    clearCache("payment-report");
  }, [goToPage, clearCache]);

  const getStatusColor = (status) => {
    switch (status) {
      case "paid":
        return { bg: "#d4edda", color: "#155724" };
      case "approved":
        return { bg: "#d1ecf1", color: "#0c5460" };
      case "rejected":
        return { bg: "#f8d7da", color: "#721c24" };
      case "pending":
        return { bg: "#fff3cd", color: "#856404" };
      default:
        return { bg: "#f8f9fa", color: "#6c757d" };
    }
  };

  const handleExportExcel = () => {
    const data = payments.map((payment) => ({
      "Annotator Name": payment.annotatorName,
      "Completed Tasks": payment.completedTasks,
      "Payment Amount (Rs)": payment.amount,
      "Status": payment.status.toUpperCase(),
      "Approved By": payment.approvedBy || "-",
      "Payment Date": payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "-",
    }));
    ExportService.exportToExcel(data, "payment-report.xlsx", "Payments");
  };

  const handleExportPDF = async () => {
    const rows = (payments || []).map((payment) => ({
      "Annotator Name": payment.annotatorName,
      "Completed Tasks": payment.completedTasks,
      "Amount (Rs)": payment.amount,
      Status: payment.status,
      "Approved By": payment.approvedBy || "-",
      "Payment Date": payment.paymentDate
        ? new Date(payment.paymentDate).toLocaleDateString()
        : "-",
    }));

    await ExportService.exportReportTemplateToPDF(
      {
        title: "Payment Report",
        filters: {
          startDate,
          endDate,
          status: statusFilter === "all" ? "All" : statusFilter,
        },
        kpis: [
          { label: "Total Payments", value: summary.totalPayments || 0 },
          { label: "Total Amount (Rs)", value: (summary.totalAmount || 0).toLocaleString("en-IN") },
          { label: "Pending", value: summary.pendingCount || 0 },
          { label: "Approved", value: summary.approvedCount || 0 },
          { label: "Paid", value: summary.paidCount || 0 },
          { label: "Rejected", value: summary.rejectedCount || 0 },
        ],
        tables: [
          {
            title: "Payment Details",
            columns: [
              "Annotator Name",
              "Completed Tasks",
              "Amount (Rs)",
              "Status",
              "Approved By",
              "Payment Date",
            ],
            rows,
          },
        ],
      },
      "payment-report.pdf",
      { orientation: "landscape", documentTitle: "Payment Report" }
    );
  };

  if (error) {
    return <div style={{ color: "#d32f2f", padding: "16px" }}>Error: {error}</div>;
  }

  return (
    <div id="payment-report">
      <ReportHeader
        title="Payment Report"
        description="Annotator payment tracking and approval status"
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
      />

      <FilterManager
        filters={{ startDate, endDate, statusFilter }}
        onFilterChange={handleFilterChange}
        showDateFilters
        showRoleFilter={false}
        showStatusFilter
        statusOptions={["pending", "approved", "paid", "rejected"]}
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
          Loading payment data...
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <KPICard
              label="Total Payments"
              value={summary.totalPayments || 0}
              icon="💰"
              color="#4D96FF"
              loading={loading}
            />
            <KPICard
              label="Total Amount (Rs)"
              value={(summary.totalAmount || 0).toLocaleString("en-IN")}
              icon="💵"
              color="#6BCB77"
              loading={loading}
            />
            <KPICard
              label="Pending"
              value={summary.pendingCount || 0}
              icon="⏳"
              color="#FFB74D"
              loading={loading}
            />
            <KPICard
              label="Approved"
              value={summary.approvedCount || 0}
              icon="✓"
              color="#4D96FF"
              loading={loading}
            />
            <KPICard
              label="Paid"
              value={summary.paidCount || 0}
              icon="💳"
              color="#6BCB77"
              loading={loading}
            />
            <KPICard
              label="Rejected"
              value={summary.rejectedCount || 0}
              icon="✗"
              color="#FF6B6B"
              loading={loading}
            />
          </div>

          {/* Payment Table */}
          {payments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
              No payment data available for the selected filters
            </div>
          ) : (
            <>
              <div className="table-container" style={{ marginBottom: "12px", overflowX: "auto" }}>
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Annotator Name</th>
                      <th>Completed Tasks</th>
                      <th>Amount (Rs)</th>
                      <th>Status</th>
                      <th>Approved By</th>
                      <th>Payment Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((payment) => {
                      const statusColor = getStatusColor(payment.status);
                      return (
                        <tr key={payment.id}>
                          <td style={{ fontWeight: "500" }}>
                            {payment.annotatorName}
                          </td>
                          <td>{payment.completedTasks}</td>
                          <td style={{ fontWeight: "500", color: "#2c3e50" }}>
                            Rs. {payment.amount.toLocaleString("en-IN")}
                          </td>
                          <td>
                            <span
                              style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "500",
                                backgroundColor: statusColor.bg,
                                color: statusColor.color,
                              }}
                            >
                              {payment.status.charAt(0).toUpperCase() +
                                payment.status.slice(1)}
                            </span>
                          </td>
                          <td>{payment.approvedBy || "-"}</td>
                          <td>
                            {payment.paymentDate
                              ? new Date(payment.paymentDate).toLocaleDateString()
                              : "-"}
                          </td>
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
                totalItems={payments.length}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentReport;
