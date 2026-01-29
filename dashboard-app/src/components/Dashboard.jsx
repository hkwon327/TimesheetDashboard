// /src/components/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Dashboard.css";
import { api } from "../api/client";
import { REGIONS, STATUSES } from "../constants";

const PAGE_SIZE = 10;

const normalizeStatus = (s) => {
  const v = String(s || "").trim().toLowerCase();
  if (v === "approved") return "approved";
  if (v === "confirmed") return "confirmed";
  if (v === "pending") return "pending";
  return "pending";
};

const prettyStatus = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "pending") return "Pending";
  if (v === "approved") return "Approved";
  if (v === "confirmed") return "Confirmed";
  if (v === "processing") return "Processing";
  if (v === "completed") return "Completed";
  if (v === "failed") return "Failed";
  if (v === "deleted") return "Deleted";
  return s ? String(s) : "-";
};

const Dashboard = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);

  const navigate = useNavigate();
  const { region: routeRegion, status: routeStatus } = useParams();

  const activeRegion = REGIONS.includes((routeRegion || "").toLowerCase())
    ? (routeRegion || "").toLowerCase()
    : "kentucky";

  const activeStatus = STATUSES.includes((routeStatus || "").toLowerCase())
    ? (routeStatus || "").toLowerCase()
    : "pending";

  const isAllTab = activeStatus === "all";

  // URL 교정 가드
  useEffect(() => {
    const badRegion = !REGIONS.includes((routeRegion || "").toLowerCase());
    const badStatus = !STATUSES.includes((routeStatus || "").toLowerCase());
    if (badRegion || badStatus) {
      navigate(`/dashboard/${activeRegion}/${activeStatus}`, { replace: true });
    }
  }, [routeRegion, routeStatus, activeRegion, activeStatus, navigate]);

  // localStorage 동기화
  useEffect(() => {
    if (REGIONS.includes(activeRegion)) localStorage.setItem("app_region", activeRegion);
    if (STATUSES.includes(activeStatus)) localStorage.setItem("app_status", activeStatus);
  }, [activeRegion, activeStatus]);

  // 지역 판별 유틸
  const hasKySk = (schedule = []) =>
    Array.isArray(schedule) &&
    schedule.some((item) => (item?.location || "") === "KY SK Trailer");

  // 로드
  useEffect(() => {
    let canceled = false;

    const fetchAndTagRegion = async () => {
      setLoading(true);
      setErr("");

      try {
        const res = await api.get("/submission");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];

        const withRegion = await Promise.all(
          list.map(async (f) => {
            try {
              const d = await api.get(`/submission/${f.id}`);
              const schedule = d?.data?.schedule || [];
              const region = hasKySk(schedule) ? "kentucky" : "tennessee";
              return { ...f, status: normalizeStatus(f.status), _region: region };
            } catch {
              return { ...f, status: normalizeStatus(f.status), _region: "tennessee" };
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
          setErr("Failed to load submissions");
          setLoading(false);
        }
      }
    };

    fetchAndTagRegion();
    return () => {
      canceled = true;
    };
  }, []);

  // region/status 바뀌면 초기화
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [activeRegion, activeStatus]);

  // 지역 필터
  const regionFiltered = useMemo(() => {
    if (activeRegion === "tennessee") return forms.filter((f) => f._region === "tennessee");
    if (activeRegion === "kentucky") return forms.filter((f) => f._region === "kentucky");
    return forms;
  }, [forms, activeRegion]);

  // 카운트
  const counts = useMemo(
    () => ({
      pending: regionFiltered.filter((f) => f.status === "pending").length,
      approved: regionFiltered.filter((f) => f.status === "approved").length,
      all: regionFiltered.length,
    }),
    [regionFiltered]
  );

  // 탭 필터
  const filtered = useMemo(() => {
    if (isAllTab) return regionFiltered;
    return regionFiltered.filter((f) => f.status === activeStatus);
  }, [regionFiltered, activeStatus, isAllTab]);

  // 선택/전체선택 계산
  const filteredIds = useMemo(() => filtered.map((f) => f.id), [filtered]);

  const allSelectedInTab =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const selectedIdsInTab = useMemo(
    () => filteredIds.filter((id) => selectedIds.has(id)),
    [filteredIds, selectedIds]
  );

  const hasSelection = selectedIdsInTab.length > 0;

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

  // total_hours 포맷
  const fmtHours = (v) => {
    if (v === null || v === undefined || v === "" || v === "-") return "—";
    const n = Number(v);
    if (Number.isFinite(n)) return n.toFixed(2);
    return String(v);
  };

  // 상세 이동
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

  const toggleAllInTab = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) filteredIds.forEach((id) => next.add(id));
      else filteredIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  // 상태 변경
  const updateStatus = async (ids, newStatus) => {
    try {
      await Promise.all(
        ids.map((id) => api.put(`/submission/${id}/status`, { new_status: newStatus }))
      );

      if (newStatus === "deleted") {
        setForms((prev) => prev.filter((f) => !ids.includes(f.id)));
      } else {
        setForms((prev) =>
          prev.map((f) => (ids.includes(f.id) ? { ...f, status: newStatus } : f))
        );
      }

      setSelectedIds(new Set());
    } catch (e) {
      console.error("Status update failed:", e);
    }
  };

  // region/status 변경
  const onRegionChange = (region) => {
    const r = (region || "").toLowerCase();
    if (!REGIONS.includes(r)) return;
    localStorage.setItem("app_region", r);
    navigate(`/dashboard/${r}/${activeStatus}`);
  };

  const onStatusChange = (status) => {
    const s = (status || "").toLowerCase();
    if (!STATUSES.includes(s)) return;
    localStorage.setItem("app_status", s);
    navigate(`/dashboard/${activeRegion}/${s}`);
  };

  // -------------------------
  // UI
  // -------------------------
  if (loading) {
    return (
      <div className="mgr">
        <div className="mgr-card mgr-skeleton">
          <div className="sk-line w40" />
          <div className="sk-line w25" />
          <div className="sk-grid">
            <div className="sk-block" />
            <div className="sk-block" />
            <div className="sk-block" />
          </div>
          <div className="sk-table" />
        </div>
      </div>
    );
  }

  if (err) return <div className="mgr mgr-error">{err}</div>;

  const regionCounts = {
    tennessee: forms.filter((f) => f._region === "tennessee").length,
    kentucky: forms.filter((f) => f._region === "kentucky").length,
  };

  const tableTitle = isAllTab
    ? "All Submissions"
    : `${activeStatus[0].toUpperCase() + activeStatus.slice(1)} Submissions`;

  return (
    <div className="mgr">
      {/* Header */}
      <div className="mgr-header">
        <div>
          <div className="mgr-title mgr-titleThin">Manager Dashboard</div>
          <div className="mgr-subtitle mgr-subtitleStrong">
            Review submissions by region and status. Select items to approve, send, or delete.
          </div>
        </div>

        <div className="mgr-headerRight">
          <div className="mgr-pill mgr-pillStrong">
            <span className="mgr-pillLabel">Viewing</span>
            <span className="mgr-pillValue">
              {activeRegion.toUpperCase()} · {activeStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Top row */}
      <div className="mgr-topRow">
        {/* Region */}
        <div className="mgr-panel">
          <div className="mgr-panelTitle">Region</div>
          <div className="mgr-segment">
            <button
              type="button"
              className={`seg ${activeRegion === "tennessee" ? "active" : ""}`}
              onClick={() => onRegionChange("tennessee")}
            >
              Tennessee <span className="segCount">{regionCounts.tennessee}</span>
            </button>
            <button
              type="button"
              className={`seg ${activeRegion === "kentucky" ? "active" : ""}`}
              onClick={() => onRegionChange("kentucky")}
            >
              Kentucky <span className="segCount">{regionCounts.kentucky}</span>
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="mgr-panel">
          <div className="mgr-panelTitle">Status</div>
          <div className="mgr-statusGrid">
            <button
              type="button"
              className={`statCard warn ${activeStatus === "pending" ? "active" : ""}`}
              onClick={() => onStatusChange("pending")}
            >
              <div className="statTop">
                <span>Pending</span>
                <span className="statDot" />
              </div>
              <div className="statValue">{counts.pending}</div>
            </button>

            <button
              type="button"
              className={`statCard ok ${activeStatus === "approved" ? "active" : ""}`}
              onClick={() => onStatusChange("approved")}
            >
              <div className="statTop">
                <span>Approved</span>
                <span className="statDot" />
              </div>
              <div className="statValue">{counts.approved}</div>
            </button>

            <button
              type="button"
              className={`statCard info ${isAllTab ? "active" : ""}`}
              onClick={() => onStatusChange("all")}
            >
              <div className="statTop">
                <span>All</span>
                <span className="statDot" />
              </div>
              <div className="statValue">{counts.all}</div>
            </button>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="mgr-tableCard">
        <div className="mgr-tableHeader mgr-tableHeaderTight">
          {/* 1줄: 왼쪽 타이틀 / 오른쪽 Select all + Clear */}
          <div className="mgr-tableHeaderTop">
            <div className="mgr-tableHeaderLeft">
              <div className="mgr-tableTitle">
                {tableTitle}
                <span className="mgr-tableCount">{filtered.length}</span>
              </div>
            </div>

            <div className="mgr-controlsRow">
              <label className="mgr-selectAllInline mgr-checkboxRight">
                Select all
                <input
                  type="checkbox"
                  checked={allSelectedInTab}
                  onChange={(e) => toggleAllInTab(e.target.checked)}
                />
              </label>

              <button
                type="button"
                className="mgr-linkBtn"
                disabled={selectedIdsInTab.length === 0}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
            </div>
          </div>

          {/* 2줄: 왼쪽 hint / 오른쪽 Selected */}
          <div className="mgr-tableHeaderRow2">
            <div className="mgr-tableHint mgr-tableHintBelow">Click a row to open details</div>

            {/* ✅ hint와 같은 톤/크기로 맞춤 */}
            <div className="mgr-tableHint mgr-selectedRight">
              Selected <span className="mgr-selectedCount">{selectedIdsInTab.length}</span>
            </div>
          </div>
        </div>

        <div className="mgr-tableWrap">
          <table className="mgr-table">
            <thead>
              <tr>
                <th className="mgr-colCheck" />
                <th className="mgr-colEmployee">Employee</th>
                <th className="mgr-colRequestor">Requestor</th>

                {/* ✅ Total Hours만 오른쪽 */}
                <th className="mgr-colHours">Total Hours</th>

                {isAllTab && <th className="mgr-colStatus">Status</th>}

                {/* ✅ 날짜/기간은 가운데 */}
                <th className="mgr-colReqDate">Request Date</th>
                <th className="mgr-colServiceWeek">Service Week</th>
              </tr>
            </thead>

            <tbody>
              {currentPageItems.map((form) => (
                <tr key={form.id} onClick={() => handleRowClick(form.id)}>
                  <td className="mgr-tdCheck" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="mgr-checkbox"
                      type="checkbox"
                      checked={selectedIds.has(form.id)}
                      onChange={() => toggleOne(form.id)}
                    />
                  </td>

                  {/* ✅ 왼쪽 정렬 */}
                  <td className="cell-strong mgr-tdText">{form.employee_name || "-"}</td>
                  <td className="mgr-tdText">{form.requestor_name || "-"}</td>

                  {/* ✅ 숫자만 오른쪽 */}
                  <td className="mgr-tdNum">{fmtHours(form.total_hours)}</td>

                  {isAllTab && <td className="cell-status">{prettyStatus(form.status)}</td>}

                  {/* ✅ 가운데 정렬 */}
                  <td className="cell-mono mgr-tdDate">{fmtMD(form.request_date)}</td>
                  <td className="cell-mono mgr-tdDate">
                    {fmtMD(form.service_week_start)} – {fmtMD(form.service_week_end)}
                  </td>
                </tr>
              ))}

              {currentPageItems.length === 0 && (
                <tr>
                  <td colSpan={isAllTab ? 7 : 6} className="mgr-empty">
                    No submissions in this status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mgr-pagination">
          <button disabled={clampedPage === 1} onClick={() => setPage(clampedPage - 1)}>
            ‹
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
            ›
          </button>
        </div>

        {/* Bottom actions */}
        <div className="mgr-bottomBar mgr-bottomBarCenter">
          {activeStatus === "pending" && (
            <>
              <button
                className="btn primary big"
                disabled={!hasSelection}
                onClick={() => updateStatus(selectedIdsInTab, "approved")}
              >
                Approve
              </button>
              <button
                className="btn danger big"
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
                className="btn primary big"
                disabled={!hasSelection}
                onClick={() => updateStatus(selectedIdsInTab, "confirmed")}
              >
                Send
              </button>
              <button
                className="btn danger big"
                disabled={!hasSelection}
                onClick={() => updateStatus(selectedIdsInTab, "deleted")}
              >
                Delete
              </button>
            </>
          )}

          {activeStatus === "all" && (
            <>
              <button className="btn primary big" disabled={!hasSelection}>
                Approve
              </button>
              <button className="btn danger big" disabled={!hasSelection}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
