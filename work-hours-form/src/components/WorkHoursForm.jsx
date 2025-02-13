import React, { useState, useRef } from 'react';
import SignaturePad from 'react-signature-pad-wrapper';
import './WorkHoursForm.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import logo from './asset/logo.png';

const WorkHoursForm = () => {
  const signatureRef = useRef();
  const [formData, setFormData] = useState({
    employeeName: '',
    requestDate: null,
    requestorName: '',
    serviceWeek: {
      start: '',
      end: ''
    },
    schedule: {
      Monday: { time: '', location: '', customTime: '' },
      Tuesday: { time: '', location: '', customTime: '' },
      Wednesday: { time: '', location: '', customTime: '' },
      Thursday: { time: '', location: '', customTime: '' },
      Friday: { time: '', location: '', customTime: '' },
    },
    supervisorSignature: null,
    savedSignature: null  
  });

  const [isRequestDateOpen, setIsRequestDateOpen] = useState(false);
  const [isServiceWeekOpen, setIsServiceWeekOpen] = useState(false);

  const workingTimeOptions = [
    '8:00 AM - 5:00 PM',
    //'Day Shift: 8:00 AM - 5:00 PM',
    //'Night Shift: 8:00 PM - 04:00 AM',
    'Off',
    //'Type in'
  ];

  const locationOptions = [
    'BOSK Trailer',
    'SAMKOO Trailer',
    //'TN',
    'N/A',
    //'KY'
  ];

  // Function to get Monday and Friday dates from a selected date
  const getWeekDates = (date) => {
    const selectedDate = new Date(date);
    const day = selectedDate.getDay();
    
    // Calculate Monday (start of week)
    const monday = new Date(selectedDate);
    const mondayDiff = day === 0 ? -6 : 1 - day; // Adjust for Sunday
    monday.setDate(selectedDate.getDate() + mondayDiff);
    
    // Calculate Friday (end of week)
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    return {
      start: monday.toISOString().split('T')[0],
      end: friday.toISOString().split('T')[0]
    };
  };

  const handleInputChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 1. Validation 체크
    if (!formData.employeeName.trim()) {
      alert('Employee Name is required');
      return;
    }
    
    if (!formData.requestorName.trim()) {
      alert('Requestor Name is required');
      return;
    }

    if (!formData.requestDate) {
      alert('Request Date is required');
      return;
    }

    if (!formData.serviceWeek.start || !formData.serviceWeek.end) {
      alert('Service Week is required');
      return;
    }

    // Schedule validation
    let hasScheduleData = false;
    let missingFields = [];
    
    Object.entries(formData.schedule).forEach(([day, data]) => {
      if (data.time) { // If time is selected
        hasScheduleData = true;
        if (!data.location) {
          missingFields.push(`Location for ${day}`);
        }
      }
      if (data.location && !data.time) {
        missingFields.push(`Time for ${day}`);
      }
    });

    if (!hasScheduleData) {
      alert('At least one day schedule must be filled');
      return;
    }

    if (missingFields.length > 0) {
      alert(`Please fill in the following fields:\n${missingFields.join('\n')}`);
      return;
    }

    // Signature validation
    if (!formData.savedSignature) {
      alert('Please save the signature before submitting');
      return;
    }

    // 2. 모든 validation 통과 후 데이터 준비
    const submissionData = {
      id: "",  // 빈 문자열로 초기화
      employeeName: formData.employeeName,
      requestorName: formData.requestorName,
      requestDate: formData.requestDate.toISOString().split('T')[0],
      serviceWeek: {
        start: formData.serviceWeek.start,
        end: formData.serviceWeek.end
      },
      schedule: Object.entries(formData.schedule)
        .filter(([_, data]) => data.time && data.location)
        .map(([day, data]) => ({
          day,
          date: getDayDate(day),
          time: data.time,
          location: data.location
        })),
      signature: formData.savedSignature
    };

    console.log('Submitting data:', submissionData);

    try {
      // 1. 먼저 S3에 PDF 저장
      console.log('Saving PDF to S3...');
      const s3Response = await fetch('http://44.222.140.196:8000/save-to-s3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData)
      });

      if (!s3Response.ok) {
        const errorText = await s3Response.text();
        console.error('S3 save error:', errorText);
        throw new Error('Failed to save PDF to S3');
      }

      const s3Result = await s3Response.json();
      console.log('PDF saved to S3:', s3Result);

      // 2. form 데이터 제출 - S3에서 받은 ID 사용
      const response = await fetch('http://44.222.140.196:8000/submit-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...submissionData,
          pdfUrl: s3Result.file_url,
          id: s3Result.form_id  // S3에서 받은 ID 사용
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      alert('Form submitted successfully!');
      
      // 4. 폼 초기화 (선택사항)
      setFormData({
        employeeName: '',
        requestDate: null,
        requestorName: '',
        serviceWeek: {
          start: '',
          end: ''
        },
        schedule: {
          Monday: { time: '', location: '', customTime: '' },
          Tuesday: { time: '', location: '', customTime: '' },
          Wednesday: { time: '', location: '', customTime: '' },
          Thursday: { time: '', location: '', customTime: '' },
          Friday: { time: '', location: '', customTime: '' },
        },
        supervisorSignature: null,
        savedSignature: null
      });
      
      if (signatureRef.current) {
        signatureRef.current.clear();
      }

    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Failed to submit form. Please try again.');
    }
  };

  const handleSaveSignature = () => {
    if (signatureRef.current) {
      // Get signature data
      const signatureData = signatureRef.current.toDataURL();
      
      // Save signature to form state
      setFormData(prev => ({
        ...prev,
        savedSignature: signatureData
      }));

      console.log('Signature saved');
      // Optional: Add visual feedback
      alert('Signature saved successfully');
    }
  };

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      // Clear saved signature from state
      setFormData(prev => ({
        ...prev,
        savedSignature: null
      }));
    }
  };

  const handleServiceWeekChange = (date) => {
    if (date) {
      const weekDates = getWeekDates(date);
      setFormData(prev => ({
        ...prev,
        serviceWeek: weekDates
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        serviceWeek: {
          start: '',
          end: ''
        }
      }));
    }
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({ ...prev, requestDate: date }));
  };

  // 날짜를 'MM/DD' 형식으로 변환하는 함수
  const formatDayDate = (baseDate, dayOffset) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + dayOffset);
    return `${date.getMonth() + 1}/${date.getDate()}`; // YYYY 년도 제외
  };

  // Add this function to get the day's date
  const getDayDate = (day) => {
    if (!formData.serviceWeek.start) return '';
    const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(day);
    if (dayIndex === -1) return '';
    return formatDayDate(formData.serviceWeek.start, dayIndex);
  };

  const handlePreview = async () => {
    try {
      // 필수 필드 검증
      if (!formData.employeeName.trim()) {
        alert('Employee Name is required');
        return;
      }
      if (!formData.requestorName.trim()) {
        alert('Requestor Name is required');
        return;
      }
      if (!formData.requestDate) {
        alert('Request Date is required');
        return;
      }
      if (!formData.serviceWeek.start || !formData.serviceWeek.end) {
        alert('Service Week dates are required');
        return;
      }

      const previewData = {
        employeeName: formData.employeeName,
        requestorName: formData.requestorName,
        requestDate: formData.requestDate ? new Date(formData.requestDate).toISOString().split('T')[0] : '',
        serviceWeek: {
          start: formData.serviceWeek.start,
          end: formData.serviceWeek.end
        },
        schedule: Object.entries(formData.schedule)
          .map(([day, data]) => ({
            day,
            date: getDayDate(day),
            time: data.time || '',
            location: data.location || ''
          })),
        signature: formData.savedSignature || null
      };

      console.log('Preview data being sent:', previewData);
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const serverUrl = isMobile 
        ? 'http://44.222.140.196:8000/generate-pdf'  // EC2 퍼블릭 IP (변경 필요)
        : 'http://44.222.140.196:8000/generate-pdf';
        
      
      console.log('Device:', isMobile ? 'Mobile' : 'Desktop');
      console.log('Using server URL:', serverUrl);

      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/pdf',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(previewData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error(`Server error: ${response.status} ${errorText}`);
      }

      const blob = await response.blob();
      console.log('Received blob:', blob.type, blob.size);

      // 모바일에서는 다운로드 방식으로 처리
      if (isMobile) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'preview.pdf';  // 다운로드될 파일 이름
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // 데스크톱에서는 새 창에서 열기
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      }

    } catch (error) {
      console.error('Error details:', error);
      console.error('Error stack:', error.stack);
      alert(`Error generating PDF preview. Please try again.`);
    }
  };

  console.log('Form Data:', formData);  // Add this before return statement

  return (
    <div className="form-container">
      <div className="form-header">
        <h1>Service Hour Request Form</h1>
        <div className="form-subtitle">
          <p>* This form is for the purpose of requesting hourly interpretaion or <br />tranlsation services and for providing evidence of service provision.</p>
          <p>* This form can contain requests and evidence for one person on a maximum weekly basis.</p>
          <p>* If the service is provided on an emergency request basis, this document must be signed within<br /> 1 working day afterwards to servce as a basis for future settlemetns.</p>
          <p>* If you wish to substitute evidence of hourly interpretation and translation services provided with <br />a different form than this one, prior consultation wiht the BOSK interrpetation manager is required.</p>
        </div>
        <div className="logo-container">
          <img src={logo} alt="Moveret Logo" className="logo" />
          <span className="logo-text">M O V E R E T</span>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="input-group first-input">
          <input
            required
            type="text"
            className="input"
            //placeholder=" Enter your name"
            value={formData.employeeName}
            onChange={(e) => setFormData(prev => ({ ...prev, employeeName: e.target.value }))}
          />
          <label className="user-label">Employee Name</label>
        </div>

        <div className="input-group">
          <label className="user-label">Requestor Name</label>
          <input
            type="text"
            className="input"
            //placeholder="Enter requestor name"
            value={formData.requestorName}
            onChange={(e) => setFormData(prev => ({ ...prev, requestorName: e.target.value }))}
          />
        </div>

        <div className="input-group">
          <label className="user-label">Request Date</label>
          <div className="date-input-container">
            <DatePicker
              selected={formData.requestDate}
              onChange={(date) => {
                handleDateChange(date);
                setIsRequestDateOpen(false);
                if ('ontouchstart' in window) {
                  const picker = document.querySelector('.react-datepicker-popper');
                  if (picker) picker.remove();
                }
              }}
              className="input"
              popperPlacement="bottom"
              shouldCloseOnSelect={true}
              open={isRequestDateOpen}
              onCalendarOpen={() => setIsRequestDateOpen(true)}
              onCalendarClose={() => setIsRequestDateOpen(false)}
            />
          </div>
        </div>

        <div className="input-group">
          <label className="user-label">Service Week</label>
          <div className="date-input-container">
            <DatePicker
              selected={formData.serviceWeek.start ? new Date(formData.serviceWeek.start) : null}
              onChange={(date) => {
                handleServiceWeekChange(date);
                setIsServiceWeekOpen(false);
                if ('ontouchstart' in window) {
                  const picker = document.querySelector('.react-datepicker-popper');
                  if (picker) picker.remove();
                }
              }}
              className="input"
              popperPlacement="bottom"
              shouldCloseOnSelect={true}
              open={isServiceWeekOpen}
              onCalendarOpen={() => setIsServiceWeekOpen(true)}
              onCalendarClose={() => setIsServiceWeekOpen(false)}
            />
          </div>
          {formData.serviceWeek.start && formData.serviceWeek.end && (
            <div className="service-week-dates">
              Monday - Friday: {`${new Date(formData.serviceWeek.start).toLocaleDateString()} - ${new Date(formData.serviceWeek.end).toLocaleDateString()}`}
            </div>
          )}
        </div>

        <div className="schedule-grid">
          <div className="grid-header">
            <span>Day</span>
            <span>Time</span>
            <span>Location</span>
          </div>

          {Object.keys(formData.schedule).map((day) => (
            <div key={day} className="grid-row">
              <span className="day-label">
                {day}
                {formData.serviceWeek.start && (
                  <span className="day-date"> ({getDayDate(day)})</span>
                )}
              </span>
              {formData.schedule[day].time === 'Type in' ? (
                <input
                  type="text"
                  placeholder="Enter working hours"
                  value={formData.schedule[day].customTime || ''}
                  onChange={(e) => handleInputChange(day, 'customTime', e.target.value)}
                  className="custom-time-input"
                />
              ) : (
                <select
                  value={formData.schedule[day].time}
                  onChange={(e) => handleInputChange(day, 'time', e.target.value)}
                >
                  <option value="">Select working time</option>
                  {workingTimeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              )}
              <select
                value={formData.schedule[day].location}
                onChange={(e) => handleInputChange(day, 'location', e.target.value)}
              >
                <option value="">Select location</option>
                {locationOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="input-group">
          <label>SK ME/SAMKOO Signature</label>
          <div className="signature-container">
            <div className="signature-pad">
              <SignaturePad
                ref={signatureRef}
                canvasProps={{
                  className: "signature-canvas"
                }}
              />
            </div>
            <div className="signature-buttons">
              <button 
                type="button"
                className="signature-button clear-button" 
                onClick={handleClearSignature}
              >
                Clear Signature
              </button>
              <button 
                type="button"
                className="signature-button save-button"
                onClick={handleSaveSignature}
              >
                Save Signature
              </button>
            </div>
          </div>
        </div>

        <div className="form-buttons">
          <button
            type="button"
            className="preview-button"
            onClick={handlePreview}
          >
            Preview
          </button>
          <button
            type="submit"
            className="submit-button"
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default WorkHoursForm; 