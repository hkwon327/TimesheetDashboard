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
    'TN',
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
    console.log('Submitting form data:', formData);
    
    // Signature validation ONLY for submit
    const isSignatureEmpty = signatureRef.current?.isEmpty();
    if (isSignatureEmpty) {
      alert('Please provide supervisor signature before submitting');
      return;
    }

    try {
      const response = await fetch('http://98.81.114.125/generate-pdf', {
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
      const formattedDate = formData.requestDate 
        ? new Date(formData.requestDate).toLocaleDateString()
        : '';

      const serviceWeekFormatted = formData.serviceWeek.start && formData.serviceWeek.end
        ? `${new Date(formData.serviceWeek.start).toLocaleDateString()} - ${new Date(formData.serviceWeek.end).toLocaleDateString()}`
        : '';

      // Format schedule data with dates
      const scheduleData = Object.entries(formData.schedule).map(([day, data]) => ({
        day,
        date: getDayDate(day),
        time: data.time === 'Type in' ? data.customTime : data.time,
        location: data.location
      }));

      const requestData = {
        employeeName: formData.employeeName || '',
        requestorName: formData.requestorName || '',
        requestDate: formattedDate,
        serviceWeek: serviceWeekFormatted,
        schedule: scheduleData,  // Add schedule data
        signature: formData.savedSignature || ''
      };

      console.log('Sending data to API:', requestData);

      const response = await fetch('http://98.81.114.125/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
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

  console.log('Form Data:', formData);  // Add this before return statement

  return (
    <div className="form-container">
      <div className="form-header">
        <h1>Work Hours Request Form</h1>
        <p className="form-subtitle">Please fill out all required fields</p>
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