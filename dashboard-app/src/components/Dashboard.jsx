import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Dashboard.css";
import TabRegion from "./TabRegion";
import { api } from "../api/client";
import { REGIONS, STATUSES } from "../constants";

const PAGE_SIZE = 10;

const Dashboard = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  // URL 파라미터에서 지역/상태 읽기
  const { region: routeRegion, status: routeStatus } = useParams();
  const activeRegion = REGIONS.includes((routeRegion || "").toLowerCase())
    ? (routeRegion || "").toLowerCase()
    : "kentucky";
  const activeStatus = STATUSES.includes((routeStatus || "").toLowerCase())
    ? (routeStatus || "").toLowerCase()
    : "pending";

  // URL 교정 가드: 잘못된 값으로 들어오면 정상 경로로 교정
  useEffect(() => {
    const badRegion = !REGIONS.includes((routeRegion || "").toLowerCase());
    const badStatus = !STATUSES.includes((routeStatus || "").toLowerCase());
    if (badRegion || badStatus) {
      navigate(`/dashboard/${activeRegion}/${activeStatus}`, { replace: true });
    }
  }, [routeRegion, routeStatus, activeRegion, activeStatus, navigate]);

  // URL 선택값을 localStorage에 동기화 (직접 진입해도 최신 저장)
  useEffect(() => {
    if (REGIONS.includes(activeRegion)) {
      localStorage.setItem("app_region", activeRegion);
    }
    if (STATUSES.includes(activeStatus)) {
      localStorage.setItem("app_status", activeStatus);
    }
  }, [activeRegion, activeStatus]);

  // 지역 판별 유틸
  const hasKySk = (schedule = []) =>
    Array.isArray(schedule) &&
    schedule.some((item) => (item?.location || "") === "KY SK Trailer");

  // 폼 로드 + 지역 태깅(소문자)
  useEffect(() => {
    let canceled = false;

    const fetchAndTagRegion = async () => {
      setLoading(true);
      try {
        const res = await api.get("/forms");
        const list = Array.isArray(res.data?.forms) ? res.data.forms : [];

        const withRegion = await Promise.all(
          list.map(async (f) => {
            try {
              const d = await api.get(`/form/${f.id}`);
              const schedule = d?.data?.schedule || [];
              const region = hasKySk(schedule) ? "kentucky" : "tennessee";
              return { ...f, _region: region };
            } catch {
              return { ...f, _region: "tennessee" };
            }
          })
        );

        if (!canceled) {
          setForms(withRegion);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (!canceled) {
          setErr("Failed to load forms");
          setLoading(false);
        }
      }
    };

    fetchAndTagRegion();
    return () => {
      canceled = true;
    };
  }, []);

  // 지역/상태 변경 시 페이지/선택 초기화
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [activeRegion, activeStatus]);

  // 지역 필터
  const regionFiltered = useMemo(() => {
    if (activeRegion === "tennessee")
      return forms.filter((f) => f._region === "tennessee");
    if (activeRegion === "kentucky")
      return forms.filter((f) => f._region === "kentucky");
    return forms;
  }, [forms, activeRegion]);

  // 상태별 카운트
  const counts = useMemo(
    () => ({
      pending: regionFiltered.filter((f) => f.status === "pending").length,
      approved: regionFiltered.filter((f) => f.status === "approved").length,
      confirmed: regionFiltered.filter((f) => f.status === "confirmed").length,
    }),
    [regionFiltered]
  );

  // 현재 탭(상태) 필터
  const filtered = useMemo(
    () => regionFiltered.filter((f) => f.status === activeStatus),
    [regionFiltered, activeStatus]
  );

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const startIdx = (clampedPage - 1) * PAGE_SIZE;
  const currentPageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  // 날짜 포맷
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

  // 워크로그 상세로
  const handleRowClick = (formId) => {
    localStorage.setItem("lastFormId", String(formId));
    navigate(`/worklog/${formId}`);
  };

  // 선택 토글
  const toggleOne = (formId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(formId) ? next.delete(formId) : next.add(formId);
      return next;
    });
  };

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

  // 상태 일괄 변경
  const updateStatus = async (ids, newStatus) => {
    try {
      await Promise.all(
        ids.map((id) => api.put(`/form/${id}/status`, { new_status: newStatus }))
      );
      setForms((prev) =>
        prev.map((f) => (ids.includes(f.id) ? { ...f, status: newStatus } : f))
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const selectedIdsInTab = useMemo(() => {
    const ids = new Set(selectedIds);
    return filtered.filter((f) => ids.has(f.id)).map((f) => f.id);
  }, [filtered, selectedIds]);

  const hasSelection = selectedIdsInTab.length > 0;

  // 지역/상태 전환 시: URL 동기화 + localStorage 저장
  const onRegionChange = (r) => {
    const region = (r || "").toLowerCase();
    if (!REGIONS.includes(region)) return;
    localStorage.setItem("app_region", region);
    navigate(`/dashboard/${region}/${activeStatus}`);
  };

  const onStatusChange = (s) => {
    const status = (s || "").toLowerCase();
    if (!STATUSES.includes(status)) return;
    localStorage.setItem("app_status", status);
    navigate(`/dashboard/${activeRegion}/${status}`);
  };

  if (loading) return <div className="dashboard">Loading...</div>;
  if (err) return <div className="dashboard error">{err}</div>;

  return (
    <div className="dashboard">
      {/* 지역 탭 */}
      <TabRegion activeRegion={activeRegion} onRegionChange={onRegionChange} />

      {/* 상태 카드 */}
      <div className="status-cards">
        <div
          className={`card pending ${activeStatus === "pending" ? "active" : ""}`}
          onClick={() => onStatusChange("pending")}
        >
          Pending {counts.pending}
        </div>
        <div
          className={`card approved ${activeStatus === "approved" ? "active" : ""}`}
          onClick={() => onStatusChange("approved")}
        >
          Approved {counts.approved}
        </div>
        <div
          className={`card confirmed ${activeStatus === "confirmed" ? "active" : ""}`}
          onClick={() => onStatusChange("confirmed")}
        >
          Confirmed {counts.confirmed}
        </div>
      </div>

      {/* 테이블 */}
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

      {/* 액션 버튼 */}
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
