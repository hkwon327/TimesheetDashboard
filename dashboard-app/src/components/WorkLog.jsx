import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale
} from "chart.js";
import "./WorkLog.css";

ChartJS.register(BarElement, CategoryScale, LinearScale);

const WorkLog = ({ selectedFormId }) => {
  const { formId: paramFormId } = useParams();
  const storedFormId = localStorage.getItem("lastFormId");
  const formId = paramFormId || selectedFormId || storedFormId;

  const [formInfo, setFormInfo] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    if (!formId) return;

    // 1. Form 데이터 로드
    axios
      .get(`http://localhost:8000/form/${formId}`)
      .then((res) => {
        setFormInfo(res.data.form);
        setSchedule(res.data.schedule);

        // 2. PDF Presigned URL 요청 (pdf_filename 사용)
        const filename = res.data.form?.pdf_filename;
        if (filename) {
          axios
            .get(`http://localhost:8000/form-pdf-url/${filename}`)
            .then((res) => {
              setPdfUrl(res.data.url);
            })
            .catch((err) => console.error("Error loading PDF URL:", err));
        }
      })
      .catch((err) => console.error("Error loading worklog:", err));
  }, [formId]);

  const data = {
    labels: schedule.map((s) => s.day?.split("/")[1]?.split(/[()]/)[0]),
    datasets: [
      {
        label: "Hours",
        data: schedule.map(() => 8),
        backgroundColor: "#3D4DF3"
      }
    ]
  };

  const options = {
    scales: {
      y: { beginAtZero: true, max: 10 }
    }
  };

  if (!formId) {
    return (
      <div className="worklog-container">
        <h3>Detailed Work Hours</h3>
        <p style={{ marginTop: "20px" }}>No selected data yet.</p>
      </div>
    );
  }

  if (!formInfo) {
    return (
      <div className="worklog-container">
        <h3>Detailed Work Hours</h3>
        <p style={{ marginTop: "20px" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="worklog-container">
      <div className="tabs">
        <button className="active">🏠 Tennessee</button>
        <button>🏠 Kentucky</button>
      </div>

      <div className="detail-section">
        {/* 왼쪽: 상세 정보 + 요약 */}
        <div className="left-section">
          <div className="work-details">
            <h3>Detailed Work Hours</h3>
            <div className="header-row">
              <span>{formInfo.employee_name}</span>
              <span>{formInfo.request_date?.slice(0, 10)}</span>
              <span>{formInfo.status}</span>
            </div>
            <table>
              <tbody>
                {schedule.map((item, i) => (
                  <tr key={i}>
                    <td>{item.day}</td>
                    <td>{item.time}</td>
                    <td>{item.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="summary-section">
            <h3>Summary</h3>
            <div className="summary-box">
              <div className="chart-box">
                <Bar data={data} options={options} />
              </div>
              <div className="summary-text">
                <p><strong>Total Hours:</strong> {schedule.length * 8} hrs</p>
                <p><strong>Missed Day:</strong> 0 days</p>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: PDF 미리보기 */}
        <div className="timesheet-preview">
          <h3>View Submitted Timesheet</h3>
          <div className="empty-preview">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                width="100%"
                height="600px"
                title="PDF Preview"
              />
            ) : (
              <p>Loading PDF preview...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkLog;
