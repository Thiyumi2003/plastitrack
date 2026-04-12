import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const escapeHtml = (value) => {
  const str = String(value ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatFilterSummary = (filters = {}) => {
  const items = Object.entries(filters)
    .filter(([_, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => {
      const readableKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (char) => char.toUpperCase());
      return `${readableKey}: ${value}`;
    });
  return items.length > 0 ? items.join(" | ") : "All data";
};

const defaultChartColors = ["#4D96FF", "#6BCB77", "#FFA07A", "#FF6B6B", "#9C27B0", "#00B8D9"];

const formatChartValue = (value) => {
  if (value === null || value === undefined || value === "") return "0";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
};

const buildPieChartHtml = (chart) => {
  const data = Array.isArray(chart.data) ? chart.data : [];
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const colors = chart.colors?.length ? chart.colors : defaultChartColors;

  if (!data.length || total <= 0) {
    return `<div class="pdf-chart-empty">No chart data available</div>`;
  }

  const radius = 72;
  const center = 100;
  const pieSlicePath = (startAngle, endAngle) => {
    const start = {
      x: center + radius * Math.cos((Math.PI * startAngle) / 180),
      y: center + radius * Math.sin((Math.PI * startAngle) / 180),
    };
    const end = {
      x: center + radius * Math.cos((Math.PI * endAngle) / 180),
      y: center + radius * Math.sin((Math.PI * endAngle) / 180),
    };
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return [
      `M ${center} ${center}`,
      `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
      "Z",
    ].join(" ");
  };

  const slices = [];
  let currentAngle = -90;
  data.forEach((item, index) => {
    const value = Number(item.value || 0);
    const angle = (value / total) * 360;
    const nextAngle = currentAngle + angle;
    slices.push({
      path: pieSlicePath(currentAngle, nextAngle),
      color: colors[index % colors.length],
    });
    currentAngle = nextAngle;
  });

  const legendHtml = data
    .map((item, index) => {
      const color = colors[index % colors.length];
      const value = Number(item.value || 0);
      const percent = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
      return `
        <div class="pdf-chart-legend-item">
          <span class="pdf-chart-legend-swatch" style="background:${color}"></span>
          <span class="pdf-chart-legend-label">${escapeHtml(item.name || `Item ${index + 1}`)}</span>
          <span class="pdf-chart-legend-value">${escapeHtml(formatChartValue(value))} (${percent}%)</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="pdf-chart-pie-wrap">
      <svg class="pdf-chart-pie-svg" viewBox="0 0 200 200" role="img" aria-label="Pie chart">
        <circle cx="100" cy="100" r="76" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
        ${slices
          .map(
            (slice) => `
              <path d="${slice.path}" fill="${slice.color}" stroke="#ffffff" stroke-width="2" />
            `
          )
          .join("")}
        <circle cx="100" cy="100" r="40" fill="#ffffff" opacity="0.92" />
        <text x="100" y="96" text-anchor="middle" class="pdf-chart-pie-center-label">Total</text>
        <text x="100" y="112" text-anchor="middle" class="pdf-chart-pie-center-value">${escapeHtml(formatChartValue(total))}</text>
      </svg>
      <div class="pdf-chart-legend">${legendHtml}</div>
    </div>
  `;
};

const buildBarChartHtml = (chart) => {
  const data = Array.isArray(chart.data) ? chart.data : [];
  const series = Array.isArray(chart.series) ? chart.series : [];
  const labelKey = chart.labelKey || "name";
  const colors = chart.colors?.length ? chart.colors : defaultChartColors;

  if (!data.length || !series.length) {
    return `<div class="pdf-chart-empty">No chart data available</div>`;
  }

  const maxValue = Math.max(
    ...data.flatMap((item) => series.map((entry) => Number(item?.[entry.key] || 0))),
    0
  );

  const rowsHtml = data
    .map((item) => {
      const label = item?.[labelKey] ?? "-";
      const bars = series
        .map((entry, seriesIndex) => {
          const value = Number(item?.[entry.key] || 0);
          const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const color = entry.color || colors[seriesIndex % colors.length];
          return `
            <div class="pdf-chart-bar-series">
              <span class="pdf-chart-bar-series-label">${escapeHtml(entry.label || entry.key)}</span>
              <div class="pdf-chart-bar-track">
                <div class="pdf-chart-bar-fill" style="width:${width.toFixed(2)}%; background:${color};"></div>
              </div>
              <span class="pdf-chart-bar-series-value">${escapeHtml(formatChartValue(value))}</span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="pdf-chart-bar-row">
          <div class="pdf-chart-bar-label">${escapeHtml(label)}</div>
          <div class="pdf-chart-bar-group">${bars}</div>
        </div>
      `;
    })
    .join("");

  const legendHtml = series
    .map((entry, index) => {
      const color = entry.color || colors[index % colors.length];
      return `
        <div class="pdf-chart-legend-item">
          <span class="pdf-chart-legend-swatch" style="background:${color}"></span>
          <span class="pdf-chart-legend-label">${escapeHtml(entry.label || entry.key)}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="pdf-chart-bar-wrap">
      <div class="pdf-chart-legend pdf-chart-legend-inline">${legendHtml}</div>
      <div class="pdf-chart-bar-list">${rowsHtml}</div>
    </div>
  `;
};

const buildChartSectionHtml = (chart) => {
  if (!chart) return "";

  const title = chart.title || "Chart";
  const subtitle = chart.subtitle ? `<div class="pdf-chart-subtitle">${escapeHtml(chart.subtitle)}</div>` : "";
  const chartBody = chart.type === "bar" ? buildBarChartHtml(chart) : buildPieChartHtml(chart);

  return `
    <div class="pdf-chart-block">
      <div class="pdf-chart-title">${escapeHtml(title)}</div>
      ${subtitle}
      ${chartBody}
    </div>
  `;
};

const buildTemplateStyles = () => `
  .pdf-root {
    background: #ffffff;
    color: #111827;
    width: 1400px;
    padding: 18px;
    font-family: 'Segoe UI', Arial, sans-serif;
    box-sizing: border-box;
  }
  .pdf-section {
    background: #ffffff;
    color: #111827;
    margin-bottom: 22px;
    border: 1px solid #d1d5db;
    padding: 14px;
    page-break-before: always;
    page-break-inside: auto;
  }
  .pdf-section:first-child {
    page-break-before: auto;
  }
  .pdf-header h1 {
    margin: 0;
    font-size: 24px;
    color: #0f172a;
  }
  .pdf-meta {
    margin-top: 6px;
    font-size: 12px;
    color: #334155;
  }
  .pdf-kpis {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .pdf-kpi {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px;
    background: #f8fafc;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .pdf-kpi-label {
    font-size: 11px;
    color: #475569;
  }
  .pdf-kpi-value {
    margin-top: 4px;
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
  }
  .pdf-table-block {
    margin-top: 12px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .pdf-chart-block {
    margin-top: 12px;
    break-inside: avoid;
    page-break-inside: avoid;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px;
    background: #f8fafc;
  }
  .pdf-chart-title {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 6px;
  }
  .pdf-chart-subtitle {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 8px;
  }
  .pdf-chart-empty {
    font-size: 11px;
    color: #64748b;
    padding: 18px 6px;
    text-align: center;
    border: 1px dashed #cbd5e1;
    border-radius: 6px;
    background: #ffffff;
  }
  .pdf-chart-pie-wrap {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 14px;
    align-items: center;
  }
  .pdf-chart-pie {
    display: none;
  }
  .pdf-chart-pie-svg {
    width: 190px;
    height: 190px;
    margin: 0 auto;
    display: block;
  }
  .pdf-chart-pie-center-label {
    font-size: 11px;
    fill: #64748b;
    font-weight: 600;
  }
  .pdf-chart-pie-center-value {
    font-size: 16px;
    fill: #0f172a;
    font-weight: 700;
  }
  .pdf-chart-legend {
    display: grid;
    gap: 6px;
  }
  .pdf-chart-legend-inline {
    margin-bottom: 8px;
  }
  .pdf-chart-legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #0f172a;
    flex-wrap: wrap;
  }
  .pdf-chart-legend-swatch {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    display: inline-block;
  }
  .pdf-chart-legend-label {
    font-weight: 600;
  }
  .pdf-chart-legend-value {
    color: #475569;
  }
  .pdf-chart-bar-wrap {
    display: grid;
    gap: 10px;
  }
  .pdf-chart-bar-list {
    display: grid;
    gap: 8px;
  }
  .pdf-chart-bar-row {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 10px;
    align-items: start;
  }
  .pdf-chart-bar-label {
    font-size: 11px;
    font-weight: 600;
    color: #0f172a;
    word-break: break-word;
  }
  .pdf-chart-bar-group {
    display: grid;
    gap: 6px;
  }
  .pdf-chart-bar-series {
    display: grid;
    grid-template-columns: 90px 1fr 40px;
    gap: 8px;
    align-items: center;
  }
  .pdf-chart-bar-series-label,
  .pdf-chart-bar-series-value {
    font-size: 10px;
    color: #475569;
  }
  .pdf-chart-bar-track {
    height: 10px;
    background: #e2e8f0;
    border-radius: 999px;
    overflow: hidden;
  }
  .pdf-chart-bar-fill {
    height: 100%;
    border-radius: 999px;
  }
  .pdf-table-title {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 6px;
  }
  .pdf-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
    word-wrap: break-word;
    overflow-wrap: break-word;
    font-size: 10px;
  }
  .pdf-table thead {
    background: #e2e8f0;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .pdf-table tbody tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .pdf-table th,
  .pdf-table td {
    border: 1px solid #cbd5e1;
    padding: 5px;
    vertical-align: top;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .pdf-table th {
    background: #e2e8f0;
    color: #0f172a;
    font-weight: 700;
  }
  .pdf-note {
    margin-top: 8px;
    font-size: 10px;
    color: #64748b;
  }
  @media print {
    body * {
      visibility: hidden;
    }
    .pdf-root,
    .pdf-root * {
      visibility: visible;
    }
    .pdf-root {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      padding: 0;
      background: #ffffff;
      color: #111827;
    }
    .pdf-section {
      page-break-before: always;
      page-break-inside: auto;
      break-inside: auto;
      box-shadow: none !important;
      background: #ffffff !important;
    }
    .pdf-section:first-child {
      page-break-before: avoid;
    }
    .pdf-table {
      page-break-inside: auto;
      break-inside: auto;
    }
    .pdf-table tbody tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .pdf-table thead {
      page-break-after: avoid;
      break-after: avoid;
    }
    .pdf-table,
    .pdf-table th,
    .pdf-table td {
      color: #111827 !important;
      background: #ffffff !important;
    }
  }
`;

const buildReportSectionHtml = (report) => {
  const generatedAt = new Date().toLocaleString();
  const filterSummary = formatFilterSummary(report.filters || {});
  const kpis = Array.isArray(report.kpis) ? report.kpis : [];
  const tables = Array.isArray(report.tables) ? report.tables : [];
  const charts = Array.isArray(report.charts) ? report.charts : [];

  const kpiHtml = kpis
    .map(
      (kpi) => `
        <div class="pdf-kpi">
          <div class="pdf-kpi-label">${escapeHtml(kpi.label)}</div>
          <div class="pdf-kpi-value">${escapeHtml(kpi.value)}</div>
        </div>
      `
    )
    .join("");

  const tableHtml = tables
    .map((table) => {
      const columns = table.columns || [];
      const rows = table.rows || [];
      const head = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("");
      const body = rows
        .map((row) => {
          const tds = columns
            .map((col) => `<td>${escapeHtml(row?.[col] ?? "-")}</td>`)
            .join("");
          return `<tr>${tds}</tr>`;
        })
        .join("");

      return `
        <div class="pdf-table-block">
          ${table.title ? `<div class="pdf-table-title">${escapeHtml(table.title)}</div>` : ""}
          <table class="pdf-table">
            <thead><tr>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      `;
    })
    .join("");

  const chartHtml = charts.map((chart) => buildChartSectionHtml(chart)).join("");

  return `
    <section class="pdf-section">
      <div class="pdf-header">
        <h1>${escapeHtml(report.title || "Report")}</h1>
        <div class="pdf-meta">Generated: ${escapeHtml(generatedAt)}</div>
        <div class="pdf-meta">Filters: ${escapeHtml(filterSummary)}</div>
      </div>
      ${kpiHtml ? `<div class="pdf-kpis">${kpiHtml}</div>` : ""}
      ${chartHtml}
      ${tableHtml}
      ${report.note ? `<div class="pdf-note">${escapeHtml(report.note)}</div>` : ""}
    </section>
  `;
};

const createExportRoot = (reports) => {
  const root = document.createElement("div");
  root.className = "pdf-root";
  root.style.position = "fixed";
  root.style.left = "-20000px";
  root.style.top = "0";
  root.style.zIndex = "-1";

  const styleTag = document.createElement("style");
  styleTag.textContent = buildTemplateStyles();
  root.appendChild(styleTag);

  const sectionsHtml = reports.map((report) => buildReportSectionHtml(report)).join("");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = sectionsHtml;
  root.appendChild(wrapper);

  document.body.appendChild(root);
  return root;
};

const drawPdfHeader = (pdf, title, subtitle = "") => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(18, 34, 58);
  pdf.rect(0, 0, pageWidth, 18, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(title, 8, 11);
  if (subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(subtitle, pageWidth - 8, 11, { align: "right" });
  }
  pdf.setTextColor(33, 37, 41);
};

const drawPdfFooter = (pdf, pageNum) => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(108, 117, 125);
  pdf.text(`Page ${pageNum}`, pageWidth - 8, pageHeight - 5, { align: "right" });
};

const appendCanvasToPdf = (pdf, canvas, title, subtitle, pageNumStart = 1) => {
  const marginX = 8;
  const topOffset = 22;
  const bottomOffset = 10;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableHeight = pageHeight - topOffset - bottomOffset;
  const imgWidth = pageWidth - marginX * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let renderedHeight = 0;
  let pageNum = pageNumStart;

  while (renderedHeight < imgHeight) {
    if (renderedHeight > 0) {
      pdf.addPage();
      pageNum += 1;
    }

    drawPdfHeader(pdf, title, subtitle);

    // Calculate the portion of the image to display on this page
    const startPixelY = (renderedHeight * canvas.height) / imgHeight;
    const endPixelY = Math.min(((renderedHeight + usableHeight) * canvas.height) / imgHeight, canvas.height);
    const portionHeight = endPixelY - startPixelY;

    // Create a temporary canvas with only the portion needed for this page
    const portionCanvas = document.createElement("canvas");
    portionCanvas.width = canvas.width;
    portionCanvas.height = portionHeight;

    const ctx = portionCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(
        canvas,
        0,
        startPixelY,
        canvas.width,
        portionHeight,
        0,
        0,
        canvas.width,
        portionHeight
      );
    }

    const portionImgData = portionCanvas.toDataURL("image/png", 0.95);
    const portionImgHeight = (portionHeight * imgWidth) / canvas.width;

    pdf.addImage(portionImgData, "PNG", marginX, topOffset, imgWidth, portionImgHeight);
    drawPdfFooter(pdf, pageNum);

    renderedHeight += usableHeight;
  }

  return pageNum;
};

const getReportTitleFromElement = (element) => {
  const heading = element?.querySelector("h1, h2, h3, h4");
  return heading?.textContent?.trim() || "Report";
};

/**
 * Service for exporting report data to various formats
 */

export const ExportService = {
  /**
   * Export data to Excel (XLSX format)
   */
  exportToExcel: (data, filename = "report.xlsx", sheetName = "Report") => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data);

      // Auto-adjust column widths
      const colWidths = Object.keys(data[0] || {}).map((key) => ({
        wch: Math.max(
          key.length,
          Math.max(...data.map((row) => String(row[key] || "").length))
        ),
      }));

      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      XLSX.writeFile(workbook, filename);

      return { success: true, message: "Excel export successful" };
    } catch (error) {
      console.error("Excel export error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Export multiple sheets to Excel
   */
  exportMultipleSheets: (sheets, filename = "reports.xlsx") => {
    try {
      const workbook = XLSX.utils.book_new();

      sheets.forEach(({ name, data }) => {
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Auto-adjust column widths
        const colWidths = Object.keys(data[0] || {}).map((key) => ({
          wch: Math.max(
            key.length,
            Math.max(...data.map((row) => String(row[key] || "").length))
          ),
        }));

        worksheet["!cols"] = colWidths;
        XLSX.utils.book_append_sheet(workbook, worksheet, name);
      });

      XLSX.writeFile(workbook, filename);

      return { success: true, message: "Multi-sheet export successful" };
    } catch (error) {
      console.error("Multi-sheet export error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Export HTML element/table to PDF
   */
  exportToPDF: async (elementId, filename = "report.pdf", options = {}) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`Element with ID "${elementId}" not found`);
      }

      const {
        orientation = "landscape",
        format = "a4",
        scale = 2,
        quality = 0.95,
        title,
      } = options;

      // Let chart layout settle before cloning/snapshotting.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const targetWidth = Math.max(element.scrollWidth, element.clientWidth);
      const targetHeight = Math.max(element.scrollHeight, element.clientHeight);

      const responsiveChartSizes = Array.from(
        element.querySelectorAll(".recharts-responsive-container")
      ).map((node) => ({
        width: Math.max(node.clientWidth, 320),
        height: Math.max(node.clientHeight, 220),
      }));

      // Capture HTML as canvas
      const canvas = await html2canvas(element, {
        scale,
        logging: false,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.scrollTop = 0;
          if (clonedDoc.body) clonedDoc.body.scrollTop = 0;
          const clonedElement = clonedDoc.getElementById(elementId);
          if (!clonedElement) return;

          clonedElement.style.overflow = "visible";
          clonedElement.style.maxHeight = "none";

          const tableContainers = clonedElement.querySelectorAll(".table-container");
          tableContainers.forEach((container) => {
            container.style.overflow = "visible";
            container.style.maxHeight = "none";
            container.style.height = "auto";
          });

          const clonedResponsiveCharts = clonedElement.querySelectorAll(
            ".recharts-responsive-container"
          );
          clonedResponsiveCharts.forEach((container, index) => {
            const size = responsiveChartSizes[index] || { width: 600, height: 280 };
            container.style.width = `${size.width}px`;
            container.style.height = `${size.height}px`;
            container.style.minWidth = `${size.width}px`;
            container.style.minHeight = `${size.height}px`;
            container.style.overflow = "visible";
          });

          const wrappers = clonedElement.querySelectorAll(".recharts-wrapper");
          wrappers.forEach((wrapper) => {
            wrapper.style.overflow = "visible";
          });

          const surfaces = clonedElement.querySelectorAll(".recharts-surface");
          surfaces.forEach((surface) => {
            surface.style.overflow = "visible";
          });
        },
      });

      // Create PDF
      const pdf = new jsPDF(orientation, "mm", format);
      const prettyTitle = title || getReportTitleFromElement(element);
      const subtitle = new Date().toLocaleString();
      appendCanvasToPdf(pdf, canvas, prettyTitle, subtitle, 1);

      pdf.save(filename);

      return { success: true, message: "PDF export successful" };
    } catch (error) {
      console.error("PDF export error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Export using a print-friendly report template (not live dashboard UI).
   */
  exportReportTemplateToPDF: async (report, filename = "report.pdf", options = {}) => {
    return ExportService.exportAllReportTemplatesToPDF([report], filename, {
      ...options,
      documentTitle: report?.title || "Report",
    });
  },

  /**
   * Export multiple report templates to one PDF file.
   */
  exportAllReportTemplatesToPDF: async (reports, filename = "all-reports.pdf", options = {}) => {
    const {
      orientation = "landscape",
      format = "a4",
      scale = 1.7,
      documentTitle = "All Reports",
    } = options;

    const root = createExportRoot(reports);
    try {
      const sections = Array.from(root.querySelectorAll(".pdf-section"));
      const canvases = [];

      for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        
        // Allow rendering to settle
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        
        // Ensure section doesn't have hidden overflow that might duplicate content
        const originalOverflow = section.style.overflow;
        section.style.overflow = "visible";
        
        const canvas = await html2canvas(section, {
          scale,
          logging: false,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: section.scrollWidth,
          height: section.scrollHeight,
          windowWidth: section.scrollWidth,
          windowHeight: section.scrollHeight,
          scrollX: 0,
          scrollY: 0,
          allowTaint: false,
        });
        
        // Restore original overflow
        section.style.overflow = originalOverflow;
        
        canvases.push({
          title: reports[i]?.title || `Report ${i + 1}`,
          canvas,
        });
      }

      return ExportService.exportCanvasSectionsToPDF(
        canvases,
        filename,
        documentTitle,
        { orientation, format }
      );
    } catch (error) {
      console.error("Template PDF export error:", error);
      return { success: false, error: error.message };
    } finally {
      if (root && root.parentNode) {
        root.parentNode.removeChild(root);
      }
    }
  },

  /**
   * Export to CSV
   */
  exportToCSV: (data, filename = "report.csv") => {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No data to export");
      }

      // Get headers from first object
      const headers = Object.keys(data[0]);

      // Build CSV content
      const csvContent = [
        headers.join(","),
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header];
              // Escape quotes and wrap in quotes if contains comma
              if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(",")
        ),
      ].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();

      return { success: true, message: "CSV export successful" };
    } catch (error) {
      console.error("CSV export error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Export to JSON
   */
  exportToJSON: (data, filename = "report.json") => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();

      return { success: true, message: "JSON export successful" };
    } catch (error) {
      console.error("JSON export error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Generate PDF from chart images
   */
  generateChartPDF: async (charts, filename = "charts.pdf", title = "Report Charts") => {
    try {
      const pdf = new jsPDF("portrait", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let yPosition = margin;

      // Add title
      pdf.setFontSize(16);
      pdf.text(title, margin, yPosition);
      yPosition += 15;

      for (const { caption, elementId } of charts) {
        const element = document.getElementById(elementId);
        if (!element) continue;

        const canvas = await html2canvas(element, {
          scale: 2,
          logging: false,
          useCORS: true,
        });

        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Check if image fits on current page
        if (yPosition + imgHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }

        // Add caption
        if (caption) {
          pdf.setFontSize(10);
          pdf.text(caption, margin, yPosition);
          yPosition += 7;
        }

        // Add image
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
      }

      pdf.save(filename);

      return { success: true, message: "Chart PDF export successful" };
    } catch (error) {
      console.error("Chart PDF export error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Capture a report element to canvas for custom multi-report exports.
   */
  captureElementCanvas: async (elementId, options = {}) => {
    const element = document.getElementById(elementId);
    if (!element) return null;

    const { scale = 1.6 } = options;
    const targetWidth = Math.max(element.scrollWidth, element.clientWidth);
    const targetHeight = Math.max(element.scrollHeight, element.clientHeight);

    return html2canvas(element, {
      scale,
      logging: false,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: targetWidth,
      height: targetHeight,
      windowWidth: targetWidth,
      windowHeight: targetHeight,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        clonedDoc.documentElement.scrollTop = 0;
        if (clonedDoc.body) clonedDoc.body.scrollTop = 0;
        const clonedElement = clonedDoc.getElementById(elementId);
        if (!clonedElement) return;

        clonedElement.scrollTop = 0;
        clonedElement.style.overflow = "visible";
        clonedElement.style.maxHeight = "none";

        const tableContainers = clonedElement.querySelectorAll(".table-container");
        tableContainers.forEach((container) => {
          container.style.overflow = "visible";
          container.style.maxHeight = "none";
          container.style.height = "auto";
          container.style.width = "max-content";
          container.style.minWidth = "100%";
        });

        const tables = clonedElement.querySelectorAll("table");
        tables.forEach((table) => {
          table.style.width = "max-content";
          table.style.minWidth = "100%";
        });
      },
    });
  },

  /**
   * Export many pre-captured report canvases into one PDF file.
   */
  exportCanvasSectionsToPDF: async (
    sections,
    filename = "all-reports.pdf",
    documentTitle = "All Reports",
    options = {}
  ) => {
    try {
      if (!Array.isArray(sections) || sections.length === 0) {
        throw new Error("No report sections available for export");
      }

      const { orientation = "landscape", format = "a4" } = options;
      const pdf = new jsPDF(orientation, "mm", format);
      const generatedAt = new Date().toLocaleString();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Cover page
      pdf.setFillColor(18, 34, 58);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(24);
      pdf.text(documentTitle, pageWidth / 2, 120, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text(`Generated: ${generatedAt}`, pageWidth / 2, 130, { align: "center" });

      let pageNum = 1;
      drawPdfFooter(pdf, pageNum);

      for (const section of sections) {
        pdf.addPage();
        pageNum += 1;
        pageNum = appendCanvasToPdf(
          pdf,
          section.canvas,
          section.title || "Report",
          generatedAt,
          pageNum
        );
      }

      pdf.save(filename);
      return { success: true, message: "Combined PDF export successful" };
    } catch (error) {
      console.error("Combined PDF export error:", error);
      return { success: false, error: error.message };
    }
  },
};

export default ExportService;
