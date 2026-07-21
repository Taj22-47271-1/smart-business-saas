export function exportToCsv(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    alert("No data available to export");
    return false;
  }

  const safeFilename = sanitizeFilename(filename || "export.csv");
  const headers = Object.keys(rows[0]);

  const csvRows = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          return escapeCsvValue(row[header]);
        })
        .join(",")
    ),
  ];

  /*
    UTF-8 BOM is important for Excel.
    Without BOM, Bangla/৳ symbols may show broken in Excel.
  */
  const csvContent = "\uFEFF" + csvRows.join("\r\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename.endsWith(".csv")
    ? safeFilename
    : `${safeFilename}.csv`;

  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 100);

  return true;
}

export function formatDateForFilename(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}_${hour}-${minute}`;
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value)
    .replaceAll("\r\n", " ")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
    .replaceAll('"', '""');

  return `"${stringValue}"`;
}

function sanitizeFilename(filename) {
  return String(filename)
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .trim();
}