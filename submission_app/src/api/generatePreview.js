// submission_app/api/generatePreview.js
  
export async function generatePdfPreview(previewData) {
    //const response = await fetch('http://44.222.140.196:8000/generate-pdf', {
    const response = await fetch('http://localhost:8000/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/pdf',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(previewData)
    });
  
    if (!response.ok) throw new Error('PDF Preview generation failed');
    return await response.blob();
  }
  