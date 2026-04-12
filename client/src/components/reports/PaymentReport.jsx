import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useReportsData, usePaginatedData } from "../../hooks/useReportsData";
import { ExportService } from "../../services/ExportService";
import { FilterManager, ReportHeader, PaginationControls, KPICard } from "./FilterManager";

/**
 * Payment Report Component
 * Displays full payment-level details for all roles.
 */
export const PaymentReport = () => {
  const { fetchData, loading, error, clearCache } = useReportsData();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [pageSize, setPageSize] = useState(20);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const chartColors = ["#6BCB77", "#4D96FF", "#FFB74D", "#FF6B6B", "#9C27B0", "#00B8D9"];

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
      case "ready_to_pay":
      case "approved":
        return { bg: "#d1ecf1", color: "#0c5460" };
      case "rejected":
        return { bg: "#f8d7da", color: "#721c24" };
      case "pending_calculation":
      case "pending_approval":
      case "pending":
        return { bg: "#fff3cd", color: "#856404" };
      default:
        return { bg: "#f8f9fa", color: "#6c757d" };
    }
  };

  const formatDate = (value) => (value ? new Date(value).toLocaleString() : "-");

  const paymentStatusData = useMemo(() => {
    const statusCounts = payments.reduce((accumulator, payment) => {
      const rawStatus = String(payment.status || "unknown");
      const normalizedStatus = rawStatus.replace(/_/g, " ");
      accumulator[normalizedStatus] = (accumulator[normalizedStatus] || 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(statusCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [payments]);

  const handleExportExcel = () => {
    const data = payments.map((payment, index) => ({
      "Payment ID": index + 1,
      "User Name": payment.userName || payment.annotatorName,
      Role: payment.userRole || "-",
      "User Email": payment.userEmail || payment.annotatorEmail || "-",
      "Model Type": payment.modelTypeDisplay || payment.modelType || "-",
      "Images Completed": payment.imagesCompleted ?? payment.completedTasks ?? 0,
      "Objects Count": payment.objectsCount ?? 0,
      Hours: Number(payment.hours || 0).toFixed(2),
      "Paid Minutes": payment.paidMinutes ?? 0,
      "Rate Used": Number(payment.rateUsed || 0).toFixed(2),
      "Minute Rate": Number(payment.minuteRate || 0).toFixed(2),
      "Payment Amount (Rs)": Number(payment.amount || 0).toFixed(2),
      Status: String(payment.status || "").toUpperCase(),
      Method: payment.paymentMethod || "-",
      "Approved By": payment.approvedBy || "-",
      "Approved Date": formatDate(payment.approvedDate),
      "Payment Date": formatDate(payment.paymentDate),
      "Created At": formatDate(payment.createdAt),
    }));
    ExportService.exportToExcel(data, "payment-report.xlsx", "Payments");
  };

  const handleExportPDF = async () => {
    const rows = (payments || []).map((payment, index) => ({
      "Payment ID": index + 1,
      "User Name": payment.userName || payment.annotatorName,
      Role: payment.userRole || "-",
      "User Email": payment.userEmail || payment.annotatorEmail || "-",
      "Model Type": payment.modelTypeDisplay || payment.modelType || "-",
      "Images Completed": payment.imagesCompleted ?? payment.completedTasks ?? 0,
      "Objects Count": payment.objectsCount ?? 0,
      Hours: Number(payment.hours || 0).toFixed(2),
      "Paid Minutes": payment.paidMinutes ?? 0,
      "Rate Used": Number(payment.rateUsed || 0).toFixed(2),
      "Minute Rate": Number(payment.minuteRate || 0).toFixed(2),
      "Amount (Rs)": Number(payment.amount || 0).toFixed(2),
      Status: payment.status,
      Method: payment.paymentMethod || "-",
      "Approved By": payment.approvedBy || "-",
      "Approved Date": formatDate(payment.approvedDate),
      "Payment Date": formatDate(payment.paymentDate),
      "Created At": formatDate(payment.createdAt),
    }));

    await ExportService.exportReportTemplateToPDF(
      {
        title: "Payment Report",
        filters: {
          startDate,
          endDate,
          status: statusFilter === "all" ? "All" : statusFilter,
        },
        charts: [
          {
            title: "Payment Status Mix",
            type: "pie",
            data: paymentStatusData,
            colors: chartColors,
          },
        ],
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
              "Payment ID",
              "User Name",
              "Role",
              "User Email",
              "Model Type",
              "Images Completed",
              "Objects Count",
              "Hours",
              "Paid Minutes",
              "Rate Used",
              "Minute Rate",
              "Amount (Rs)",
              "Status",
              "Method",
              "Approved By",
              "Approved Date",
              "Payment Date",
              "Created At",
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
        description="Complete payment report with all transaction details"
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
      />

      <FilterManager
        filters={{ startDate, endDate, statusFilter }}
        onFilterChange={handleFilterChange}
        showDateFilters
        showRoleFilter={false}
        showStatusFilter
        statusOptions={[
          "pending",
          "pending_calculation",
          "pending_approval",
          "approved",
          "ready_to_pay",
          "paid",
          "rejected",
        ]}
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

          {paymentStatusData.length > 0 && (
            <div className="chart-container" style={{ marginBottom: "20px" }}>
              <h4 style={{ marginTop: 0, color: "#ffffff" }}>Payment Status Mix</h4>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {paymentStatusData.map((entry, index) => (
                        <Cell key={`payment-pie-${entry.name}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, "Payments"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

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
                      <th>Payment ID</th>
                      <th>User Name</th>
                      <th>Role</th>
                      <th>Email</th>
                      <th>Model</th>
                      <th>Images</th>
                      <th>Objects</th>
                      <th>Hours</th>
                      <th>Paid Minutes</th>
                      <th>Rate Used</th>
                      <th>Minute Rate</th>
                      <th>Amount (Rs)</th>
                      <th>Status</th>
                      <th>Method</th>
                      <th>Approved By</th>
                      <th>Approved Date</th>
                      <th>Payment Date</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((payment, index) => {
                      const statusColor = getStatusColor(payment.status);
                      const paymentOrder = (currentPage - 1) * pageSize + index + 1;
                      return (
                        <tr key={payment.id}>
                          <td>{paymentOrder}</td>
                          <td style={{ fontWeight: "500" }}>
                            {payment.userName || payment.annotatorName}
                          </td>
                          <td>{payment.userRole || "-"}</td>
                          <td>{payment.userEmail || payment.annotatorEmail || "-"}</td>
                          <td>{payment.modelTypeDisplay || payment.modelType || "-"}</td>
                          <td>{payment.imagesCompleted ?? payment.completedTasks ?? 0}</td>
                          <td>{payment.objectsCount ?? 0}</td>
                          <td>{Number(payment.hours || 0).toFixed(2)}</td>
                          <td>{payment.paidMinutes ?? 0}</td>
                          <td>{Number(payment.rateUsed || 0).toFixed(2)}</td>
                          <td>{Number(payment.minuteRate || 0).toFixed(2)}</td>
                          <td style={{ fontWeight: "500", color: "#2c3e50" }}>
                            Rs. {Number(payment.amount || 0).toLocaleString("en-IN")}
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
                              {String(payment.status || "-").replace(/_/g, " ")}
                            </span>
                          </td>
                          <td>{payment.paymentMethod || "-"}</td>
                          <td>{payment.approvedBy || "-"}</td>
                          <td>{formatDate(payment.approvedDate)}</td>
                          <td>{formatDate(payment.paymentDate)}</td>
                          <td>{formatDate(payment.createdAt)}</td>
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
