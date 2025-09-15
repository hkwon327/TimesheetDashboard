import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";
import "./WorkLog.css";


ChartJS.register(BarElement, CategoryScale, LinearScale);

/** 시간 문자열을 시/분 단위로 변환 */
function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [time, meridiem] = timeStr.trim().split(" ");
  let [hour, minute] = time.split(":").map(Number);
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour + ((minute || 0) / 60); // minute 기본값 처리
}

/** "8:00 AM - 5:00 PM" → 9 */
function getWorkHours(timeRange) {
  if (!timeRange) return 0;
  const [start, end] = timeRange.split("-").map((s) => s.trim());
  if (!start || !end) return 0;
  const startHour = parseTime(start);
  const endHour = parseTime(end);
  return endHour < startHour ? endHour + 24 - startHour : endHour - startHour;
}

// S3 PDF 키 프리픽스
const PDF_PREFIX = "work-hours-forms/";

const WorkLog = ({ selectedFormId }) => {
  const { formId: paramFormId } = useParams();

  // localStorage 값 처리
  const storedFormId = (() => {
    const v = localStorage.getItem("lastFormId");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : v;
  })();

  const formId = paramFormId || selectedFormId || storedFormId;

  const [formInfo, setFormInfo] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [activeTab, setActiveTab] = useState("Tennessee");

  // 에러/로딩 상태 분리
  const [formError, setFormError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // 언마운트 안전 setter
  const safeSetFactory = () => {
    let alive = true;
    const wrap = (setter) => (...args) => {
      if (alive) setter(...args);
    };
    return { wrap, dispose: () => (alive = false) };
  };

  // PDF URL 로드 함수
  const loadPdfUrl = async (filename, safeSet) => {
    console.log(`[PDF] Starting loadPdfUrl with filename: "${filename}"`);
    
    safeSet(setPdfLoading)(true);
    safeSet(setPdfError)("");
    safeSet(setPdfUrl)(null);

    try {
      // 기본 패턴들 생성
      const basePatterns = [
        filename,                           // 원본: "Hannah_Kwon_13.pdf"
        filename.replace(/_/g, ' '),        // "Hannah Kwon 13.pdf"
        filename.replace(/ /g, '_'),        // "Hannah_Kwon_13.pdf" (같을 수도 있음)
      ].filter(Boolean);

      // 프리픽스가 없는 패턴들과 프리픽스가 있는 패턴들 모두 포함
      const candidates = [
        ...basePatterns,                                          // 프리픽스 없는 원본들
        ...basePatterns.map(name => `${PDF_PREFIX}${name}`),      // 프리픽스 추가
      ];

      // 중복 제거
      const uniqueCandidates = [...new Set(candidates)];
      
      console.log(`[PDF] Generated ${uniqueCandidates.length} candidates:`, uniqueCandidates);

      let success = false;
      let lastError = null;

      for (const candidate of uniqueCandidates) {
        try {
          console.log(`[PDF] 🔄 Trying: "${candidate}"`);
          
          // URL 인코딩하여 요청
          const encodedCandidate = encodeURIComponent(candidate);
          const response = await api.get(`/form-pdf-url/${encodedCandidate}`);
          
          console.log(`[PDF] ✅ SUCCESS with: "${candidate}"`);
          safeSet(setPdfUrl)(response.data.url);
          success = true;
          break;
          
        } catch (err) {
          lastError = err;
          if (err.response?.status === 404) {
            console.warn(`[PDF] ❌ 404 for: "${candidate}"`);
            continue; // 다음 후보 시도
          } else {
            // 404가 아닌 에러는 즉시 중단
            console.error(`[PDF] 💥 Non-404 error for "${candidate}":`, err.response?.status, err.message);
            throw err;
          }
        }
      }

      if (!success) {
        const errorMsg = lastError?.response?.status === 404
          ? `PDF 파일을 찾을 수 없습니다: ${filename}`
          : "PDF 로딩 중 오류가 발생했습니다.";
        
        console.error(`[PDF] ❌ All ${uniqueCandidates.length} candidates failed. Last error:`, lastError?.message);
        safeSet(setPdfError)(errorMsg);
      }

    } catch (err) {
      console.error("[PDF] Unexpected error:", err);
      const errorMsg = err.response?.status === 404
        ? `PDF 파일을 찾을 수 없습니다: ${filename}`
        : err.response?.status >= 500
        ? "서버 오류로 PDF를 로딩할 수 없습니다."
        : "PDF 로딩 중 오류가 발생했습니다.";
      
      safeSet(setPdfError)(errorMsg);
    } finally {
      safeSet(setPdfLoading)(false);
    }
  };

  // Form 데이터 로드
  const loadFormData = async (formId, safeSet) => {
    console.log(`[FORM] Loading form data for ID: ${formId}`);
    
    try {
      safeSet(setFormError)("");
      const res = await api.get(`/form/${formId}`);
      
      console.log(`[FORM] ✅ Form data loaded successfully`);
      safeSet(setFormInfo)(res.data.form);
      safeSet(setSchedule)(res.data.schedule || []);

      const filename = res.data.form?.pdf_filename;
      if (filename) {
        console.log(`[FORM] PDF filename from DB: "${filename}"`);
        loadPdfUrl(filename, safeSet);
      } else {
        console.warn(`[FORM] No pdf_filename in form data`);
        safeSet(setPdfError)("PDF 파일명이 없습니다.");
      }
    } catch (err) {
      console.error("[FORM] Error loading form data:", err);
      safeSet(setFormError)("Failed to load work log details.");
    }
  };

  // PDF 재시도
  const retryPdfLoad = () => {
    if (formInfo?.pdf_filename) {
      console.log(`[PDF] Retrying PDF load for: "${formInfo.pdf_filename}"`);
      const { wrap } = safeSetFactory();
      loadPdfUrl(formInfo.pdf_filename, wrap);
    } else {
      console.warn(`[PDF] Cannot retry - no pdf_filename available`);
    }
  };

  useEffect(() => {
    if (!formId) return;

    console.log(`[EFFECT] Starting data load for formId: ${formId}`);

    // 언마운트 가드 설정
    const guard = safeSetFactory();
    const safeSet = guard.wrap;

    // 상태 초기화
    safeSet(setFormError)("");
    safeSet(setPdfError)("");
    safeSet(setPdfUrl)(null);
    safeSet(setFormInfo)(null);
    safeSet(setSchedule)([]);

    // Form 데이터 로드
    loadFormData(formId, safeSet);

    return () => {
      console.log(`[EFFECT] Cleaning up for formId: ${formId}`);
      guard.dispose();
    };
  }, [formId]);

  // 차트 데이터
  const data = {
    labels: schedule.map((s) => s.day?.split("/")[1]?.split(/[()]/)[0]),
    datasets: [
      {
        label: "Hours",
        data: schedule.map((item) => Math.abs(getWorkHours(item.time))),
        backgroundColor: "#B3B3B3",
        barThickness: 50,
        borderRadius: 10,
      },
    ],
  };

  const totalHours = schedule.reduce(
    (sum, item) => sum + Math.abs(getWorkHours(item.time)),
    0
  );
  const missedDays = schedule.filter(
    (item) => Math.abs(getWorkHours(item.time)) === 0
  ).length;

  const options = {
    scales: {
      y: { beginAtZero: true, max: 10 },
    },
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false },
    },
    hover: { mode: null },
    events: [],
  };

  if (!formId) {
    return (
      <div className="worklog-container">
        <h3>Detailed Work Hours</h3>
        <p style={{ marginTop: "20px" }}>No selected data yet.</p>
      </div>
    );
  }

  if (!formInfo && !formError) {
    return (
      <div className="worklog-container">
        <h3>Detailed Work Hours</h3>
        <p style={{ marginTop: "20px" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="worklog-container">

      <div className="detail-section">
        {/* 왼쪽: 상세 정보 + 요약 */}
        <div className="left-section">
          <div className="work-details">
            <h3>Detailed Work Hours</h3>
            {formError ? (
              <div className="error-container">
                <p className="error-text">{formError}</p>
                <button
                  onClick={() => {
                    const { wrap } = safeSetFactory();
                    loadFormData(formId, wrap);
                  }}
                  className="retry-button"
                >
                  다시 시도
                </button>
              </div>
            ) : (
              <>
                <div className="header-row">
                  <span>{formInfo?.employee_name}</span>
                  <span>{formInfo?.status}</span>
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
              </>
            )}
          </div>

          {formInfo && !formError && (
            <div className="summary-section">
              <h3>Summary</h3>
              <div className="summary-box">
                <div className="chart-box">
                  <Bar data={data} options={options} />
                </div>
                <div className="summary-text">
                  <p>
                    <strong>Total Hours:</strong> {totalHours} hrs &nbsp;&nbsp;
                    <strong>Missed Day:</strong> {missedDays} days
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: PDF 미리보기 */}
        <div className="timesheet-preview">
          <h3>Submitted Timesheet</h3>
          <div className="empty-preview">
            {pdfLoading ? (
              <div className="pdf-loading">
                <p>loading PDF...</p>
              </div>
            ) : pdfError ? (
              <div className="pdf-error">
                <p className="error-text">{pdfError}</p>
                <button
                  onClick={retryPdfLoad}
                  className="retry-button"
                  style={{ marginTop: "10px" }}
                >
                  PDF 다시 로드
                </button>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={`${pdfUrl}#zoom=page-fit`}
                width="100%"
                height="100%"
                title="Submitted Timesheet"
                onError={() => setPdfError("PDF is not available.")}
              />
            ) : formInfo ? (
              <p>PDF가 없습니다.</p>
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
