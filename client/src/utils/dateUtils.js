/**
 * Format date for chart display
 * Converts date strings to readable format like "28 Feb" or "5 Mar"
 * @param {string} dateStr - Date string in ISO format or similar
 * @returns {string} Formatted date string
 */
export const formatChartDate = (dateStr) => {
  if (!dateStr) return "N/A";
  
  try {
    const date = new Date(dateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return "N/A";
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = date.getDate();
    const month = months[date.getMonth()];
    
    return `${day} ${month}`;
  } catch (e) {
    console.error("Date formatting error:", e);
    return "N/A";
  }
};
