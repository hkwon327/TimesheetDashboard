import React, { useState, useRef } from 'react';
import SignaturePad from 'react-signature-pad-wrapper';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/WorkHoursForm.css';
import logo from '../assets/logo.png';

import { initialFormData, workingTimeOptions } from '../types/formSchema';
import { submitTimesheet } from '../api/submitForm';
import { generatePdfPreview } from '../api/generatePreview';

const WorkHoursForm = () => {
  const signatureRef = useRef();
  const [formData, setFormData] = useState(initialFormData);
  const [isRequestDateOpen, setIsRequestDateOpen] = useState(false);
  const [isServiceWeekOpen, setIsServiceWeekOpen] = useState(false);
  const [customTimeWarnings, setCustomTimeWarnings] = useState({});

  const locationOptions = ['BOSK Trailer', 'SAMKOO Trailer', 'Off'];

  const handleInputChange = (day, field, value) => {
    if (field === 'customTime') {
      const isValid = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(value);
      setCustomTimeWarnings(prev => ({ ...prev, [day]: !isValid }));
    }
  
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
  

  const handleServiceWeekChange = (date) => {
    if (date) {
      const selectedDate = new Date(date);
      const day = selectedDate.getDay();
      const monday = new Date(selectedDate);
      monday.setDate(selectedDate.getDate() - ((day + 6) % 7));
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      setFormData(prev => ({
        ...prev,
        serviceWeek: {
          start: monday.toISOString().split('T')[0],
          end: friday.toISOString().split('T')[0]
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        serviceWeek: { start: '', end: '' }
      }));
    }
  };

  const getDayDate = (day) => {
    if (!formData.serviceWeek.start) return '';
    const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(day);
    const date = new Date(formData.serviceWeek.start);
    date.setDate(date.getDate() + dayIndex);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleSaveSignature = () => {
    if (signatureRef.current) {
      const signatureData = signatureRef.current.toDataURL();
      setFormData(prev => ({ ...prev, savedSignature: signatureData }));
      alert('Signature saved successfully');
    }
  };

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setFormData(prev => ({ ...prev, savedSignature: null }));
    }
  };

  const handlePreview = async () => {
    try {
      const previewData = {
        employeeName: formData.employeeName,
        requestorName: formData.requestorName,
        requestDate: formData.requestDate?.toISOString().split('T')[0] || '',
        serviceWeek: formData.serviceWeek,
        schedule: Object.entries(formData.schedule).map(([day, data]) => ({
          day,
          date: getDayDate(day),
          time: data.time === 'Type in' ? data.customTime : data.time,
          location: data.location || ''
        })),
        signature: formData.savedSignature || ''
      };
      const blob = await generatePdfPreview(previewData);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Preview error:', error);
      alert('Failed to preview PDF');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await submitTimesheet(formData);
      alert('Form submitted successfully!');
      setFormData(initialFormData);
      signatureRef.current?.clear();
    } catch {
      alert('Failed to submit form');
    }
  };

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
            value={formData.employeeName}
            onChange={(e) => setFormData(prev => ({ ...prev, employeeName: e.target.value }))}
          />
          <label className="user-label">Employee Name</label>
        </div>

        <div className="input-group">
          <input
            required
            type="text"
            className="input"
            value={formData.requestorName}
            onChange={(e) => setFormData(prev => ({ ...prev, requestorName: e.target.value }))}
          />
          <label className="user-label">Requestor Name</label>
        </div>

        <div className="input-group">
          <label className="user-label">Request Date</label>
          <DatePicker
            selected={formData.requestDate}
            onChange={(date) => setFormData(prev => ({ ...prev, requestDate: date }))}
            className="input"
            popperPlacement="bottom"
            shouldCloseOnSelect={true}
            open={isRequestDateOpen}
            onCalendarOpen={() => setIsRequestDateOpen(true)}
            onCalendarClose={() => setIsRequestDateOpen(false)}
          />
        </div>

        <div className="input-group">
          <label className="user-label">Service Week</label>
          <DatePicker
            selected={formData.serviceWeek.start ? new Date(formData.serviceWeek.start) : null}
            onChange={handleServiceWeekChange}
            className="input"
            popperPlacement="bottom"
            shouldCloseOnSelect={true}
            open={isServiceWeekOpen}
            onCalendarOpen={() => setIsServiceWeekOpen(true)}
            onCalendarClose={() => setIsServiceWeekOpen(false)}
          />
        </div>

        <div className="schedule-grid">
          <div className="grid-header">
            <span>Day</span>
            <span>Time</span>
            <span>Location</span>
          </div>

          {Object.keys(formData.schedule).map(day => (
            <div key={day} className="grid-row">
              <span className="day-label">{day}
                {formData.serviceWeek.start && <span className="day-date"> ({getDayDate(day)})</span>}
              </span>
              {formData.schedule[day].time === 'Type in' ? (
                <div style={{ width: '100%' }}>
                  <input
                    type="text"
                    placeholder="Enter custom time"
                    className="custom-time-input"
                    value={formData.schedule[day].customTime}
                    onChange={(e) => handleInputChange(day, 'customTime', e.target.value)}
                  />
                  {customTimeWarnings[day] && (
                    <div style={{ color: 'red', fontSize: '0.8rem' }}>
                      Please use format like "10:00-18:00"
                    </div>
                  )}
                </div>

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

        <div className="signature-section">
          <label>SK ME/SAMGOO Signature</label>
          <div className="signature-container">
            <SignaturePad
              ref={signatureRef}
              canvasProps={{ className: 'signature-pad' }}
            />
            <div className="signature-buttons">
              <button className="signature-button save-button" onClick={handleSaveSignature} type="button">Save Signature</button>
              <button className="signature-button clear-button" onClick={handleClearSignature} type="button">Clear Signature</button>
            </div>
          </div>
        </div>

        <div className="form-buttons">
          <button className="preview-button" type="button" onClick={handlePreview}>Preview</button>
          <button className="submit-button" type="submit">Submit</button>
        </div>
      </form>
    </div>
  );
};

export default WorkHoursForm;