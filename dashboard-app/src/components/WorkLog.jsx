import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import "./WorkLog.css";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/** -------------------------
 * Status mapping (pending/approved/sent/deleted)
 * ------------------------- */
const normalizeStatus = (s) => {
  const v = String(s || "").trim().toLowerCase();
  if (v === "pending") return "pending";
  if (v === "approved") return "approved";
  if (v === "sent") return "sent";
  if (v === "deleted") return "deleted";
  return v || "pending";
};

const prettyStatus = (s) => {
  const v = normalizeStatus(s);
  if (v === "pending") return "Pending";
  if (v === "approved") return "Approved";
  if (v === "sent") return "Sent";
  if (v === "deleted") return "Deleted";
  return v ? String(v) : "-";
};

const statusUiClass = (s) => {
  const v = normalizeStatus(s);
  if (v === "pending") return "isPending";
  if (v === "approved" || v === "sent") return "isApproved";
  if (v === "deleted") return "isDeleted";
  return "isPending";
};

/** -------------------------
 * Date helpers
 * ------------------------- */
function fmtMD(val) {
  if (!val) return "-";
  const s = String(val);
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    return `${s.slice(5, 7)}/${s.slice(8, 10)}`;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

const DAY_INDEX = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function parseISODateOnly(val) {
  if (!val) return null;
  const s = String(val).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dayToIndex(dayStr) {
  const raw = String(dayStr || "").trim().toLowerCase();
  if (!raw) return null;

  const alpha = raw.replace(/[^a-z]/g, "");
  if (alpha && DAY_INDEX[alpha] !== undefined) return DAY_INDEX[alpha];

  const tokens = raw.split(/\s+/);
  const last = tokens[tokens.length - 1]?.replace(/[^a-z]/g, "");
  if (last && DAY_INDEX[last] !== undefined) return DAY_INDEX[last];

  return null;
}

/** "01/07/Tues" */
function buildDayWithDate(dayStr, serviceWeekStart) {
  const start = parseISODateOnly(serviceWeekStart);
  const idx = dayToIndex(dayStr);
  const shortNames = ["Sun", "Mon", "Tues", "Wed", "Thurs", "Fri", "Sat"];

  if (!start || idx === null) {
    const raw = String(dayStr || "-").trim() || "-";
    const fallbackIdx = dayToIndex(raw);
    return fallbackIdx === null ? raw : shortNames[fallbackIdx];
  }

  const startIdx = start.getDay();
  let offset = idx - startIdx;
  if (offset < 0) offset += 7;

  const target = addDays(start, offset);
  const md = fmtMD(target.toISOString().slice(0, 10));
  return `${md}/${shortNames[idx]}`;
}

/** -------------------------
 * Time parsing
 * ------------------------- */
function parseTime(timeStr) {
  if (!timeStr) return NaN;

  const s0 = String(timeStr).trim();
  if (!s0) return NaN;

  const s = s0.replace(/\s+/g, " ").trim();
  const upper = s.toUpperCase();

  // ✅ 12-hour with AM/PM: "1:30 PM", "1 PM", "01:30PM"
  const ampmMatch = upper.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    let minute = Number(ampmMatch[2] || "0");
    const mer = ampmMatch[3];

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return NaN;

    if (mer === "PM" && hour !== 12) hour += 12;
    if (mer === "AM" && hour === 12) hour = 0;

    return hour + minute / 60;
  }

  // ✅ 24-hour: "13:00", "9:05"
  const h24Match = upper.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hour = Number(h24Match[1]);
    const minute = Number(h24Match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return NaN;
    return hour + minute / 60;
  }

  return NaN;
}

function getWorkHours(timeRange) {
  if (!timeRange) return 0;

  const raw = String(timeRange).trim();
  if (!raw) return 0;

  // ✅ "-" / "–" / "—" / "~" 모두 지원 + 주변 공백 무시
  const parts = raw.split(/\s*(?:-|–|—|~)\s*/);
  if (parts.length < 2) return 0;

  const start = parts[0]?.trim();
  const end = parts.slice(1).join("-").trim();
  if (!start || !end) return 0;

  const startHour = parseTime(start);
  const endHour = parseTime(end);

  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return 0;

  const diff = endHour < startHour ? endHour + 24 - startHour : endHour - startHour;
  if (!Number.isFinite(diff) || diff < 0) return 0;

  return diff;
}

function formatClock12hFromHourFloat(h) {
  if (!Number.isFinite(h)) return "";
  const totalMinutes = Math.round(h * 60);
  let hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;

  const mer = hour >= 12 ? "PM" : "AM";
  let hh = hour % 12;
  if (hh === 0) hh = 12;

  return `${hh}:${String(minute).padStart(2, "0")} ${mer}`;
}

function formatTimeRangeDisplay(timeRange) {
  if (!timeRange) return "-";
  const raw = String(timeRange).trim();
  if (!raw) return "-";

  const parts = raw.split(/\s*(?:-|–|—|~)\s*/);
  if (parts.length < 2) return raw;

  const startStr = parts[0]?.trim();
  const endStr = parts.slice(1).join("-").trim();
  if (!startStr || !endStr) return raw;

  const s = parseTime(startStr);
  const e = parseTime(endStr);

  if (Number.isFinite(s) && Number.isFinite(e)) {
    return `${formatClock12hFromHourFloat(s)} - ${formatClock12hFromHourFloat(e)}`;
  }

  return `${startStr} - ${endStr}`;
}

const WorkLog = ({ selectedFormId }) => {
  const { formId: paramFormId } = useParams();

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

  const [formError, setFormError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [loading, setLoading] = useState(true);

  // ✅ status 변경용
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const safeSetFactory = () => {
    let alive = true;
    const wrap = (setter) => (...args) => {
      if (alive) setter(...args);
    };
    return { wrap, dispose: () => (alive = false) };
  };

  const loadSubmission = async (id, safeSet) => {
    safeSet(setLoading)(true);
    safeSet(setFormError)("");
    safeSet(setPdfError)("");
    safeSet(setActionError)("");
    safeSet(setPdfUrl)(null);
    safeSet(setFormInfo)(null);
    safeSet(setSchedule)([]);

    try {
      const res = await api.get(`/submission/${id}`, { params: { includeUrl: 1 } });

      const form = res.data?.form || null;
      const sch = Array.isArray(res.data?.schedule) ? res.data.schedule : [];
      const url = res.data?.previewUrl || null;

      const normalizedForm = form ? { ...form, status: normalizeStatus(form.status) } : null;

      safeSet(setFormInfo)(normalizedForm);
      safeSet(setSchedule)(sch);
      safeSet(setPdfUrl)(url || null);
    } catch (err) {
      console.error("[WorkLog] loadSubmission error:", err);
      safeSet(setFormError)("Failed to load work log details.");
    } finally {
      safeSet(setLoading)(false);
    }
  };

  const retry = () => {
    if (!formId) return;
    const guard = safeSetFactory();
    loadSubmission(formId, guard.wrap);
  };

  useEffect(() => {
    if (!formId) return;
    const guard = safeSetFactory();
    loadSubmission(formId, guard.wrap);
    return () => guard.dispose();
  }, [formId]);

  /** ✅ 백엔드에 맞춘 status 변경 API
   *  PATCH /submission/{id}/status
   *  body: { status: "approved" | "sent" | "deleted" }
   */
  const updateStatus = async (nextStatus) => {
    if (!formId) return;
    if (actionLoading) return;

    const desired = normalizeStatus(nextStatus);
    const prevStatus = normalizeStatus(formInfo?.status);

    setActionError("");
    setActionLoading(true);

    // optimistic UI
    setFormInfo((prev) => (prev ? { ...prev, status: desired } : prev));

    try {
      await api.patch(`/submission/${formId}/status`, { status: desired });

      // 서버값으로 동기화 (DB 반영 확인)
      const guard = safeSetFactory();
      await loadSubmission(formId, guard.wrap);
      guard.dispose();
    } catch (err) {
      console.error("[WorkLog] updateStatus error:", err);
      // 실패 시 원복
      setFormInfo((prev) => (prev ? { ...prev, status: prevStatus } : prev));

      const msg =
        err?.response?.data?.error ||
        err?.message ||
        `Failed to set status to "${desired}".`;
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  /** totals */
  const computedTotalHours = useMemo(() => {
    return schedule.reduce((sum, item) => sum + Math.abs(getWorkHours(item.time)), 0);
  }, [schedule]);

  const totalHours = useMemo(() => {
    const v = formInfo?.total_hours;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    return computedTotalHours;
  }, [formInfo, computedTotalHours]);

  const missedDays = useMemo(() => {
    return schedule.filter((item) => Math.abs(getWorkHours(item.time)) === 0).length;
  }, [schedule]);

  /** schedule with date + sort */
  const scheduleWithDates = useMemo(() => {
    const start = formInfo?.service_week_start;

    const withDates = schedule.map((it) => {
      const dayWithDate = buildDayWithDate(it.day, start);
      return { ...it, dayWithDate };
    });

    const toKey = (s) => {
      const v = String(s || "");
      const md = v.split("/").slice(0, 2).join("/");
      const [mm, dd] = md.split("/").map(Number);
      if (!Number.isFinite(mm) || !Number.isFinite(dd)) return 999999;
      return mm * 100 + dd;
    };

    return withDates.sort((a, b) => toKey(a.dayWithDate) - toKey(b.dayWithDate));
  }, [schedule, formInfo?.service_week_start]);

  /** chart */
  const chartData = useMemo(() => {
    const labels = scheduleWithDates.map((s) => s.dayWithDate || "-");
    const values = scheduleWithDates.map((item) => {
      const h = Math.abs(getWorkHours(item.time));
      return Number.isFinite(h) ? h : 0;
    });

    return {
      labels,
      datasets: [
        {
          label: "Hours",
          data: values,
          backgroundColor: "rgba(37, 99, 235, 0.22)",
          borderColor: "rgba(37, 99, 235, 0.55)",
          borderWidth: 1,
          borderRadius: 10,
          barThickness: 40,
        },
      ],
    };
  }, [scheduleWithDates]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 10,
          ticks: { precision: 0 },
          grid: { color: "rgba(15, 23, 42, 0.06)" },
        },
        x: { grid: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
    };
  }, []);

  if (!formId) {
    return (
      <div className="wl">
        <div className="wl-card">
          <div className="wl-title">Work Log</div>
          <div className="wl-muted" style={{ marginTop: 8 }}>
            No selected data yet.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wl">
        <div className="wl-grid">
          <div className="wl-card wl-skel">
            <div className="wl-skelLine w40" />
            <div className="wl-skelLine w25" />
            <div className="wl-skelBlock" />
          </div>
          <div className="wl-card wl-skel">
            <div className="wl-skelLine w35" />
            <div className="wl-skelBlock" />
          </div>
        </div>
      </div>
    );
  }

  if (formError) {
    return (
      <div className="wl">
        <div className="wl-card">
          <div className="wl-title">Work Log</div>
          <div className="wl-error">{formError}</div>
          <button className="wl-btn" onClick={retry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const st = normalizeStatus(formInfo?.status);
  const stPretty = prettyStatus(st);
  const stClass = statusUiClass(st);

  // ✅ 버튼 정책
  const canApprove = st === "pending";
  const canSend = st === "approved";
  const canDelete = st !== "deleted";

  return (
    <div className="wl">
      {/* Header */}
      <div className="wl-header wl-headerAdmin">
        <div className="wl-headerLeft">
          <div className="wl-titleRow">
            <div className="wl-title">Detailed Work Hours</div>
          </div>

          <div className="wl-sub">Review schedule details and view the submitted PDF.</div>

          {/* ✅ Employee + Status + Actions in SAME ROW */}
          <div className="wl-adminMeta">
            <div className="wl-emp wl-empRow">
              <div className="wl-empLeft">
                <span className="wl-empLabel">Employee</span>
                <span className="wl-empName">{formInfo?.employee_name || "-"}</span>

                <span className={`wl-statusTag ${stClass}`}>
                  <span className="wl-statusDot" />
                  {stPretty}
                </span>
              </div>

              <div className="wl-actions wl-actionsInline">
                <button
                  type="button"
                  className="wl-btn wl-btnApprove"
                  onClick={() => updateStatus("approved")}
                  disabled={!canApprove || actionLoading}
                  title="Approve (DB status -> approved)"
                >
                  Approve
                </button>

                <button
                  type="button"
                  className="wl-btn wl-btnSend"
                  onClick={() => updateStatus("sent")}
                  disabled={!canSend || actionLoading}
                  title="Send (DB status -> sent)"
                >
                  Send
                </button>

                <button
                  type="button"
                  className="wl-btn wl-btnDelete"
                  onClick={() => updateStatus("deleted")}
                  disabled={!canDelete || actionLoading}
                  title="Delete (DB status -> deleted)"
                >
                  Delete
                </button>
              </div>
            </div>

            {actionError && (
              <div className="wl-error" style={{ marginTop: 10 }}>
                {actionError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="wl-grid">
        {/* Left column */}
        <div className="wl-col">
          {/* Schedule */}
          <div className="wl-card">
            <div className="wl-cardHeader wl-cardHeaderTight">
              <div className="wl-cardTitle">Schedule</div>

              <div className="wl-cardMeta">
                <span className="wl-meta">
                  Request on<b>{fmtMD(formInfo?.request_date)}</b>
                </span>
                <span className="wl-meta">
                  Week{" "}
                  <b>
                    {fmtMD(formInfo?.service_week_start)} – {fmtMD(formInfo?.service_week_end)}
                  </b>
                </span>
              </div>
            </div>

            <div className="wl-tableWrap">
              <table className="wl-table">
                <thead>
                  <tr>
                    <th style={{ width: 250 }}>Day</th>
                    <th style={{ width: 300 }}>Time</th>
                    <th style={{ width: 220 }}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleWithDates.map((item, i) => (
                    <tr key={i}>
                      <td className="wl-strong">{item.dayWithDate || item.day || "-"}</td>
                      <td className="wl-mono">{formatTimeRangeDisplay(item.time)}</td>
                      <td className="wl-mono">{item.location || "-"}</td>
                    </tr>
                  ))}

                  {scheduleWithDates.length === 0 && (
                    <tr>
                      <td colSpan={3} className="wl-empty">
                        No schedule items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="wl-card">
            <div className="wl-cardHeader">
              <div className="wl-cardTitle">Summary</div>

              <div className="wl-kpis">
                <div className="wl-kpi">
                  <span className="wl-kpiLabel">Total Hours </span>
                  <span className="wl-kpiValue">{Number(totalHours).toFixed(2)}</span>
                </div>
                <div className="wl-kpi">
                  <span className="wl-kpiLabel">Missed Days </span>
                  <span className="wl-kpiValue">{missedDays}</span>
                </div>
              </div>
            </div>

            <div className="wl-chartBox">
              <Bar data={chartData} options={chartOptions} />
            </div>

            <div className="wl-foot">Bars are calculated from the submitted schedule times</div>
          </div>
        </div>

        {/* Right column */}
        <div className="wl-card wl-pdfCard">
          <div className="wl-cardHeader">
            <div className="wl-cardTitle">Submitted Timesheet</div>
            <div className="wl-muted">{pdfUrl ? "Preview" : "No preview URL"}</div>
          </div>

          <div className="wl-pdfWrap">
            {pdfError ? (
              <div className="wl-pdfState">
                <div className="wl-error">{pdfError}</div>
                <button className="wl-btn" onClick={retry}>
                  Retry
                </button>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={`${pdfUrl}#zoom=page-width`}
                title="Submitted Timesheet"
                className="wl-iframe"
                onError={() => setPdfError("PDF is not available.")}
              />
            ) : (
              <div className="wl-pdfState">
                <div className="wl-muted">PDF preview is not available.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkLog;
