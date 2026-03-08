import { useState, useCallback, useRef, useEffect } from "react";
import axios from "axios";

/**
 * Custom hook for fetching report data with caching and error handling
 * Prevents unnecessary API calls and manages loading states
 */
export const useReportsData = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cacheRef = useRef({});
  const requestTimeoutRef = useRef({});

  const getAuthHeader = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  const fetchData = useCallback(async (endpoint, params = {}, cacheKey = null) => {
    // Return cached data if available
    if (cacheKey && cacheRef.current[cacheKey]) {
      const { data, timestamp } = cacheRef.current[cacheKey];
      // Use cache if less than 5 minutes old
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        return data;
      }
    }

    // Cancel previous request if exists
    if (requestTimeoutRef.current[endpoint]) {
      clearTimeout(requestTimeoutRef.current[endpoint]);
    }

    try {
      setError("");
      setLoading(true);

      const response = await axios.get(
        `http://localhost:5000${endpoint}`,
        {
          headers: getAuthHeader(),
          params: Object.fromEntries(
            Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "")
          ),
        }
      );

      // Cache the response
      if (cacheKey) {
        cacheRef.current[cacheKey] = {
          data: response.data,
          timestamp: Date.now(),
        };
      }

      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to load data";
      setError(errorMsg);
      console.error(`Error fetching ${endpoint}:`, err);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  const clearCache = useCallback((cacheKey = null) => {
    if (cacheKey) {
      delete cacheRef.current[cacheKey];
    } else {
      cacheRef.current = {};
    }
  }, []);

  return {
    fetchData,
    loading,
    error,
    setError,
    clearCache,
  };
};

/**
 * Hook for managing paginated data
 */
export const usePaginatedData = (data = [], pageSize = 20) => {
  const [currentPage, setCurrentPage] = useState(1);

  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const paginatedData = data.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(data.length / pageSize);

  const goToPage = (pageNumber) => {
    const page = Math.max(1, Math.min(pageNumber, totalPages));
    setCurrentPage(page);
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  return {
    paginatedData,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
};

/**
 * Hook for managing URL-based filter state
 */
export const useFilterState = (defaultFilters = {}) => {
  const [filters, setFilters] = useState(() => {
    // Initialize from URL params
    const params = new URLSearchParams(window.location.search);
    const urlFilters = {};
    for (const [key, value] of params) {
      urlFilters[key] = value;
    }
    return Object.keys(urlFilters).length > 0 ? urlFilters : defaultFilters;
  });

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const updated = { ...prev, [key]: value };
      // Update URL
      const params = new URLSearchParams();
      Object.entries(updated).forEach(([k, v]) => {
        if (v && v !== "all" && v !== "") {
          params.set(k, v);
        }
      });
      window.history.replaceState(null, "", `?${params.toString()}`);
      return updated;
    });
  }, []);

  const updateMultipleFilters = useCallback((newFilters) => {
    setFilters((prev) => {
      const updated = { ...prev, ...newFilters };
      // Update URL
      const params = new URLSearchParams();
      Object.entries(updated).forEach(([k, v]) => {
        if (v && v !== "all" && v !== "") {
          params.set(k, v);
        }
      });
      window.history.replaceState(null, "", `?${params.toString()}`);
      return updated;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    window.history.replaceState(null, "", window.location.pathname);
  }, [defaultFilters]);

  return {
    filters,
    updateFilter,
    updateMultipleFilters,
    resetFilters,
  };
};

/**
 * Hook for real-time WebSocket data updates
 */
export const useRealtimeUpdates = (reportType, onDataUpdate) => {
  useEffect(() => {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//localhost:5000/ws/reports/${reportType}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onDataUpdate(data);
      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [reportType, onDataUpdate]);
};
