import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import TabRegion from "./TabRegion";

// Vite: import.meta.env.VITE_API_BASE / CRA: process.env.REACT_APP_API_BASE
const API_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE ||
  "http://52.91.22.196:8000";

// 한 페이지 최대 10개
const PAGE_SIZE = 10;

const Dashboard = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeRegion, setActiveRegion] = useState("Tennessee"); // "Tennessee" | "Kentucky"
  const [activeStatus, setActiveStatus] = useState("pending");   // "pending" | "approved" | "confirmed"
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  // 'KY SK Trailer'가 하루라도 있으면 Kentucky, 아니면 Tennessee
  const hasKySk = (schedule = []) =>
    Array.isArray(schedule) &&
    schedule.some((item) => (item?.location || "") === "KY SK Trailer");

  useEffect(() => {
    let alive = true;

    const fetchAndTagRegion = async () => {
      setLoading(true);
      try {
        // 1) 전체 폼 목록
        const res = await axios.get(`${API_BASE}/forms`);
        const list = Array.isArray(res.data?.forms) ? res.data.forms : [];

        // 2) 각 폼 상세 조회 → 지역 태깅
        const withRegion = await Promise.all(
          list.map(async (f) => {
            try {
              const d = await axios.get(`${API_BASE}/form/${f.id}`);
              const schedule = d?.data?.schedule || [];
              const region = hasKySk(schedule) ? "Kentucky" : "Tennessee";
              return { ...f, _region: region };
            } catch {
              // 상세 조회 실패 시 기본 Tennessee
              return { ...f, _region: "Tennessee" };
            }
          })
        );

        if (alive) {
          setForms(withRegion);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (alive) {
          setErr("Failed to load forms");
          setLoading(false);
        }
      }
    };

    fetchAndTagRegion();
    return () => {
      alive = false;
    };
  }, []);

  // 지역/상태 바꾸면 첫 페이지로
  useEffect(() => {
    setPage(1);
  }, [activeRegion, activeStatus]);

  // ── 지역 기준 1차 필터 ─────────────────────────────────────────────
  const regionFiltered = useMemo(() => {
    if (activeRegion === "Tennessee") {
      return forms.filter((f) => f._region === "Tennessee");
    }
    if (activeRegion === "Kentucky") {
      return forms.filter((f) => f._region === "Kentucky");
    }
    return forms;
  }, [forms, activeRegion]);

  // 상태 카드: 현재 지역 기준 카운트
  const counts = useMemo(
    () => ({
      pending: regionFiltered.filter((f) => f.status === "pending").length,
      approved: regionFiltered.filter((f) => f.status === "approved").length,
      confirmed: regionFiltered.filter((f) => f.status === "confirmed").length,
    }),
    [regionFiltered]
  );

  // 테이블용 최종 필터 (지역 + 상태)
  const filtered = useMemo(
    () => regionFiltered.filter((f) => f.status === activeStatus),
    [regionFiltered, activeStatus]
  );

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const startIdx = (clampedPage - 1) * PAGE_SIZE;
  const currentPageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  // 날짜 포맷 (MM/DD)
  const fmtMD = (val) => {
    if (!val) return "";
    if (typeof val === "string" && val.length >= 10) {
      const mm = val.slice(5, 7);
      const dd = val.slice(8, 10);
      if (/^\d{2}$/.test(mm) && /^\d{2}$/.test(dd)) return `${mm}/${dd}`;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd}`;
  };

  const handleRowClick = (formId) => {
    localStorage.setItem("lastFormId", String(formId));
    navigate(`/worklog/${formId}`);
  };

  const toggleOne = (formId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });
  };

  // Select All: 현재 탭(지역+상태) 전체 기준
  const allSelectedInTab =
    filtered.length > 0 && filtered.every((f) => selectedIds.has(f.id));

  const toggleAllInTab = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) filtered.forEach((f) => next.add(f.id));
      else filtered.forEach((f) => next.delete(f.id));
      return next;
    });
  };

  // 상태 업데이트 API 호출
  const updateStatus = async (ids, newStatus) => {
    try {
      await Promise.all(
        ids.map((id) =>
          axios.put(`${API_BASE}/form/${id}/status`, { new_status: newStatus })
        )
      );
      // 성공 후 로컬 반영
      setForms((prev) =>
        prev.map((f) => (ids.includes(f.id) ? { ...f, status: newStatus } : f))
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  // 현재 탭(지역+상태) 내에서 선택된 항목
  const selectedIdsInTab = useMemo(() => {
    const ids = new Set(selectedIds);
    return filtered.filter((f) => ids.has(f.id)).map((f) => f.id);
  }, [filtered, selectedIds]);

  const hasSelection = selectedIdsInTab.length > 0;

  if (loading) return <div className="dashboard">Loading...</div>;
  if (err) return <div className="dashboard error">{err}</div>;

  return (
    <div className="dashboard">
      <TabRegion activeRegion={activeRegion} onRegionChange={setActiveRegion} />

      {/* 상태 카드 (주 기준 카운트) */}
      <div className="status-cards">
        <div
          className={`card pending ${activeStatus === "pending" ? "active" : ""}`}
          onClick={() => setActiveStatus("pending")}
        >
          Pending {counts.pending}
        </div>
        <div
          className={`card approved ${activeStatus === "approved" ? "active" : ""}`}
          onClick={() => setActiveStatus("approved")}
        >
          Approved {counts.approved}
        </div>
        <div
          className={`card confirmed ${activeStatus === "confirmed" ? "active" : ""}`}
          onClick={() => setActiveStatus("confirmed")}
        >
          Confirmed {counts.confirmed}
        </div>
      </div>

      <div className="table-section">
        <div className="table-header">
          <span>{activeStatus[0].toUpperCase() + activeStatus.slice(1)}</span>
          <div className="table-header-left" onClick={(e) => e.stopPropagation()}>
            <label className="switch">
              <input
                type="checkbox"
                checked={allSelectedInTab}
                onChange={(e) => toggleAllInTab(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
            <span className="select-all">Select All</span>
          </div>
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
            {currentPageItems.map((form) => (
              <tr key={form.id} onClick={() => handleRowClick(form.id)}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(form.id)}
                    onChange={() => toggleOne(form.id)}
                  />
                </td>
                <td>{form.employee_name || "-"}</td>
                <td>{form.requestor_name || "-"}</td>
                <td>{fmtMD(form.request_date)}</td>
                <td>
                  {fmtMD(form.service_week_start)}{" - "}{fmtMD(form.service_week_end)}
                </td>
                <td>
                  {Number.isFinite(form.total_hours)
                    ? form.total_hours.toFixed(2)
                    : "0.00"}
                </td>
                <td>{form.signature ? "Signed" : "No"}</td>
              </tr>
            ))}
            {currentPageItems.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#888" }}>
                  No forms in this status.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        <div className="pagination">
          <button disabled={clampedPage === 1} onClick={() => setPage(clampedPage - 1)}>
            {"<"}
          </button>
        {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={clampedPage === i + 1 ? "active" : ""}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            disabled={clampedPage === totalPages}
            onClick={() => setPage(clampedPage + 1)}
          >
            {">"}
          </button>
        </div>
      </div>

      {/* 액션 버튼: 중앙 정렬, Delete는 CSS로 오른쪽 고정(order: 99) */}
      <div className="action-buttons">
        {activeStatus === "pending" && (
          <>
            <button
              className="approve"
              disabled={!hasSelection}
              onClick={() => updateStatus(selectedIdsInTab, "approved")}
            >
              Approve
            </button>
            <button
              className="delete"
              disabled={!hasSelection}
              onClick={() => updateStatus(selectedIdsInTab, "deleted")}
            >
              Delete
            </button>
          </>
        )}

        {activeStatus === "approved" && (
          <>
            <button
              className="send"
              disabled={!hasSelection}
              onClick={() => updateStatus(selectedIdsInTab, "confirmed")}
            >
              Send
            </button>
            <button
              className="delete"
              disabled={!hasSelection}
              onClick={() => updateStatus(selectedIdsInTab, "deleted")}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
