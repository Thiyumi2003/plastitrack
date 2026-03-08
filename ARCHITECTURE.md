# Architecture Overview

## Component Hierarchy

```
AdminReports (Main Dashboard)
├── ErrorBoundary
│   └── AnnotationSummaryReport
│       ├── FilterManager
│       ├── KPICard (x6)
│       ├── PieChart (Recharts)
│       └── BarChart (Recharts)
│
├── ErrorBoundary
│   └── AnnotatorPerformanceReport
│       ├── FilterManager
│       ├── KPICard (x4)
│       ├── Sortable Table
│       └── PaginationControls
│
├── ErrorBoundary
│   └── TesterReviewReport
│       ├── ReportHeader
│       ├── KPICard (x5)
│       ├── Data Table
│       └── PaginationControls
│
└── ErrorBoundary
    └── PaymentReport
        ├── FilterManager
        ├── KPICard (x6)
        ├── Data Table
        └── PaginationControls
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   React Component Tree                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
   ┌─────────────┐                    ┌──────────────────┐
   │  Hooks      │                    │  UI Components   │
   ├─────────────┤                    ├──────────────────┤
   │useReports   │                    │FilterManager     │
   │usePaginated │                    │ErrorBoundary     │
   │useFilter    │                    │ReportHeader      │
   │useRealtime  │                    │KPICard           │
   └─────┬───────┘                    └────────┬─────────┘
         │                                      │
         └──────────────┬───────────────────────┘
                        ↓
            ┌───────────────────────┐
            │   State Management    │
            ├───────────────────────┤
            │ Local component state │
            │ Filter state (URL)    │
            │ Data cache (hooks)    │
            │ Pagination state      │
            └───────┬───────────────┘
                    ↓
        ┌───────────────────────────┐
        │   API & Services          │
        ├───────────────────────────┤
        │ Axios HTTP client         │
        │ ExportService             │
        │ Cache management 5min TTL │
        │ WebSocket (ready)         │
        └───────┬───────────────────┘
                ↓
        ┌───────────────────────────┐
        │   Backend API             │
        ├───────────────────────────┤
        │ /api/dashboard/reports/*  │
        │ /api/dashboard/performance/*│
        └───────────────────────────┘
```

## Hook Dependencies

```
useReportsData()
├── useState (loading, error, cache)
├── useCallback (fetchData, clearCache)
├── useRef (cache store, timeouts)
└── axios (HTTP requests)

usePaginatedData(data, pageSize)
├── useState (currentPage)
├── useCallback (pagination functions)
└── useMemo (calculate paginatedData, totalPages)

useFilterState(defaults)
├── useState (filters)
├── useCallback (updateFilter, resetFilters)
├── useEffect (track URL changes)
└── URLSearchParams (URL management)

useRealtimeUpdates(reportType, callback)
├── useEffect (WebSocket lifecycle)
├── WebSocket API
└── useCallback (message handler)
```

## Export Architecture

```
ExportService
├── exportToExcel()
│   ├── xlsx.json_to_sheet()
│   ├── Auto-adjust columns
│   └── xlsx.writeFile()
│
├── exportToPDF()
│   ├── html2canvas()
│   ├── jsPDF()
│   ├── Multi-page support
│   └── Image insertion
│
├── exportToCSV()
│   ├── CSV string building
│   ├── Quote escaping
│   └── Blob download
│
├── exportToJSON()
│   ├── JSON.stringify()
│   └── Blob download
│
└── generateChartPDF()
    ├── Multiple charts
    ├── html2canvas batch
    └── Multi-page PDF
```

## State Management Pattern

```
Component State:
┌───────────────────┐
│ data State        │ → useEffect dependency
└────────┬──────────┘
         │ fetchData()
         ↓
┌───────────────────────────┐
│ useReportsData Hook       │
├───────────────────────────┤
│ - Manages API requests    │
│ - Handles loading/error   │
│ - Stores in cache ref     │
│ - Returns cached data     │
└──────┬────────────────────┘
       │ Cache hit/miss
       ↓
   ┌───────────┐
   │ API Call  │ (only on miss)
   │ Axios GET │
   └─────┬─────┘
         │ Response
         ↓
   ┌──────────────┐
   │ Cache Store  │ (5 min TTL)
   │  In memory   │
   └──────────────┘
```

## Filter State Persistence

```
User Changes Filter
        │
        ↓
┌──────────────────┐
│ onFilterChange() │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────┐
│ useFilterState Hook      │
├──────────────────────────┤
│ update component state   │
└────────┬─────────────────┘
         │
         ├─→ window.history.replaceState()
         │   └─→ URL Updated
         │
         └─→ Re-fetch data()
             └─→ Component re-renders

On Page Reload:
        │
        ↓
┌──────────────────────────┐
│ useFilterState Init      │
├──────────────────────────┤
│ Read URLSearchParams     │
│ Restore filters from URL │
└────────┬─────────────────┘
         │
         └─→ Restore saved state
```

## Performance Optimization

```
Render Optimization:
┌─────────────────────────┐
│ useMemo                 │ → Computed values cached
│ useCallback             │ → Functions memoized
│ React.memo              │ → Component comparisons
└─────────────────────────┘

Data Optimization:
┌─────────────────────────┐
│ API Caching             │ → 5-min TTL
│ Data Pagination         │ → Only render currentPage
│ Lazy Components         │ → Load on tab select
└─────────────────────────┘

Bundle Optimization:
┌─────────────────────────┐
│ Code Splitting          │ → Per-component bundles
│ Dynamic Imports         │ → Tabs loaded on demand
│ Tree Shaking            │ → Unused code removed
└─────────────────────────┘
```

## Error Handling Flow

```
Error Occurs in Component
        │
        ↓
┌─────────────────────┐
│ Error Boundary      │ ← Catches thrown errors
│ getDerivedStateFrom │
│ Error()             │
└────────┬────────────┘
         │
         ├─→ Set hasError state
         │
         ├─→ Log error
         │
         └─→ Render error UI
             ├─→ Error message
             ├─→ Stack trace (dev only)
             └─→ Retry button

User Clicks Retry:
        │
        ↓
┌──────────────────┐
│ handleReset()    │
└────────┬─────────┘
         │
         ├─→ Clear error state
         │
         └─→ Component re-mounts
```

## Request/Response Cycle

```
Component Mounts/Filters Change
        │
        ↓
┌─────────────────────────┐
│ useEffect() triggered   │
│ fetchData() called      │
└────────┬────────────────┘
         │
         ├─→ setLoading(true)
         │
         ├─→ Check cache
         │   ├─ Cache hit?
         │   │  └─ Return cached data
         │   └─ Cache miss?
         │      └─ Continue to API
         │
         ├─→ Build params
         │   └─ Filter nulls/undefined
         │
         ├─→ Axios GET request
         │   └─ Add Auth header
         │
         ├─→ Response
         │   ├─ Success? → Cache + return
         │   └─ Error?   → setError()
         │
         └─→ setLoading(false)
             └─ Component re-renders
```

## URL Persistence Pattern

```
Initial Load:
  URL: /admin/reports
       ↓
  Read URLSearchParams
       ↓
  Initialize filters from URL params
       ↓
  Render with restored filters

User Updates Filter:
  Filter Value Changed
       ↓
  updateFilter(key, value)
       ↓
  Update component state
       ↓
  window.history.replaceState()
       ↓
  URL: /admin/reports?startDate=2024-01-01&role=annotator

Page Refresh/New Tab:
  URL: /admin/reports?startDate=2024-01-01&role=annotator
       ↓
  Read URLSearchParams
       ↓
  Restore exact previous state
       ↓
  User experience: Seamless continuity
```

## Component Composition

```
AdminReports (Container)
├── Sidebar
├── Header
├── TabNavigation
└── ReportContent
    └── ErrorBoundary (Key!)
        └── ActiveReport
            ├── ReportHeader
            │   ├── Title
            │   └── Export Buttons
            ├── FilterManager
            │   ├── DateFilters
            │   ├── SelectFilters
            │   └── ClearButton
            ├── KPICards
            │   └── KPICard (n)
            ├── DataTable/Chart
            │   └── Responsive Grid
            └── PaginationControls
                ├── PageInfo
                ├── PageButtons
                └── PageSizeSelector
```

## Data Types & Interfaces

```typescript
// Filter State
interface FilterState {
  startDate?: string;
  endDate?: string;
  role?: 'all' | 'annotator' | 'tester';
  status?: 'all' | 'pending' | 'approved' | 'paid' | 'rejected';
  [key: string]: any;
}

// Report Data
interface Report {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType;
}

// Pagination
interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

// API Cache
interface CacheEntry {
  data: any;
  timestamp: number;
}

// Export Options
interface ExportOptions {
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
  scale?: number;
  quality?: number;
}
```

---

## Summary

This architecture provides:
- **Scalability**: Easy to add new reports and features
- **Maintainability**: Clear separation of concerns
- **Performance**: Caching, pagination, memoization
- **Reliability**: Error boundaries, error handling
- **User Experience**: Smooth transitions, persistent state
- **Developer Experience**: Reusable hooks, clear patterns

Total lines of code: ~2,300 (well-organized and documented)
