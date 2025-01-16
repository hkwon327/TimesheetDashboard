import React, { useState, useRef } from 'react';
import SignaturePad from 'react-signature-pad-wrapper';
import './WorkHoursForm.css';

const WorkHoursForm = () => {
  const signaturePadRef = useRef(null);
  const [formData, setFormData] = useState({
    employeeName: '',
    requestDate: '',
    requestorName: '',
    serviceWeek: {
      start: '',
      end: ''
    },
    schedule: {
      Monday: { time: '', location: '' },
      Tuesday: { time: '', location: '' },
      Wednesday: { time: '', location: '' },
      Thursday: { time: '', location: '' },
      Friday: { time: '', location: '' },
    },
    supervisorSignature: null,
  });

  const workingTimeOptions = [
    '9:00 AM - 5:00 PM',
    '8:00 AM - 4:00 PM',
    '10:00 AM - 6:00 PM',
    'Off',
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

  // Handle service week selection
  const handleWeekSelection = (date) => {
    const weekDates = getWeekDates(date);
    setFormData(prev => ({
      ...prev,
      serviceWeek: weekDates
    }));
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
    if (!formData.supervisorSignature) {
      alert('Please provide supervisor signature before submitting');
      return;
    }
    
    try {
      // Add your API submission logic here
      console.log('Form submitted:', formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const clearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setFormData(prev => ({ ...prev, supervisorSignature: null }));
    }
  };

  const saveSignature = () => {
    if (signaturePadRef.current) {
      const signatureData = signaturePadRef.current.toDataURL();
      setFormData(prev => ({ ...prev, supervisorSignature: signatureData }));
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
          <label>Request Date</label>
          <input
            type="date"
            value={formData.requestDate}
            onChange={(e) => setFormData(prev => ({ ...prev, requestDate: e.target.value }))}
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
          <label>Service Week (Monday - Friday)</label>
          <div className="service-week-display">
            <input
              type="date"
              value={formData.serviceWeek.start}
              onChange={(e) => handleWeekSelection(e.target.value)}
            />
            <span className="date-range">
              {formData.serviceWeek.start && formData.serviceWeek.end && 
                `${new Date(formData.serviceWeek.start).toLocaleDateString()} - ${new Date(formData.serviceWeek.end).toLocaleDateString()}`
              }
            </span>
          </div>
        </div>

        <div className="schedule-grid">
          <div className="grid-header">
            <span>Day</span>
            <span>Time</span>
            <span>Location</span>
          </div>

          {Object.keys(formData.schedule).map((day) => (
            <div key={day} className="grid-row">
              <span className="day-label">{day}</span>
              <select
                value={formData.schedule[day].time}
                onChange={(e) => handleInputChange(day, 'time', e.target.value)}
              >
                <option value="">Select working time</option>
                {workingTimeOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
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

        <div className="signature-section">
          <label>Supervisor Signature</label>
          <div className="signature-container">
            <div className="signature-pad-wrapper">
              <SignaturePad
                ref={signaturePadRef}
                options={{
                  minWidth: 1,
                  maxWidth: 2,
                  penColor: 'black',
                  backgroundColor: 'rgb(255, 255, 255)',
                }}
              />
            </div>
            <div className="signature-buttons">
              <button 
                type="button" 
                onClick={clearSignature} 
                className="clear-signature"
              >
                Clear Signature
              </button>
              <button 
                type="button" 
                onClick={saveSignature} 
                className="save-signature"
              >
                Save Signature
              </button>
            </div>
          </div>
        </div>

        <button type="submit" className="submit-button">
          Submit
        </button>
      </form>
    </div>
  );
};

export default WorkHoursForm; 