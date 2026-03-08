# Quick Reference Guide - Reports & Analytics

## 📋 File Locations

```
hooks/useReportsData.js         → Custom hooks for data management
services/ExportService.js       → Export functionality (Excel/PDF/CSV/JSON)
components/reports/
  ├── FilterManager.jsx         → Filter UI components
  ├── ErrorBoundary.jsx         → Error handling wrapper
  ├── AnnotationSummaryReport.jsx     → Summary metrics
  ├── AnnotatorPerformanceReport.jsx  → Performance table
  ├── TesterReviewReport.jsx          → Tester metrics
  ├── PaymentReport.jsx               → Payment tracking
  └── README.md                 → Full documentation

pages/admin/AdminReports.jsx    → Main dashboard (refactored)
```

## 🚀 Common Tasks

### Use Report Data
```jsx
import { useReportsData } from '../../hooks/useReportsData';

const { fetchData, loading, error, clearCache } = useReportsData();

// Fetch with caching
const data = await fetchData('/api/endpoint', { param: value }, 'cacheKey');
```

### Add Filters
```jsx
import { FilterManager } from './FilterManager';
import { useFilterState } from '../../hooks/useReportsData';

const { filters, updateFilter } = useFilterState({ role: 'all', startDate: '' });

<FilterManager 
  filters={filters}
  onFilterChange={updateFilter}
  showDateFilters
  showRoleFilter
/>
```

### Implement Pagination
```jsx
import { usePaginatedData } from '../../hooks/useReportsData';
import { PaginationControls } from './FilterManager';

const { paginatedData, currentPage, totalPages, goToPage } = 
  usePaginatedData(data, 20);

<PaginationControls 
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={goToPage}
  totalItems={data.length}
/>
```

### Export Data
```jsx
import { ExportService } from '../../services/ExportService';

// Excel
ExportService.exportToExcel(data, 'report.xlsx', 'Sheet1');

// PDF from element
await ExportService.exportToPDF('element-id', 'report.pdf');

// CSV
ExportService.exportToCSV(data, 'report.csv');

// JSON
ExportService.exportToJSON(data, 'data.json');
```

### Handle Errors
```jsx
import ErrorBoundary from './ErrorBoundary';

<ErrorBoundary>
  <MyReportComponent />
</ErrorBoundary>
```

### Display KPI Cards
```jsx
import { KPICard } from './FilterManager';

<KPICard 
  label="Total Tasks"
  value={123}
  icon="📊"
  color="#4D96FF"
  loading={false}
  trend={{ positive: true, value: 15 }}
/>
```

## 🔌 API Endpoints

```
GET /api/dashboard/reports/annotation-summary?role=&startDate=&endDate=
GET /api/dashboard/reports/annotator-performance?startDate=&endDate=
GET /api/dashboard/reports/tester-review
GET /api/dashboard/reports/payment-report?startDate=&endDate=&status=
GET /api/dashboard/reports/image-set-allocation?startDate=&endDate=
GET /api/dashboard/performance/users/export?role=&startDate=&endDate=&period=
```

## 🎨 Available Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `FilterManager` | Filter controls | `filters`, `onFilterChange`, `showDateFilters`, `showRoleFilter`, `showStatusFilter`, `customFilters` |
| `PaginationControls` | Table pagination | `currentPage`, `totalPages`, `onPageChange`, `pageSize`, `onPageSizeChange`, `totalItems` |
| `ReportHeader` | Title & export buttons | `title`, `description`, `onExportExcel`, `onExportPDF`, `onExportCSV`, `showExportButtons` |
| `KPICard` | Metric card | `label`, `value`, `icon`, `color`, `trend`, `loading` |
| `ErrorBoundary` | Error handling | `children` |

## 📊 Report Components

| Report | Filters | Features | Export |
|--------|---------|----------|--------|
| Annotation Summary | Date, Role | KPIs + Charts | Excel, PDF |
| Annotator Performance | Date | Sortable table, Pagination | Excel, PDF |
| Tester Review | None | Summary KPIs, Rated table | Excel, PDF |
| Payment Report | Date, Status | KPIs, Color-coded status | Excel, PDF |

## 🔧 Hooks Reference

### useReportsData()
```jsx
const { fetchData, loading, error, setError, clearCache } = useReportsData();

// Methods
fetchData(endpoint, params?, cacheKey?)  // Returns Promise with data
clearCache(cacheKey?)                    // Clear cache entries
```

### usePaginatedData(data, pageSize)
```jsx
const { 
  paginatedData,      // [T] - Current page items
  currentPage,        // number
  totalPages,         // number
  goToPage,           // (n: number) => void
  nextPage,           // () => void
  prevPage,           // () => void
  hasNextPage,        // boolean
  hasPrevPage         // boolean
} = usePaginatedData(items, 20);
```

### useFilterState(defaultFilters)
```jsx
const { 
  filters,                  // object - Current filters
  updateFilter,             // (key, value) => void
  updateMultipleFilters,    // (filters) => void
  resetFilters              // () => void
} = useFilterState({ role: 'all' });
```

### useRealtimeUpdates(reportType, onDataUpdate)
```jsx
useRealtimeUpdates('annotation-summary', (data) => {
  // Handle real-time data updates
});
```

## 🎯 StyleBasics

Classes available in admin.css:

```css
.dashboard-container    /* Main wrapper */
.dashboard-main         /* Content area */
.dashboard-header       /* Title section */
.chart-container        /* Chart wrapper */
.table-container        /* Table wrapper */
.kpi-card              /* Metric card */
.reports-table         /* Data table */
.btn-primary           /* Primary button */
.btn-secondary         /* Secondary button */
.assign-select         /* Select dropdown */
.text-input            /* Text input */
.dashboard-loading     /* Loading state */
.error-message         /* Error display */
```

## 🚨 Error Handling

```jsx
// Component level
if (error) {
  return <div style={{ color: '#d32f2f' }}>Error: {error}</div>;
}

// Report level
<ErrorBoundary>
  <YourReport />
</ErrorBoundary>
```

## 📱 Responsive Grid

```jsx
// Auto-fit columns (works great for KPI cards)
style={{
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px"
}}

// Fixed columns
style={{
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "12px"
}}
```

## 🔌 URL Filter Persistence

Automatically synced by `useFilterState`:

```
?startDate=2024-01-01&endDate=2024-12-31&role=annotator&status=pending
```

All filters in URL automatically load on page refresh.

## 📦 Export Options

### Excel
```jsx
ExportService.exportToExcel(
  data,           // Array of objects
  'filename.xlsx', // Output filename
  'SheetName'     // Sheet name in workbook
);
```

### PDF
```jsx
await ExportService.exportToPDF(
  'element-id',   // HTML element to convert
  'filename.pdf', // Output filename
  {               // Options
    orientation: 'portrait',
    format: 'a4',
    scale: 2,
    quality: 0.95
  }
);
```

### CSV
```jsx
ExportService.exportToCSV(data, 'filename.csv');
```

### JSON
```jsx
ExportService.exportToJSON(data, 'filename.json');
```

## 🧪 Testing

```javascript
// Check if data is cached
const cached = localStorage.getItem('cache_key');

// Check authentication
const token = localStorage.getItem('token');

// Manually test endpoint
fetch('/api/dashboard/reports/annotation-summary', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());
```

## 📈 Performance Tips

1. **Use pagination** - Show 20 items per page, not 100
2. **Filter by date** - Reduce data set size
3. **Clear cache** - When data changes frequently
4. **Lazy load reports** - Use tabs to load on-demand
5. **Memoize** - Wrap computed values in useMemo

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module" | Check file paths, ensure files created |
| Charts not showing | Install: `npm install recharts` |
| Export not working | Install: `npm install xlsx jspdf html2canvas` |
| 401 Unauthorized | Check localStorage token exists |
| Filters not persisting | Verify useFilterState initialization |
| Pagination broken | Check data format, ensure array |
| Error boundary triggered | Check component for null data access |

## 📚 Documentation

- **Full Docs**: `components/reports/README.md`
- **Setup Guide**: `REPORTS_SETUP.md`
- **Summary**: `REPORTS_ENHANCEMENT_SUMMARY.md`

## 💡 Code Examples

### Complete Report Component
```jsx
import { useReportsData } from '../../hooks/useReportsData';
import { FilterManager, ReportHeader } from './FilterManager';
import ErrorBoundary from './ErrorBoundary';

export const MyReport = () => {
  const { fetchData, loading, error } = useReportsData();
  const [data, setData] = useState([]);

  useEffect(() => {
    const load = async () => {
      const result = await fetchData('/api/data');
      setData(result);
    };
    load();
  }, [fetchData]);

  if (error) return <div>Error: {error}</div>;

  return (
    <ErrorBoundary>
      <ReportHeader title="My Report" />
      {loading ? <div>Loading...</div> : <Table data={data} />}
    </ErrorBoundary>
  );
};
```

---

**For more information, see the full README.md in the reports component directory.**
