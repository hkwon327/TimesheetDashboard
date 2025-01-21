import React, { useState, useRef } from 'react';
import SignaturePad from 'react-signature-pad-wrapper';
import './WorkHoursForm.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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
  });

  const workingTimeOptions = [
    'Day Shift: 8:00 AM - 5:00 PM',
    'Night Shift: 8:00 PM - 04:00 AM',
    'Off',
    'Type in'
  ];

  const locationOptions = [
    'TN',
    'KY'
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
    console.log('Submitting form data:', formData);
    
    // Signature validation ONLY for submit
    const isSignatureEmpty = signatureRef.current?.isEmpty();
    if (isSignatureEmpty) {
      alert('Please provide supervisor signature before submitting');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: formData.employeeName })
      });
      console.log('Response:', response);

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      // Handle successful response
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Completely separate clear function
  const handleClearSignature = (e) => {
    e.preventDefault(); // Prevent any form submission
    if (signatureRef.current) {
      signatureRef.current.clear();
    }
  };

  // Separate save function
  const handleSaveSignature = (e) => {
    e.preventDefault(); // Prevent any form submission
    if (signatureRef.current) {
      console.log('Signature saved');
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

  // Add this helper function to format the date
  const formatDayDate = (baseDate, dayOffset) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + dayOffset);
    return date.toLocaleDateString();
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
      // Format the date to a string if it exists
      const formattedDate = formData.requestDate 
        ? new Date(formData.requestDate).toLocaleDateString()
        : '';

      console.log('Preview data:', {
        employeeName: formData.employeeName,
        requestorName: formData.requestorName,
        requestDate: formattedDate
      });

      const response = await fetch('http://localhost:8000/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeName: formData.employeeName || '',
          requestorName: formData.requestorName || '',
          requestDate: formattedDate
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const windowFeatures = 'width=800,height=900,left=200,top=100';
      window.open(url, 'PreviewWindow', windowFeatures);
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  };

  return (
    <div className="form-container">
      <h1>Weekly Work Hours Submission Form</h1>
      <p className="form-subtitle">Please fill in your work schedule for the current week</p>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Employee Name</label>
          <input
            type="text"
            placeholder="Enter your full name"
            value={formData.employeeName}
            onChange={(e) => setFormData(prev => ({ ...prev, employeeName: e.target.value }))}
          />
        </div>

        <div className="input-group">
          <label>Requestor Name</label>
          <input
            type="text"
            placeholder="Enter requestor name"
            value={formData.requestorName}
            onChange={(e) => setFormData(prev => ({ ...prev, requestorName: e.target.value }))}
          />
        </div>

        <div className="input-group">
          <label>Request Date</label>
          <div className="date-input-container">
            <DatePicker
              selected={formData.requestDate}
              onChange={handleDateChange}
              placeholderText="Select request date"
              className="datepicker-input"
              popperPlacement="bottom"
            />
          </div>
        </div>

        <div className="input-group">
          <label>Service Week</label>
          <div className="date-input-container">
            <DatePicker
              selected={formData.serviceWeek.start ? new Date(formData.serviceWeek.start) : null}
              onChange={handleServiceWeekChange}
              placeholderText="Select service week"
              className="datepicker-input"
              popperPlacement="bottom"
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
          <label>Supervisor Signature</label>
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