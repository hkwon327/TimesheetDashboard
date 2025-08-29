const API_BASE_URL = process.env.REACT_APP_API_URL || "http://52.91.22.196:8000";

export async function submitTimesheet(formData) {
  const submissionData = {
    ...formData,
    requestDate: formData.requestDate?.toISOString().split('T')[0] || '',
    schedule: Object.entries(formData.schedule)
      .filter(([_, data]) =>
        (data.time && data.location) ||
        (data.time === 'Type in' && data.customTime && data.location)
      )
      .map(([day, data]) => ({
        day,
        date: getDayDate(formData.serviceWeek.start, day),
        time: data.time === 'Type in' ? data.customTime : data.time,
        location: data.location
      }))
  };

  const response = await fetch(`${API_BASE_URL}/submit-form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submissionData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Form submission failed: ${errorText}`);
  }
  
  return await response.json(); // s3_filename, form_id 등 응답 받을 수 있음
}

function getDayDate(start, day) {
  const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(day);
  const date = new Date(start);
  date.setDate(date.getDate() + dayIndex);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

