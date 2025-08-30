const BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

export async function generatePdfPreview(previewData) {
  const response = await fetch(`${BASE}/generate-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/pdf",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(previewData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PDF Preview generation failed: ${response.status} ${errorText}`);
  }

  return await response.blob();
}
