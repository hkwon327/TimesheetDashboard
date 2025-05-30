import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

const Dashboard = () => {
  const [forms, setForms] = useState([]);
  const [selected, setSelected] = useState([]);
  const [activeTab, setActiveTab] = useState("Tennessee");
  const [activeStatusTab, setActiveStatusTab] = useState("pending");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get("http://localhost:8000/forms")
      .then((res) => setForms(res.data))
      .catch((err) => console.error("Error fetching forms:", err));
  }, []);

  const pendingCount = forms.filter(f => f.status === "pending").length;
  const approvedCount = forms.filter(f => f.status === "approved").length;
  const confirmedCount = forms.filter(f => f.status === "confirmed").length;

  const handleTabClick = (tab) => setActiveTab(tab);

  const toggleSelect = (index) => {
    setSelected((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const handleRowClick = (formId) => {
    localStorage.setItem("lastFormId", formId);
    navigate(`/worklog/${formId}`);
  };

  return (
    <div className="dashboard">
      <div className="tabs">
        {["Tennessee", "Kentucky"].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => handleTabClick(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 상태 카드 + 탭 기능 */}
      <div className="status-cards">
        <div
          className={`card pending ${activeStatusTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveStatusTab("pending")}
        >
          Pending {pendingCount}
        </div>
        <div
          className={`card approved ${activeStatusTab === "approved" ? "active" : ""}`}
          onClick={() => setActiveStatusTab("approved")}
        >
          Approved {approvedCount}
        </div>
        <div
          className={`card confirmed ${activeStatusTab === "confirmed" ? "active" : ""}`}
          onClick={() => setActiveStatusTab("confirmed")}
        >
          Confirmed {confirmedCount}
        </div>
        <div className="card total">
          Total Employees {forms.length}
        </div>
      </div>

      <div className="table-section">
        <div className="table-header">
          <span>{activeStatusTab.charAt(0).toUpperCase() + activeStatusTab.slice(1)}</span>
          <span
            className="select-all"
            onClick={() => {
              if (selected.length === forms.length) {
                setSelected([]);
              } else {
                setSelected(forms.map((_, i) => i));
              }
            }}
          >
            {selected.length === forms.length ? "Unselect All" : "Select All"}
          </span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Employee Name</th>
              <th>Requestor Name</th>
              <th>Request Date</th>
              <th>Service Week</th>
              <th>Total Hours</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>
            {forms
              .filter((form) => form.status === activeStatusTab)
              .map((form, index) => (
                <tr key={form.id} onClick={() => handleRowClick(form.id)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(index)}
                      onChange={() => toggleSelect(index)}
                    />
                  </td>
                  <td>{form.employee_name}</td>
                  <td>{form.requestor_name}</td>
                  <td>{form.request_date?.slice(0, 10)}</td>
                  <td>
                    {form.service_week_start?.slice(0, 10)} ~{" "}
                    {form.service_week_end?.slice(0, 10)}
                  </td>
                  <td>{form.total_hours || 0}</td>
                  <td>{form.signature?.startsWith("data:image/") ? "InValid" : "Valid"}</td>
                </tr>
              ))}
          </tbody>
        </table>

        <div className="pagination">
          <button>{"<"}</button>
          <button className="active">1</button>
          <button>2</button>
          <button>3</button>
          <button>{">"}</button>
        </div>
      </div>

      <div className="action-buttons">
        <button className="delete">Delete</button>
        <button className="approve">Approve</button>
        <button className="send">Send</button>
      </div>
    </div>
  );
};

export default Dashboard;
