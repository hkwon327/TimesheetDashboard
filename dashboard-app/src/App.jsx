import React, { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import WorkLog from "./components/WorkLog";
import "./App.css";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedFormId, setSelectedFormId] = useState(null);

  const activeMenu =
    location.pathname === "/" ? "Dashboard"
    : location.pathname.startsWith("/worklog") ? "Work Logs"
    : "";

  const handleMenuClick = (menu) => {
    if (menu === "Dashboard") navigate("/");
    else if (menu === "Work Logs") navigate("/worklog");
  };

  return (
    <div className="app-layout">
      <Sidebar activeMenu={activeMenu} onMenuClick={handleMenuClick} />
      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={<Dashboard onFormSelect={setSelectedFormId} />}
          />
          <Route
            path="/worklog"
            element={<WorkLog selectedFormId={selectedFormId} />}
          />
          <Route
            path="/worklog/:formId"
            element={<WorkLog selectedFormId={selectedFormId} />}
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
