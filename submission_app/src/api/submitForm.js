// submission_app/api/submitForm.js

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
  
    const s3Response = await fetch('http://44.222.140.196:8000/save-to-s3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submissionData)
    });
    if (!s3Response.ok) throw new Error('Failed to save PDF to S3');
    const s3Result = await s3Response.json();
  
    const response = await fetch('http://44.222.140.196:8000/submit-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...submissionData,
        pdfUrl: s3Result.file_url,
        id: s3Result.form_id
      })
    });
  
    if (!response.ok) throw new Error('Form submission failed');
  }
  
  function getDayDate(start, day) {
    const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(day);
    const date = new Date(start);
    date.setDate(date.getDate() + dayIndex);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  
  
  

  