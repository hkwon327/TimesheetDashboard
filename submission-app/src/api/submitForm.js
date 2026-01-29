const BASE = process.env.REACT_APP_SUBMIT_API_BASE_URL;

export async function submitTimesheet(formData) {
  if (!BASE) throw new Error("Missing REACT_APP_SUBMIT_API_BASE_URL");

  const submissionData = {
    employeeName: formData.employeeName,
    requestorName: formData.requestorName,
    requestDate: formData.requestDate
      ? formData.requestDate.toISOString().split("T")[0]
      : "",
    serviceWeek: {
      start: formData.serviceWeek?.start || "",
      end: formData.serviceWeek?.end || "",
    },
    signature: formData.signature || "",
    schedule: Object.entries(formData.schedule || {})
      .filter(([_, data]) => {
        if (!data) return false;
        const hasLocation = !!data.location;
        const hasTime =
          (!!data.time && data.time !== "Type in") ||
          (data.time === "Type in" && !!data.customTime);
        return hasLocation && hasTime;
      })
      .map(([day, data]) => ({
        day,
        time: data.time === "Type in" ? data.customTime : data.time,
        location: data.location,
      })),
  };

  const res = await fetch(`${BASE}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submissionData),
  });

  const text = await res.text(); // 에러/성공 모두 대비
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok || !json.ok) {
    throw new Error(`Submit API failed: ${res.status} ${json.error || text}`);
  }

  // ✅ 프론트에서 쓰기 좋은 형태로 normalize
  return {
    ok: true,
    submissionId: json.id,
    pdfKey: json.pdfKey,
    pdfUrl: json.previewUrl,
    status: json.status,
    raw: json,
  };
}
