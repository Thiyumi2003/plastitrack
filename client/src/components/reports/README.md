# PlastiTrack Reports & Analytics - Enhanced Architecture

## Overview

The Reports & Analytics module has been completely refactored into a modular, scalable architecture with advanced features including:

- **Separated Report Components** - Each report is now an independent component
- **URL-Based Filter State** - Filters persist in URL for bookmarkable reports
- **Export Functionality** - Export to Excel, PDF, CSV, JSON
- **Data Pagination** - Handle large datasets efficiently
- **Error Boundaries** - Graceful error handling for individual reports
- **Real-time Updates** - WebSocket integration ready
- **Performance Optimized** - Memoization and caching built-in

## Architecture

### File Structure

```
client/src/
├── hooks/
│   └── useReportsData.js          # Custom hooks for data management
├── services/
│   └── ExportService.js           # Export functionality
├── components/reports/
│   ├── FilterManager.jsx          # Unified filter UI components
│   ├── ErrorBoundary.jsx          # Error handling wrapper
│   ├── AnnotationSummaryReport.jsx      # Summary metrics report
│   ├── AnnotatorPerformanceReport.jsx   # Performance table report
│   ├── TesterReviewReport.jsx           # Tester review metrics
│   └── PaymentReport.jsx                # Payment tracking report
└── pages/admin/
    └── AdminReports.jsx           # Main dashboard (tab-based)
```

## Components

### 1. AdminReports.jsx (Main Dashboard)

**Purpose**: Tab-based report navigation and error boundary wrapper

**Features**:
- Tab navigation between reports
- Error boundary around each report
- Global error message display
- Smooth transitions between tabs

**Usage**:
```jsx
<AdminReports />
```

### 2. AnnotationSummaryReport

**Purpose**: Overview of annotation statistics

**Features**:
- KPI cards (total sets, completed, pending, rejected)
- Pie chart (completed vs pending)
- Bar chart (annotator performance comparison)
- Date range + role filtering
- Excel & PDF export

**State**:
- `summary` - Overall metrics
- `summaryPie` - Pie chart data
- `summaryPerf` - Performance comparison data
- `roleFilter`, `startDate`, `endDate` - Filters

### 3. AnnotatorPerformanceReport

**Purpose**: Detailed per-annotator performance metrics

**Features**:
- Sortable data table
- Pagination (20/50/100 items per page)
- Summary KPIs
- Accuracy rates and completion times
- Click columns to sort

**Columns**:
- Name | Total Assigned | Completed | Pending | Approved | Rejected | Accuracy | Avg Completion Time

### 4. TesterReviewReport

**Purpose**: Tester approval/rejection statistics

**Features**:
- Summary KPIs
- Paginated table
- Approval rate analysis
- Accuracy metrics
- Refresh button for real-time data

### 5. PaymentReport

**Purpose**: Annotator payment tracking

**Features**:
- Payment status filtering (pending/approved/paid/rejected)
- Date range filtering
- Summary KPIs
- Status badges with color coding
- Currency formatting (Rs.)

**Columns**:
- Annotator Name | Completed Tasks | Amount | Status | Approved By | Payment Date

### 6. FilterManager.jsx

**Components**:
- `FilterManager` - Unified filter controls
- `PaginationControls` - Table pagination UI
- `ReportHeader` - Report title with export buttons
- `KPICard` - Key metric card display

**FilterManager Features**:
- Date range filtering
- Role filtering (All/Annotators/Testers)
- Status filtering
- Custom filter support
- Clear filters button

## Hooks

### useReportsData()

Custom hook for API data fetching with caching.

```javascript
const { fetchData, loading, error, setError, clearCache } = useReportsData();

// Fetch with automatic caching
const data = await fetchData('/api/endpoint', { param1: value }, 'cacheKey');

// Clear cache when needed
clearCache('cacheKey');
```

**Features**:
- Automatic caching (5-minute TTL)
- Loading state management
- Error handling
- Cache clearing
- Auth header injection

### usePaginatedData(data, pageSize)

Pagination management hook.

```javascript
const { 
  paginatedData,      // Current page data
  currentPage,        // Current page number
  totalPages,         // Total pages
  goToPage,           // Function to go to page
  nextPage,           // Next page function
  prevPage,           // Previous page function
  hasNextPage,        // Boolean
  hasPrevPage         // Boolean
} = usePaginatedData(allData, 20);
```

### useFilterState(defaultFilters)

URL-based filter state management.

```javascript
const { 
  filters,                      // Current filters
  updateFilter,                 // Update single filter
  updateMultipleFilters,        // Update multiple filters
  resetFilters                  // Reset to defaults
} = useFilterState({ role: 'all', startDate: '' });
```

**Features**:
- URL parameter synchronization
- Browser history integration
- Bookmarkable reports
- Persistent filter state across page reloads

### useRealtimeUpdates(reportType, onDataUpdate)

WebSocket integration for real-time updates.

```javascript
useRealtimeUpdates('annotation-summary', (data) => {
  setSummary(data);
});
```

## Services

### ExportService

Export data in multiple formats.

```javascript
// Export to Excel
ExportService.exportToExcel(data, 'report.xlsx', 'Sheet Name');

// Export to PDF (from HTML element)
await ExportService.exportToPDF('element-id', 'report.pdf', options);

// Export to CSV
ExportService.exportToCSV(data, 'report.csv');

// Export to JSON
ExportService.exportToJSON(data, 'report.json');

// Generate PDF from multiple charts
await ExportService.generateChartPDF(charts, 'charts.pdf', 'Title');
```

**Export Options**:
```javascript
{
  orientation: 'portrait',    // 'portrait' or 'landscape'
  format: 'a4',              // Paper size
  scale: 2,                  // Quality scaling
  quality: 0.95              // Image quality (0-1)
}
```

## Usage Examples

### Complete Annotation Summary Report

```jsx
import { AnnotationSummaryReport } from '../../components/reports/AnnotationSummaryReport';

export function MyDashboard() {
  return (
    <ErrorBoundary>
      <AnnotationSummaryReport />
    </ErrorBoundary>
  );
}
```

### Custom Report with Filters

```jsx
import { FilterManager, ReportHeader } from '../../components/reports/FilterManager';
import { useFilterState, useReportsData } from '../../hooks/useReportsData';

function CustomReport() {
  const { filters, updateFilter } = useFilterState({ 
    startDate: '',
    endDate: '',
    role: 'all' 
  });
  const { fetchData, loading } = useReportsData();
  
  const [data, setData] = useState([]);

  useEffect(() => {
    const load = async () => {
      const result = await fetchData('/api/custom', filters);
      setData(result);
    };
    load();
  }, [filters]);

  return (
    <>
      <ReportHeader title="Custom Report" />
      <FilterManager 
        filters={filters}
        onFilterChange={updateFilter}
        showDateFilters
        showRoleFilter
      />
      {loading ? <p>Loading...</p> : <CustomTable data={data} />}
    </>
  );
}
```

### Pagination Example

```jsx
import { PaginationControls } from '../../components/reports/FilterManager';
import { usePaginatedData } from '../../hooks/useReportsData';

function MyTable({ items }) {
  const { paginatedData, currentPage, totalPages, goToPage } = 
    usePaginatedData(items, 20);

  return (
    <>
      <table>{/* Render paginatedData */}</table>
      <PaginationControls 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
        totalItems={items.length}
      />
    </>
  );
}
```

### Export Integration

```jsx
import { ExportService } from '../../services/ExportService';

function ReportWithExport({ data }) {
  const handleExport = () => {
    ExportService.exportToExcel(
      data,
      'my-report.xlsx',
      'Report Data'
    );
  };

  return <button onClick={handleExport}>Download Excel</button>;
}
```

## Performance Optimizations

### 1. Data Caching

- 5-minute cache TTL in useReportsData hook
- Manual cache clearing available
- Reduces redundant API calls

### 2. Memoization

- useMemo for computed values
- useCallback for function dependencies
- Prevents unnecessary re-renders

### 3. Pagination

- Large datasets split into pages
- Configurable page size (10/20/50/100)
- Improves rendering performance

### 4. Lazy Components

- Reports loaded on-demand via tabs
- Error boundaries prevent cascading failures
- Smooth UX with transitions

## Filter Management

### URL State Persistence

Filters automatically sync with URL parameters:

```
/admin/reports?startDate=2024-01-01&endDate=2024-12-31&role=annotator
```

### Complex Filters

Support for custom filter types:

```jsx
<FilterManager
  filters={filters}
  onFilterChange={handleFilterChange}
  customFilters={[
    {
      id: 'department',
      label: 'Department',
      type: 'select',
      options: [
        { value: 'sales', label: 'Sales' },
        { value: 'tech', label: 'Technology' }
      ]
    },
    {
      id: 'projectName',
      label: 'Project',
      type: 'text',
      placeholder: 'Search project...'
    }
  ]}
/>
```

## Error Handling

### Error Boundary

Wraps individual reports to prevent cascading failures:

```jsx
<ErrorBoundary>
  <AnnotationSummaryReport />
</ErrorBoundary>
```

Displays:
- Error message
- Component stack (development only)
- Try Again button for recovery

### Error States in Components

Each component handles:
- Loading states
- Error messages
- Empty data states
- Failed requests with retry capacity

## Real-time Updates (Ready to Implement)

WebSocket hook is prepared for live data:

```jsx
// In any report component
useRealtimeUpdates('annotation-summary', (newData) => {
  setSummary(newData);
});
```

Requires backend WebSocket endpoint:
```
ws://localhost:5000/ws/reports/{reportType}
```

## Dependencies

### External Packages Required

```json
{
  "recharts": "^2.x",
  "axios": "^1.x",
  "xlsx": "^0.18.x",
  "jspdf": "^2.x",
  "html2canvas": "^1.x"
}
```

Installation:
```bash
npm install recharts axios xlsx jspdf html2canvas
```

## Styling

Reports use existing admin CSS (`admin.css`):
- `.dashboard-container` - Main container
- `.dashboard-main` - Content area
- `.dashboard-header` - Title section
- `.chart-container` - Chart wrapper
- `.table-container` - Table wrapper
- `.kpi-card` - Metric card
- `.reports-table` - Data table
- `.btn-primary`, `.btn-secondary` - Buttons

## API Endpoints Used

```
GET /api/dashboard/reports/annotation-summary
GET /api/dashboard/reports/annotator-performance
GET /api/dashboard/reports/tester-review
GET /api/dashboard/reports/payment-report
GET /api/dashboard/reports/image-set-allocation
POST /api/dashboard/performance/users/export (CSV export)
```

## Future Enhancements

- [ ] Advanced drill-down capabilities
- [ ] Custom dashboard builder
- [ ] Scheduled report generation
- [ ] Real-time WebSocket updates
- [ ] More chart types (Sankey, TreeMap)
- [ ] Report templates
- [ ] Comparative period analysis
- [ ] Data quality metrics
- [ ] Automated alerting

## Troubleshooting

### Reports not loading?
- Check API endpoints in browser DevTools
- Verify authentication token in localStorage
- Check useReportsData hook for error messages

### Export not working?
- Ensure ExportService dependencies are installed
- Check browser console for export errors
- Verify data format matches expected structure

### Filters not persisting?
- Browser may block URL modifications
- Check useFilterState hook initialization
- Ensure default filters are properly set

### Pagination issues?
- Verify pageSize matches available data
- Check usePaginatedData calculations
- Ensure data array is properly formatted

## Contributing

When adding new reports:

1. Create component in `components/reports/`
2. Use `useReportsData` for data fetching
3. Use `FilterManager` for filters
4. Wrap with `ErrorBoundary`
5. Add export functionality
6. Register in AdminReports.jsx tabs
7. Add pagination if needed

## Support

For issues or questions:
1. Check this README first
2. Review component examples
3. Check browser DevTools console
4. Verify API endpoints
5. Check authentication
