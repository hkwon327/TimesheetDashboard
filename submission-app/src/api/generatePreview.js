const BASE = process.env.REACT_APP_PREVIEW_API_BASE_URL;

export async function generatePdfPreview(previewData) {
  if (!BASE) {
    throw new Error(
      "Missing REACT_APP_API_BASE_URL. Check .env.development and restart npm start."
    );
  }

  const base = BASE.replace(/\/+$/, "");
  const url = `${base}/preview`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(previewData),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`Preview API failed: ${response.status} ${raw}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Preview API returned non-JSON: ${raw}`);
  }

  if (!data.ok) {
    throw new Error(data.error || "Preview API returned ok=false");
  }

  if (!data.previewUrl || typeof data.previewUrl !== "string") {
    throw new Error("Preview API missing previewUrl");
  }

  // ✅ iframe에 바로 넣을 수 있는 presigned URL 문자열만 반환
  return data.previewUrl;
}
