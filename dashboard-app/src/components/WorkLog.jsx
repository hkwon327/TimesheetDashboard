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
import TabRegion from "./TabRegion";

ChartJS.register(BarElement, CategoryScale, LinearScale);

// 시간 문자열을 시/분 단위로 변환하는 함수
function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [time, meridiem] = timeStr.trim().split(' ');
  let [hour, minute] = time.split(':').map(Number);
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour + (minute / 60);
}

// "8:00 AM - 5:00 PM" → 9
function getWorkHours(timeRange) {
  if (!timeRange) return 0;
  const [start, end] = timeRange.split('-').map(s => s.trim());
  if (!start || !end) return 0;
  const startHour = parseTime(start);
  const endHour = parseTime(end);
  // 자정을 넘는 경우
  if (endHour < startHour) {
    return (endHour + 24) - startHour;
  }
  return endHour - startHour;
}


const WorkLog = ({ selectedFormId }) => {
  const { formId: paramFormId } = useParams();
  const storedFormId = localStorage.getItem("lastFormId");
  const formId = paramFormId || selectedFormId || storedFormId;

  const [formInfo, setFormInfo] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [activeTab, setActiveTab] = useState("Tennessee");

  useEffect(() => {
    if (!formId) return;

    // 1. Form 데이터 로드
    axios
      .get(`http://52.91.22.196:8000/form/${formId}`)
      .then((res) => {
        setFormInfo(res.data.form);
        setSchedule(res.data.schedule);

        // 2. PDF Presigned URL 요청 (pdf_filename 사용)
        const filename = res.data.form?.pdf_filename;
        if (filename) {
          axios
            .get(`http://52.91.22.196:8000/form-pdf-url/${filename}`)
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
        data: schedule.map(item => Math.abs(getWorkHours(item.time))),
        backgroundColor: "#B3B3B3",
        barThickness: 50,
        borderRadius: 10
      }
    ]
  };

  const totalHours = schedule.reduce((sum, item) => sum + Math.abs(getWorkHours(item.time)), 0);
  const missedDays = schedule.filter(item => Math.abs(getWorkHours(item.time)) === 0).length;

  const options = {
    scales: {
      y: { beginAtZero: true, max: 10 }
    },
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false }
    },
    hover: { mode: null },
    events: [] // completely disables all mouse events (including hover)
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
      <TabRegion activeRegion={activeTab} onRegionChange={setActiveTab} />

      <div className="detail-section">
        {/* 왼쪽: 상세 정보 + 요약 */}
        <div className="left-section">
          <div className="work-details">
            <h3>Detailed Work Hours</h3>
            <div className="header-row">
              <span>{formInfo.employee_name}</span>
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
                <p>
                  <strong>Total Hours:</strong> {totalHours} hrs &nbsp;  &nbsp;
                  <strong>Missed Day:</strong> {missedDays} days &nbsp;  &nbsp; 
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: PDF 미리보기 */}
        <div className="timesheet-preview">
          <h3>Submitted Timesheet</h3>
          <div className="empty-preview">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                width="100%"
                height="830px"
                title="Submitted Timesheet"
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
