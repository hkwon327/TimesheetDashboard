import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import WorkLog from "./components/WorkLog";
import { REGIONS, STATUSES } from "./constants";
import "./App.css";

// 쿠키 읽기 헬퍼
function getCookie(name) {
  const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
  return m ? decodeURIComponent(m[1]) : null;
}

// 대시보드 리다이렉트 (URL > cookie > localStorage > 기본값)
const DashboardRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const urlRegion = (qs.get("region") || "").toLowerCase();
    const urlStatus = (qs.get("status") || "").toLowerCase();

    const lsRegion = (localStorage.getItem("app_region") || "").toLowerCase();
    const lsStatus = (localStorage.getItem("app_status") || "").toLowerCase();
    const lsLastRegion = (localStorage.getItem("app_last_detected_region") || "").toLowerCase();

    const cookieRegion = (getCookie("app_region") || "").toLowerCase();

    // 현재 감지된 지역과 이전에 저장된 지역 비교
    const currentDetectedRegion = cookieRegion;
    const hasLocationChanged = lsLastRegion && currentDetectedRegion && 
                              lsLastRegion !== currentDetectedRegion;
    
    // console.log('=== Location Change Debug ===');
    // console.log('lsLastRegion:', lsLastRegion);
    // console.log('currentDetectedRegion:', currentDetectedRegion);
    // console.log('hasLocationChanged:', hasLocationChanged);

    let pickRegion;
    let pickStatus;

    // URL 파라미터가 있으면 최우선
    if (REGIONS.includes(urlRegion)) {
      pickRegion = urlRegion;
    }
    // 위치가 바뀌었으면 새로운 지역 기반으로 리셋
    else if (hasLocationChanged) {
      if (currentDetectedRegion === 'kentucky') {
        pickRegion = 'kentucky';
      } else if (currentDetectedRegion === 'tennessee') {
        pickRegion = 'tennessee';
      } else {
        pickRegion = 'tennessee';
      }
      // 지역이 바뀌었으므로 상태도 기본값으로 리셋
      pickStatus = 'pending';
      
      // localStorage 업데이트
      localStorage.setItem("app_region", pickRegion);
      localStorage.setItem("app_status", pickStatus);
      localStorage.setItem("app_last_detected_region", currentDetectedRegion || 'unknown');
    }
    // 지역이 같거나 처음 방문인 경우
    else {
      // 기존 로직 유지하되 기본값만 변경
      pickRegion =
        (REGIONS.includes(cookieRegion) && cookieRegion) ||
        (REGIONS.includes(lsRegion) && lsRegion) ||
        "tennessee"; // 기본값 변경: kentucky → tennessee

      pickStatus =
        (STATUSES.includes(urlStatus) && urlStatus) ||
        (STATUSES.includes(lsStatus) && lsStatus) ||
        "pending";
        
      // 처음 방문이면 현재 감지된 지역 저장
      if (!lsLastRegion && currentDetectedRegion) {
        localStorage.setItem("app_last_detected_region", currentDetectedRegion);
      }
    }

    navigate(`/dashboard/${pickRegion}/${pickStatus}`, { replace: true });
  }, [navigate]);

  return (
    <div className="loading-container">
      <div className="loading-spinner">Determining your region...</div>
    </div>
  );
};

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedFormId, setSelectedFormId] = useState(null);

  // 좌측 메뉴 활성화 판단
  const activeMenu =
    location.pathname === "/" || location.pathname.startsWith("/dashboard")
      ? "Dashboard"
      : location.pathname.startsWith("/worklog") ||
        location.pathname.startsWith("/worklogs")
      ? "Work Logs"
      : "";

  const handleMenuClick = (menu) => {
    if (menu === "Dashboard") {
      const lsRegion = (localStorage.getItem("app_region") || "").toLowerCase();
      const lsStatus = (localStorage.getItem("app_status") || "").toLowerCase();
      const cookieRegion = (getCookie("app_region") || "").toLowerCase();

      const region = REGIONS.includes(lsRegion)
        ? lsRegion
        : REGIONS.includes(cookieRegion)
        ? cookieRegion
        : "tennessee"; 
      const status = STATUSES.includes(lsStatus) ? lsStatus : "pending";

      navigate(`/dashboard/${region}/${status}`);
    } else if (menu === "Work Logs") {
      navigate("/worklogs");
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeMenu={activeMenu} onMenuClick={handleMenuClick} />
      <main className="main-content">
        <Routes>
          {/* 루트 → 대시보드로 교정 */}
          <Route path="/" element={<DashboardRedirect />} />

          {/* /dashboard → 지역/상태로 교정 */}
          <Route path="/dashboard" element={<DashboardRedirect />} />

          {/* 지역/상태별 대시보드 */}
          <Route
            path="/dashboard/:region/:status"
            element={<Dashboard onFormSelect={setSelectedFormId} />}
          />

          {/* Work Logs 라우팅 */}
          <Route path="/worklog" element={<Navigate to="/worklogs" replace />} />
          <Route
            path="/worklogs"
            element={<WorkLog selectedFormId={selectedFormId} />}
          />
          <Route
            path="/worklog/:formId"
            element={<WorkLog selectedFormId={selectedFormId} />}
          />
          <Route
            path="/worklogs/:formId"
            element={<WorkLog selectedFormId={selectedFormId} />}
          />

          {/* 404 */}
          <Route
            path="*"
            element={
              <div className="not-found">
                <h2>Page Not Found</h2>
                <p>The page you're looking for doesn't exist.</p>
                <button onClick={() => navigate("/dashboard")}>
                  Go to Dashboard
                </button>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <Layout />
  </BrowserRouter>
);

export default App;
