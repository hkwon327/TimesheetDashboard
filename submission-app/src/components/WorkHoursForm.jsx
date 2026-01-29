import React, { useRef, useState } from "react";
import SignaturePad from "react-signature-pad-wrapper";
import DatePicker from "react-datepicker";
import Select from "react-select";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/WorkHoursForm.css";
import logo from "../assets/logo.png";

import { initialFormData, workingTimeOptions } from "../types/formSchema";
import { submitTimesheet } from "../api/submitForm";
import { generatePdfPreview } from "../api/generatePreview";

// ✅ constants (avoid re-create each render)
const LOCATION_OPTIONS = ["BOSK Trailer", "SAMKOO Trailer", "KY SK Trailer", "Off"];
const TIME_SELECT_OPTIONS = workingTimeOptions.map((v) => ({ value: v, label: v }));
const LOCATION_SELECT_OPTIONS = LOCATION_OPTIONS.map((v) => ({ value: v, label: v }));

// ✅ react-select styles
const SELECT_STYLES = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 13,
    borderColor: state.isFocused ? "rgba(0,184,94,0.9)" : "rgba(0,214,118,0.45)",
    boxShadow: state.isFocused
      ? "0 0 0 4px rgba(0,214,118,0.18)"
      : "0 6px 18px rgba(0,0,0,0.04)",
    ":hover": { borderColor: "rgba(0,184,94,0.9)" },
    backgroundColor: "#fff",
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px" }),
  placeholder: (base) => ({ ...base, color: "#9a9a9a", fontSize: 13 }),
  singleValue: (base) => ({ ...base, color: "#222", fontSize: 13 }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 18px 40px rgba(0,0,0,0.14)",
    zIndex: 99999,
    fontSize: 13,
  }),
  menuList: (base) => ({ ...base, padding: 6 }),
  option: (base, state) => ({
    ...base,
    borderRadius: 10,
    margin: "4px 0",
    padding: "9px 10px",
    fontSize: 13,
    backgroundColor: state.isSelected
      ? "rgba(0,214,118,0.16)"
      : state.isFocused
      ? "rgba(0,214,118,0.10)"
      : "transparent",
    color: "#222",
    cursor: "pointer",
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base, state) => ({
    ...base,
    padding: 6,
    transition: "transform 120ms ease",
    transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : "rotate(0deg)",
    color: "rgba(0,0,0,0.55)",
    ":hover": { color: "rgba(0,0,0,0.75)" },
  }),
};

const WorkHoursForm = () => {
  const signatureRef = useRef(null);

  const [formData, setFormData] = useState(initialFormData);

  // ✅ submit 눌렀을 때만 에러 보이게
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // ✅ 필드별 에러 저장
  const [errors, setErrors] = useState({});

  // -----------------------------
  // helpers
  // -----------------------------
  const handleInputChange = (day, field, value) => {
    setFormData((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: {
          ...prev.schedule[day],
          [field]: value,
        },
      },
    }));
  };

  const handleServiceWeekChange = (date) => {
    if (!date) {
      setFormData((prev) => ({
        ...prev,
        serviceWeek: { start: "", end: "" },
      }));
      return;
    }

    const selectedDate = new Date(date);
    const day = selectedDate.getDay();
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() - ((day + 6) % 7));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    setFormData((prev) => ({
      ...prev,
      serviceWeek: {
        start: monday.toISOString().split("T")[0],
        end: friday.toISOString().split("T")[0],
      },
    }));
  };

  const getDayDate = (day) => {
    if (!formData.serviceWeek.start) return "";
    const dayIndex = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].indexOf(day);
    const date = new Date(formData.serviceWeek.start);
    date.setDate(date.getDate() + dayIndex);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleSaveSignature = () => {
    if (signatureRef.current) {
      const signatureData = signatureRef.current.toDataURL();
      setFormData((prev) => ({ ...prev, signature: signatureData }));
      alert("Signature saved successfully");
    }
  };

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setFormData((prev) => ({ ...prev, signature: null }));
    }
  };

  // -----------------------------
  // ✅ validation (Submit only)
  // -----------------------------
  const validateForSubmit = () => {
    const nextErrors = {};

    // top fields
    if (!formData.employeeName?.trim()) nextErrors.employeeName = "Employee Name is required";
    if (!formData.requestorName?.trim()) nextErrors.requestorName = "Requestor Name is required";
    if (!formData.requestDate) nextErrors.requestDate = "Request Date is required";
    if (!formData.serviceWeek?.start) nextErrors.serviceWeek = "Service Week is required";

    // schedule fields
    Object.entries(formData.schedule).forEach(([day, row]) => {
      const base = `schedule.${day}`;

      // time required
      if (!row.time) {
        nextErrors[`${base}.time`] = "Working time is required";
      }

      // if "Type in" => customTime required + format check
      if (row.time === "Type in") {
        const val = (row.customTime || "").trim();
        if (!val) {
          nextErrors[`${base}.customTime`] = "Custom time is required";
        } else if (!/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(val)) {
          nextErrors[`${base}.customTime`] = 'Use format like "10:00-18:00"';
        }
      }

      // location required
      if (!row.location) {
        nextErrors[`${base}.location`] = "Location is required";
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const hasError = (key) => submitAttempted && Boolean(errors[key]);
  const getError = (key) => (submitAttempted ? errors[key] : "");

  // -----------------------------
  // Preview (no validation)
  // -----------------------------
  const handlePreview = async () => {
    const popup = window.open("", "_blank");
    if (!popup) {
      alert("Popup blocked. Please allow popups for this site.");
      return;
    }

    try {
      popup.document.write("<p style='font-family:sans-serif'>Generating preview...</p>");
    } catch {}

    try {
      const previewData = {
        employeeName: formData.employeeName || "",
        requestorName: formData.requestorName || "",
        requestDate: formData.requestDate?.toISOString().split("T")[0] || "",
        serviceWeek: formData.serviceWeek,
        schedule: Object.entries(formData.schedule).map(([day, data]) => ({
          day,
          date: getDayDate(day),
          time: data.time === "Type in" ? data.customTime : data.time,
          location: data.location || "",
        })),
        signature: formData.signature || "",
      };

      const previewUrl = await generatePdfPreview(previewData);
      if (!previewUrl || typeof previewUrl !== "string") {
        popup.close();
        throw new Error("Invalid preview URL returned from API");
      }
      popup.location.href = previewUrl;
    } catch (error) {
      console.error("Preview error:", error);
      try {
        popup.close();
      } catch {}
      alert(error?.message || "Failed to preview PDF");
    }
  };

  // -----------------------------
  // Submit (validation ON)
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitAttempted(true);

    const ok = validateForSubmit();
    if (!ok) return;

    try {
      await submitTimesheet(formData);
      alert("Form submitted successfully!");

      setFormData(initialFormData);
      signatureRef.current?.clear();

      setErrors({});
      setSubmitAttempted(false);
    } catch {
      alert("Failed to submit form");
    }
  };

  // helper to create select value object
  const asSelectValue = (value) => (value ? { value, label: value } : null);

  return (
    <div className="form-container">
      <div className="form-header">
        <h1>Service Hour Request Form</h1>

        <div className="form-subtitle">
          <p>
            * This form is for the purpose of requesting hourly interpretaion or <br />
            tranlsation services and for providing evidence of service provision.
          </p>
          <p>* This form can contain requests and evidence for one person on a maximum weekly basis.</p>
          <p>
            * If the service is provided on an emergency request basis, this document must be signed within
            <br /> 1 working day afterwards to servce as a basis for future settlemetns.
          </p>
          <p>
            * If you wish to substitute evidence of hourly interpretation and translation services provided with
            <br />a different form than this one, prior consultation wiht the BOSK interrpetation manager is required.
          </p>
        </div>

        <div className="logo-container">
          <img src={logo} alt="Moveret Logo" className="logo" />
          <span className="logo-text">M O V E R E T</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Employee Name */}
        <div className="input-group">
          <div className={`field-stack ${hasError("employeeName") ? "has-error" : ""}`}>
            <div className="field-label">Employee Name</div>
            <input
              type="text"
              className="input"
              value={formData.employeeName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, employeeName: e.target.value }))
              }
              placeholder="Type employee name"
            />
            {hasError("employeeName") && <div className="error-text">{getError("employeeName")}</div>}
          </div>
        </div>

        {/* Requestor Name */}
        <div className="input-group">
          <div className={`field-stack ${hasError("requestorName") ? "has-error" : ""}`}>
            <div className="field-label">Requestor Name</div>
            <input
              type="text"
              className="input"
              value={formData.requestorName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, requestorName: e.target.value }))
              }
              placeholder="Type requestor name"
            />
            {hasError("requestorName") && <div className="error-text">{getError("requestorName")}</div>}
          </div>
        </div>

        {/* Request Date */}
        <div className="input-group">
          <div className={`field-stack ${hasError("requestDate") ? "has-error" : ""}`}>
            <div className="field-label">Request Date</div>
            <DatePicker
              selected={formData.requestDate}
              onChange={(date) => setFormData((prev) => ({ ...prev, requestDate: date }))}
              className="input"
              placeholderText="Select request date"
              popperPlacement="bottom-start"
            />
            {hasError("requestDate") && <div className="error-text">{getError("requestDate")}</div>}
          </div>
        </div>

        {/* Service Week */}
        <div className="input-group">
          <div className={`field-stack ${hasError("serviceWeek") ? "has-error" : ""}`}>
            <div className="field-label">Service Week</div>
            <DatePicker
              selected={formData.serviceWeek.start ? new Date(formData.serviceWeek.start) : null}
              onChange={handleServiceWeekChange}
              className="input"
              placeholderText="Pick any day in the week"
              popperPlacement="bottom-start"
            />
            {hasError("serviceWeek") && <div className="error-text">{getError("serviceWeek")}</div>}
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="schedule-grid">
          <div className="grid-header">
            <span>Day</span>
            <span>Time</span>
            <span>Location</span>
          </div>

          {Object.keys(formData.schedule).map((day) => {
            const row = formData.schedule[day];
            const base = `schedule.${day}`;

            const timeKey = `${base}.time`;
            const locKey = `${base}.location`;
            const customKey = `${base}.customTime`;

            return (
              <div key={day} className="grid-row">
                <span className="day-label">
                  {day}
                  {formData.serviceWeek.start && <span className="day-date"> ({getDayDate(day)})</span>}
                </span>

                {/* Time */}
                <div className="grid-field">
                  {row.time === "Type in" ? (
                    <div className={`grid-field ${hasError(customKey) ? "has-error" : ""}`}>
                      <input
                        type="text"
                        placeholder='e.g. 10:00-18:00'
                        className="custom-time-input"
                        value={row.customTime}
                        onChange={(e) => handleInputChange(day, "customTime", e.target.value)}
                      />
                      {hasError(customKey) && <div className="error-text">{getError(customKey)}</div>}
                    </div>
                  ) : (
                    <div className={`grid-field ${hasError(timeKey) ? "has-error" : ""}`}>
                      <Select
                        classNamePrefix="react-select"
                        menuPortalTarget={document.body}
                        styles={SELECT_STYLES}
                        placeholder="Select working time"
                        options={TIME_SELECT_OPTIONS}
                        value={asSelectValue(row.time)}
                        onChange={(opt) => handleInputChange(day, "time", opt?.value || "")}
                        isSearchable={false}
                      />
                      {hasError(timeKey) && <div className="error-text">{getError(timeKey)}</div>}
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className={`grid-field ${hasError(locKey) ? "has-error" : ""}`}>
                  <Select
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                    styles={SELECT_STYLES}
                    placeholder="Select location"
                    options={LOCATION_SELECT_OPTIONS}
                    value={asSelectValue(row.location)}
                    onChange={(opt) => handleInputChange(day, "location", opt?.value || "")}
                    isSearchable={false}
                  />
                  {hasError(locKey) && <div className="error-text">{getError(locKey)}</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Signature */}
        <div className="signature-section">
          <div className="signature-header">
            <div className="signature-title">SK ME/SAMGOO Signature</div>
            <div className="signature-hint">Save after signing</div>
          </div>

          <div className="signature-container">
            <SignaturePad ref={signatureRef} canvasProps={{ className: "signature-pad" }} />
            <div className="signature-buttons">
              <button
                className="signature-button save-button"
                onClick={handleSaveSignature}
                type="button"
              >
                Save
              </button>
              <button
                className="signature-button clear-button"
                onClick={handleClearSignature}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="form-buttons">
          <button className="preview-button" type="button" onClick={handlePreview}>
            <span className="text">Preview</span>
          </button>
          <button className="submit-button" type="submit">
            <span className="text">Submit</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default WorkHoursForm;
