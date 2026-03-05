import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Sidebar from "./Sidebar";
import "./superadmin.css";

export default function Reports() {
  const [reports, setReports] = useState(null);
  const [performance, setPerformance] = useState({ users: [], filters: {} });
  const [systemPerf, setSystemPerf] = useState(null);
  const [annotationData, setAnnotationData] = useState([]);
  const [annStartDate, setAnnStartDate] = useState("");
  const [annEndDate, setAnnEndDate] = useState("");
  const [annRoleFilter, setAnnRoleFilter] = useState("all");
  const [annLoading, setAnnLoading] = useState(false);
  const [annotationSummary, setAnnotationSummary] = useState({ summary: null, pie: [], performance: [] });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [annotatorPerf, setAnnotatorPerf] = useState([]);
  const [annotatorPerfLoading, setAnnotatorPerfLoading] = useState(false);
  const [testerReview, setTesterReview] = useState({ summary: null });
  const [testerReviewLoading, setTesterReviewLoading] = useState(false);
  const [imageSetAllocation, setImageSetAllocation] = useState({ imageSets: [], totalSets: 0 });
  const [imageSetLoading, setImageSetLoading] = useState(false);
  const [imageSetStartDate, setImageSetStartDate] = useState("");
  const [imageSetEndDate, setImageSetEndDate] = useState("");
  const [paymentReport, setPaymentReport] = useState({ payments: [], summary: {} });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStartDate, setPaymentStartDate] = useState("");
  const [paymentEndDate, setPaymentEndDate] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [period, setPeriod] = useState("month");
  const [perfLoading, setPerfLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getAuthHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const response = await axios.get("http://localhost:5000/api/dashboard/reports", {
          headers: getAuthHeader(),
        });
        setReports(response.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setPerfLoading(true);
        const params = {
          role: roleFilter === "all" ? undefined : roleFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          period,
        };
        const perfRes = await axios.get("http://localhost:5000/api/dashboard/performance/users", {
          headers: getAuthHeader(),
          params,
        });
        const sysRes = await axios.get("http://localhost:5000/api/dashboard/performance/system", {
          headers: getAuthHeader(),
        });
        setPerformance(perfRes.data);
        setSystemPerf(sysRes.data);
      } catch (err) {
        console.error("Performance fetch error:", err);
        setError(err.response?.data?.error || "Failed to load performance data");
      } finally {
        setPerfLoading(false);
      }
    };

    fetchPerformance();
  }, [startDate, endDate, roleFilter, period]);

  useEffect(() => {
    const fetchAnnotationData = async () => {
      try {
        setAnnLoading(true);
        const params = {
          role: annRoleFilter === "all" ? undefined : annRoleFilter,
          startDate: annStartDate || undefined,
          endDate: annEndDate || undefined,
        };
        const res = await axios.get("http://localhost:5000/api/dashboard/detailed-annotations", {
          headers: getAuthHeader(),
          params,
        });
        const raw = res.data.data || [];
        const normalized = raw.map((row) => ({
          date: row.date ? new Date(row.date).toISOString().slice(0, 10) : "N/A",
          annotated_images: Number(row.annotated_images || 0),
          annotation_hrs: Number(row.annotation_hrs || 0),
          avg_annotation_hrs_per_image: Number(row.avg_annotation_hrs_per_image || 0),
          verified_images: Number(row.verified_images || 0),
          verification_hrs: Number(row.verification_hrs || 0),
          avg_verification_hrs_per_image: Number(row.avg_verification_hrs_per_image || 0),
          approved_annotations: Number(row.approved_annotations || 0),
          annotation_approval_rate: Number(row.annotation_approval_rate || 0),
        }));
        setAnnotationData(normalized);
      } catch (err) {
        console.error("Annotation data fetch error:", err);
        setError(err.response?.data?.error || "Failed to load annotation data");
      } finally {
        setAnnLoading(false);
      }
    };

    fetchAnnotationData();
  }, [annStartDate, annEndDate, annRoleFilter]);

  useEffect(() => {
    const fetchAnnotationSummary = async () => {
      try {
        setSummaryLoading(true);
        const params = {
          role: annRoleFilter === "all" ? undefined : annRoleFilter,
          startDate: annStartDate || undefined,
          endDate: annEndDate || undefined,
        };
        const res = await axios.get("http://localhost:5000/api/dashboard/reports/annotation-summary", {
          headers: getAuthHeader(),
          params,
        });
        setAnnotationSummary(res.data);
      } catch (err) {
        console.error("Annotation summary fetch error:", err);
        setError(err.response?.data?.error || "Failed to load annotation summary");
      } finally {
        setSummaryLoading(false);
      }
    };

    fetchAnnotationSummary();
  }, [annStartDate, annEndDate, annRoleFilter]);

  useEffect(() => {
    const fetchAnnotatorPerf = async () => {
      try {
        setAnnotatorPerfLoading(true);
        const params = {
          startDate: annStartDate || undefined,
          endDate: annEndDate || undefined,
        };
        const res = await axios.get("http://localhost:5000/api/dashboard/reports/annotator-performance", {
          headers: getAuthHeader(),
          params,
        });
        setAnnotatorPerf(res.data.rows || []);
      } catch (err) {
        console.error("Annotator performance fetch error:", err);
        setError(err.response?.data?.error || "Failed to load annotator performance");
      } finally {
        setAnnotatorPerfLoading(false);
      }
    };

    fetchAnnotatorPerf();
  }, [annStartDate, annEndDate]);

  useEffect(() => {
    const fetchTesterReview = async () => {
      try {
        setTesterReviewLoading(true);
        const res = await axios.get("http://localhost:5000/api/dashboard/reports/tester-review", {
          headers: getAuthHeader(),
        });
        setTesterReview(res.data);
      } catch (err) {
        console.error("Tester review fetch error:", err);
        setError(err.response?.data?.error || "Failed to load tester review report");
      } finally {
        setTesterReviewLoading(false);
      }
    };

    fetchTesterReview();
  }, []);

  useEffect(() => {
    const fetchImageSetAllocation = async () => {
      try {
        setImageSetLoading(true);
        const params = {
          startDate: imageSetStartDate || undefined,
          endDate: imageSetEndDate || undefined,
        };
        const res = await axios.get("http://localhost:5000/api/dashboard/reports/image-set-allocation", {
          headers: getAuthHeader(),
          params,
        });
        setImageSetAllocation(res.data);
      } catch (err) {
        console.error("Image set allocation fetch error:", err);
        setError(err.response?.data?.error || "Failed to load image set allocation report");
      } finally {
        setImageSetLoading(false);
      }
    };

    fetchImageSetAllocation();
  }, [imageSetStartDate, imageSetEndDate]);

  useEffect(() => {
    const fetchPaymentReport = async () => {
      try {
        setPaymentLoading(true);
        const params = {
          startDate: paymentStartDate || undefined,
          endDate: paymentEndDate || undefined,
          status: paymentStatusFilter !== 'all' ? paymentStatusFilter : undefined,
        };
        const res = await axios.get("http://localhost:5000/api/dashboard/reports/payment-report", {
          headers: getAuthHeader(),
          params,
        });
        setPaymentReport(res.data);
      } catch (err) {
        console.error("Payment report fetch error:", err);
        setError(err.response?.data?.error || "Failed to load payment report");
      } finally {
        setPaymentLoading(false);
      }
    };

    fetchPaymentReport();
  }, [paymentStartDate, paymentEndDate, paymentStatusFilter]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (roleFilter !== "all") params.append("role", roleFilter);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (period) params.append("period", period);
    window.open(`http://localhost:5000/api/dashboard/performance/users/export?${params.toString()}`, "_blank");
  };

  if (loading) return <div className="dashboard-loading">Loading...</div>;

  const userChartData = reports?.userContributions?.map((item) => ({
    name: item.name?.split(" ")[0] || item.email,
    completed: Number(item.completed_count || 0),
    total: Number(item.images_count || 0),
  })) || [];

  const progressData = reports?.progressOverTime?.map((item) => ({
    date: item.date?.split("-")[2] || "N/A",
    pending: Number(item.pending || 0),
    inProgress: Number(item.in_progress || 0),
    completed: Number(item.completed || 0),
    approved: Number(item.approved || 0),
    rejected: Number(item.rejected || 0),
  })) || [];

  const summary = annotationSummary?.summary || {};
  const summaryPie = annotationSummary?.pie || [];
  const summaryPerf = annotationSummary?.performance || [];
  const summaryColors = ["#6BCB77", "#FFA07A", "#FF6B6B", "#4D96FF"];
  const formatHours = (minutes) => {
    if (!minutes) return "-";
    return `${(minutes / 60).toFixed(2)} h`;
  };
  const testerSummary = testerReview?.summary || {};
  const testerRows = testerReview?.testers || [];

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <div className="dashboard-header">
          <h1>Reports & Analytics</h1>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="chart-container" style={{ marginTop: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3>Annotation Summary Report</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Filters: Date range + role</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select value={annRoleFilter} onChange={(e) => setAnnRoleFilter(e.target.value)} className="assign-select" style={{ minWidth: "140px" }}>
                <option value="all">All Roles</option>
                <option value="annotator">Annotators</option>
                <option value="tester">Testers</option>
              </select>
              <input type="date" value={annStartDate} onChange={(e) => setAnnStartDate(e.target.value)} className="text-input" style={{ padding: "8px" }} />
              <input type="date" value={annEndDate} onChange={(e) => setAnnEndDate(e.target.value)} className="text-input" style={{ padding: "8px" }} />
            </div>
          </div>

          {summaryLoading ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>Loading summary...</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginTop: "12px" }}>
                <div className="kpi-card"><div className="kpi-value">{summary.totalImageSets || 0}</div><div className="kpi-label">Total Image Sets</div></div>
                <div className="kpi-card"><div className="kpi-value">{summary.totalAssigned || 0}</div><div className="kpi-label">Total Assigned</div></div>
                <div className="kpi-card"><div className="kpi-value">{summary.completedAnnotations || 0}</div><div className="kpi-label">Completed Annotations</div></div>
                <div className="kpi-card"><div className="kpi-value">{summary.pendingAnnotations || 0}</div><div className="kpi-label">Pending Annotations</div></div>
                <div className="kpi-card"><div className="kpi-value">{summary.rejectedAnnotations || 0}</div><div className="kpi-label">Rejected Annotations</div></div>
                <div className="kpi-card"><div className="kpi-value">{(summary.approvalRate || 0).toFixed(1)}%</div><div className="kpi-label">Approval Rate</div></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "16px" }}>
                <div className="chart-container" style={{ margin: 0 }}>
                  <h4>Completed vs Pending</h4>
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
                          <Cell key={`cell-${index}`} fill={summaryColors[index % summaryColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-container" style={{ margin: 0 }}>
                  <h4>Annotator Performance</h4>
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
                </div>
              </div>
            </>
          )}
        </div>

        <div className="chart-container" style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3>Annotator Performance Report</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Based on tester approvals and task completion</p>
            </div>
          </div>

          {annotatorPerfLoading ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>Loading performance...</div>
          ) : (
            <div className="table-container" style={{ marginTop: "12px" }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Total Assigned</th>
                    <th>Completed</th>
                    <th>Pending</th>
                    <th>Approved</th>
                    <th>Rejected</th>
                    <th>Accuracy Rate</th>
                    <th>Avg Completion Time</th>
                  </tr>
                </thead>
                <tbody>
                  {annotatorPerf.length === 0 ? (
                    <tr><td colSpan="8" className="no-data">No data for selected range</td></tr>
                  ) : (
                    annotatorPerf.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.totalAssigned}</td>
                        <td>{row.completed}</td>
                        <td>{row.pending}</td>
                        <td>{row.approved}</td>
                        <td>{row.rejected}</td>
                        <td>{row.accuracyRate.toFixed(1)}%</td>
                        <td>{formatHours(row.avgCompletionMinutes)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="chart-container" style={{ marginTop: "16px" }}>
          <div>
            <h3>Tester Review Report</h3>
            <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Approved vs rejected outcomes and review time</p>
          </div>

          {testerReviewLoading ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>Loading tester review...</div>
          ) : (
            <div className="table-container" style={{ marginTop: "12px" }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Tester Name</th>
                    <th>Assigned Images</th>
                    <th>Approved Images</th>
                    <th>Rejected Images</th>
                    <th>Accuracy Rate</th>
                    <th>Avg Review Time</th>
                  </tr>
                </thead>
                <tbody>
                  {testerRows.length === 0 ? (
                    <tr><td colSpan="6" className="no-data">No tester data for selected range</td></tr>
                  ) : (
                    testerRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.assignedCount}</td>
                        <td>{row.approvedCount}</td>
                        <td>{row.rejectedCount}</td>
                        <td>{row.accuracyRate.toFixed(1)}%</td>
                        <td>{formatHours(row.avgReviewMinutes)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="chart-container" style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3>Image Set Allocation Report</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Track image set assignments and completion status</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input type="date" value={imageSetStartDate} onChange={(e) => setImageSetStartDate(e.target.value)} className="text-input" style={{ padding: "8px" }} placeholder="Start Date" />
              <input type="date" value={imageSetEndDate} onChange={(e) => setImageSetEndDate(e.target.value)} className="text-input" style={{ padding: "8px" }} placeholder="End Date" />
            </div>
          </div>

          {imageSetLoading ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>Loading image set allocation...</div>
          ) : (
            <div className="table-container" style={{ marginTop: "12px" }}>
              <div style={{ marginBottom: "12px", fontSize: "14px", color: "#666" }}>
                Total Image Sets: <strong>{imageSetAllocation.totalSets || 0}</strong>
              </div>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Image Set Name</th>
                    <th>Assigned Annotator</th>
                    <th>Assigned Tester</th>
                    <th>Status</th>
                    <th>Assigned Date</th>
                    <th>Completion Date</th>
                  </tr>
                </thead>
                <tbody>
                  {imageSetAllocation.imageSets?.length === 0 ? (
                    <tr><td colSpan="6" className="no-data">No image sets for selected range</td></tr>
                  ) : (
                    imageSetAllocation.imageSets?.map((row) => (
                      <tr key={row.id}>
                        <td>{row.imageName}</td>
                        <td>{row.annotatorName}</td>
                        <td>{row.testerName}</td>
                        <td>
                          <span style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            backgroundColor: 
                              row.status === 'approved' ? '#d4edda' :
                              row.status === 'rejected' ? '#f8d7da' :
                              row.status === 'completed' ? '#d1ecf1' :
                              row.status === 'in_progress' ? '#fff3cd' :
                              row.status === 'pending_review' ? '#e2e3e5' :
                              '#f8f9fa',
                            color: 
                              row.status === 'approved' ? '#155724' :
                              row.status === 'rejected' ? '#721c24' :
                              row.status === 'completed' ? '#0c5460' :
                              row.status === 'in_progress' ? '#856404' :
                              row.status === 'pending_review' ? '#383d41' :
                              '#6c757d'
                          }}>
                            {row.status === 'in_progress' ? 'In Progress' :
                             row.status === 'pending_review' ? 'Pending Review' :
                             row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                          </span>
                        </td>
                        <td>{row.assignedDate ? new Date(row.assignedDate).toLocaleDateString() : '-'}</td>
                        <td>{row.completionDate ? new Date(row.completionDate).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="chart-container" style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3>Payment Report</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Annotator payment tracking and approval status</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className="assign-select" style={{ minWidth: "140px" }}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
              <input type="date" value={paymentStartDate} onChange={(e) => setPaymentStartDate(e.target.value)} className="text-input" style={{ padding: "8px" }} placeholder="Start Date" />
              <input type="date" value={paymentEndDate} onChange={(e) => setPaymentEndDate(e.target.value)} className="text-input" style={{ padding: "8px" }} placeholder="End Date" />
            </div>
          </div>

          {paymentLoading ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>Loading payment report...</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginTop: "12px" }}>
                <div className="kpi-card"><div className="kpi-value">{paymentReport.summary?.totalPayments || 0}</div><div className="kpi-label">Total Payments</div></div>
                <div className="kpi-card"><div className="kpi-value">Rs. {paymentReport.summary?.totalAmount || 0}</div><div className="kpi-label">Total Amount</div></div>
                <div className="kpi-card"><div className="kpi-value">{paymentReport.summary?.pendingCount || 0}</div><div className="kpi-label">Pending</div></div>
                <div className="kpi-card"><div className="kpi-value">{paymentReport.summary?.approvedCount || 0}</div><div className="kpi-label">Approved</div></div>
                <div className="kpi-card"><div className="kpi-value">{paymentReport.summary?.paidCount || 0}</div><div className="kpi-label">Paid</div></div>
                <div className="kpi-card"><div className="kpi-value">{paymentReport.summary?.rejectedCount || 0}</div><div className="kpi-label">Rejected</div></div>
              </div>

              <div className="table-container" style={{ marginTop: "12px" }}>
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Annotator Name</th>
                      <th>Completed Tasks</th>
                      <th>Payment Amount</th>
                      <th>Payment Status</th>
                      <th>Approved By</th>
                      <th>Payment Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentReport.payments?.length === 0 ? (
                      <tr><td colSpan="6" className="no-data">No payment data for selected range</td></tr>
                    ) : (
                      paymentReport.payments?.map((payment) => (
                        <tr key={payment.id}>
                          <td>{payment.annotatorName}</td>
                          <td>{payment.completedTasks}</td>
                          <td>Rs. {payment.amount}</td>
                          <td>
                            <span style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              backgroundColor: 
                                payment.status === 'paid' ? '#d4edda' :
                                payment.status === 'approved' ? '#d1ecf1' :
                                payment.status === 'rejected' ? '#f8d7da' :
                                '#fff3cd',
                              color: 
                                payment.status === 'paid' ? '#155724' :
                                payment.status === 'approved' ? '#0c5460' :
                                payment.status === 'rejected' ? '#721c24' :
                                '#856404'
                            }}>
                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </span>
                          </td>
                          <td>{payment.approvedBy}</td>
                          <td>{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="charts-section">
          {/* Progress Over Time */}
          <div className="chart-container">
            <h3>Progress Over Time</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={progressData}>
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
          </div>

          {/* User Contributions */}
          <div className="chart-container">
            <h3>User Contributions</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={userChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#6BCB77" name="Completed" />
                <Bar dataKey="total" fill="#4D96FF" name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-container" style={{ marginTop: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3>Performance & Logins</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Annotator/Tester throughput with date/month filters and CSV export</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="assign-select" style={{ minWidth: "140px" }}>
                <option value="all">All Roles</option>
                <option value="annotator">Annotators</option>
                <option value="tester">Testers</option>
              </select>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="assign-select" style={{ minWidth: "120px" }}>
                <option value="month">This Month</option>
                <option value="custom">Custom</option>
              </select>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-input" style={{ padding: "8px" }} />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-input" style={{ padding: "8px" }} />
              <button className="btn-primary" onClick={handleExport} style={{ whiteSpace: "nowrap" }}>Export CSV</button>
            </div>
          </div>

          {perfLoading ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>Loading performance...</div>
          ) : (
            <div className="table-container" style={{ marginTop: "12px" }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Completed</th>
                    <th>Approved</th>
                    <th>Rejected</th>
                    <th>Active</th>
                    <th>Last Activity</th>
                    <th>Last Login</th>
                    <th>Logins</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.users.length === 0 ? (
                    <tr><td colSpan="9" className="no-data">No data for selected range</td></tr>
                  ) : (
                    performance.users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name || u.email}</td>
                        <td>{u.role}</td>
                        <td>{u.tasks_completed || 0}</td>
                        <td>{u.tasks_approved || 0}</td>
                        <td>{u.tasks_rejected || 0}</td>
                        <td>{u.tasks_active || 0}</td>
                        <td>{u.last_task_activity ? new Date(u.last_task_activity).toLocaleString() : "-"}</td>
                        <td>{u.last_login ? new Date(u.last_login).toLocaleString() : "-"}</td>
                        <td>{u.login_count || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {systemPerf && (
          <div className="chart-container" style={{ marginTop: "16px" }}>
            <h3>System Snapshot (last 24h)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.tasksLast24h?.reduce((s, t) => s + (t.count || 0), 0) || 0}</div><div className="kpi-label">Tasks Updated</div></div>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.loginsLast24h?.reduce((s, t) => s + (t.count || 0), 0) || 0}</div><div className="kpi-label">Logins</div></div>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.statusDistribution?.find(s => s.status === 'approved')?.count || 0}</div><div className="kpi-label">Approved Images</div></div>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.imagesLast7d?.reduce((s, t) => s + (t.total || 0), 0) || 0}</div><div className="kpi-label">Uploads (7d)</div></div>
            </div>
            <p style={{ marginTop: "8px", color: "#888", fontSize: "12px" }}>Snapshot at {new Date(systemPerf.timestamp || Date.now()).toLocaleString()}</p>
          </div>
        )}

        <div className="chart-container" style={{ marginTop: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3>Annotated Images and Hours by Date</h3>
              <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>Annotations completed, verified, and hours logged by date</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <select value={annRoleFilter} onChange={(e) => setAnnRoleFilter(e.target.value)} className="assign-select" style={{ minWidth: "140px" }}>
                <option value="all">All Roles</option>
                <option value="annotator">Annotators</option>
                <option value="tester">Testers</option>
              </select>
              <input type="date" value={annStartDate} onChange={(e) => setAnnStartDate(e.target.value)} className="text-input" style={{ padding: "8px" }} />
              <input type="date" value={annEndDate} onChange={(e) => setAnnEndDate(e.target.value)} className="text-input" style={{ padding: "8px" }} />
            </div>
          </div>

          {annLoading ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>Loading annotation data...</div>
          ) : annotationData.length === 0 ? (
            <div className="dashboard-loading" style={{ padding: "16px" }}>No data for selected range</div>
          ) : (
            <>
              {/* KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "16px" }}>
                <div className="kpi-card" style={{ backgroundColor: "#FFE8E8", borderLeft: "4px solid #FF6B6B" }}>
                  <div className="kpi-value">{annotationData.reduce((sum, row) => sum + Number(row.annotated_images || 0), 0)}</div>
                  <div className="kpi-label">Total Annotated Images</div>
                </div>
                <div className="kpi-card" style={{ backgroundColor: "#FFF0E8", borderLeft: "4px solid #FFA07A" }}>
                  <div className="kpi-value">{annotationData.reduce((sum, row) => sum + Number(row.annotation_hrs || 0), 0).toFixed(2)}</div>
                  <div className="kpi-label">Total Annotation Hrs</div>
                </div>
                <div className="kpi-card" style={{ backgroundColor: "#E8F5FF", borderLeft: "4px solid #4D96FF" }}>
                  <div className="kpi-value">{annotationData.length > 0 ? (annotationData.reduce((sum, row) => sum + Number(row.annotation_hrs || 0), 0) / annotationData.length).toFixed(2) : 0}</div>
                  <div className="kpi-label">Avg Annotation Hrs/day</div>
                </div>
                <div className="kpi-card" style={{ backgroundColor: "#E8F5F0", borderLeft: "4px solid #10b981" }}>
                  <div className="kpi-value">{annotationData.reduce((sum, row) => sum + Number(row.verified_images || 0), 0)}</div>
                  <div className="kpi-label">Total Verified Images</div>
                </div>
                <div className="kpi-card" style={{ backgroundColor: "#F0E8FF", borderLeft: "4px solid #8b5cf6" }}>
                  <div className="kpi-value">{annotationData.reduce((sum, row) => sum + Number(row.verification_hrs || 0), 0).toFixed(2)}</div>
                  <div className="kpi-label">Total Verification Hrs</div>
                </div>
                <div className="kpi-card" style={{ backgroundColor: "#FFFAE8", borderLeft: "4px solid #f59e0b" }}>
                  <div className="kpi-value">{annotationData.reduce((sum, row) => sum + (row.approved_annotations || 0), 0)}</div>
                  <div className="kpi-label">Total Approved</div>
                </div>
              </div>

              {/* Charts */}
              <div style={{ marginTop: "20px" }}>
                <h4>Annotated Images and Hrs by Date</h4>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={annotationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="annotated_images" stroke="#FF6B6B" strokeWidth={2} name="Annotated Images" />
                    <Line yAxisId="right" type="monotone" dataKey="annotation_hrs" stroke="#FFA07A" strokeWidth={2} name="Annotation Hrs" />
                    <Line yAxisId="left" type="monotone" dataKey="verified_images" stroke="#10b981" strokeWidth={2} name="Verified Images" />
                    <Line yAxisId="right" type="monotone" dataKey="verification_hrs" stroke="#8b5cf6" strokeWidth={2} name="Verification Hrs" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginTop: "20px" }}>
                <h4>Approval Rate by Date</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={annotationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="annotation_approval_rate" fill="#6BCB77" name="Approval Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table */}
              <div style={{ marginTop: "20px" }}>
                <h4>Detailed View</h4>
                <div className="table-container" style={{ marginTop: "12px", overflowX: "auto" }}>
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Annotated Images</th>
                        <th>Annotation Hrs</th>
                        <th>Avg Hrs/Image</th>
                        <th>Verified Images</th>
                        <th>Verification Hrs</th>
                        <th>Avg Verification Hrs</th>
                        <th>Approved</th>
                        <th>Approval Rate %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annotationData.map((row, idx) => (
                        <tr key={idx}>
                          <td><strong>{row.date}</strong></td>
                          <td>{row.annotated_images || 0}</td>
                          <td>{row.annotation_hrs || 0}</td>
                          <td>{row.avg_annotation_hrs_per_image || 0}</td>
                          <td>{row.verified_images || 0}</td>
                          <td>{row.verification_hrs || 0}</td>
                          <td>{row.avg_verification_hrs_per_image || 0}</td>
                          <td>{row.approved_annotations || 0}</td>
                          <td><strong>{row.annotation_approval_rate || 0}%</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {systemPerf && (
          <div className="chart-container" style={{ marginTop: "16px" }}>
            <h3>System Snapshot (last 24h)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.tasksLast24h?.reduce((s, t) => s + (t.count || 0), 0) || 0}</div><div className="kpi-label">Tasks Updated</div></div>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.loginsLast24h?.reduce((s, t) => s + (t.count || 0), 0) || 0}</div><div className="kpi-label">Logins</div></div>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.statusDistribution?.find(s => s.status === 'approved')?.count || 0}</div><div className="kpi-label">Approved Images</div></div>
              <div className="kpi-card"><div className="kpi-value">{systemPerf.imagesLast7d?.reduce((s, t) => s + (t.total || 0), 0) || 0}</div><div className="kpi-label">Uploads (7d)</div></div>
            </div>
            <p style={{ marginTop: "8px", color: "#888", fontSize: "12px" }}>Snapshot at {new Date(systemPerf.timestamp || Date.now()).toLocaleString()}</p>
          </div>
        )}

        {/* Detailed Reports */}
        <div className="reports-section">
          <h3>Detailed Reports</h3>
          <div className="table-container">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Image ID</th>
                  <th>Image Name</th>
                  <th>Assigned To</th>
                  <th>Annotator</th>
                  <th>Tester</th>
                  <th>Status</th>
                  <th>Objects</th>
                  <th>Created Date</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {reports?.detailedReports?.map((report) => (
                  <tr key={report.id}>
                    <td>#{report.id}</td>
                    <td>{report.image_name}</td>
                    <td>{report.assigned_to || "-"}</td>
                    <td>{report.annotator || "-"}</td>
                    <td>{report.tester || "-"}</td>
                    <td>
                      <span className={`status-badge status-${report.status}`}>
                        {report.status}
                      </span>
                    </td>
                    <td>{report.objects_count || 0}</td>
                    <td>{report.created_at?.split("T")[0]}</td>
                    <td>{report.updated_at?.split("T")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
