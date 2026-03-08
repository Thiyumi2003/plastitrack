import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
        orientation = "portrait",
        format = "a4",
        scale = 2,
        quality = 0.95,
      } = options;

      // Capture HTML as canvas
      const canvas = await html2canvas(element, {
        scale,
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png", quality);

      // Create PDF
      const pdf = new jsPDF(orientation, "mm", format);
      const imgWidth = orientation === "portrait" ? 210 : 297;
      const pageHeight = orientation === "portrait" ? 297 : 210;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      // Add image to PDF, handling multiple pages
      while (heightLeft >= 0) {
        const sourceY = Math.max(0, imgHeight - heightLeft);
        pdf.addImage(
          imgData,
          "PNG",
          0,
          position,
          imgWidth,
          imgHeight,
          undefined,
          "FAST",
          sourceY
        );
        heightLeft -= pageHeight;
        position = heightLeft > 0 ? -pageHeight : 0;

        if (heightLeft > 0) {
          pdf.addPage();
        }
      }

      pdf.save(filename);

      return { success: true, message: "PDF export successful" };
    } catch (error) {
      console.error("PDF export error:", error);
      return { success: false, error: error.message };
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
};

export default ExportService;
