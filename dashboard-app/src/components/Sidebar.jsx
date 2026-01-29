import React from "react";
import "./Sidebar.css";
import logoImg from "../assets/logo.png";

const Sidebar = ({ activeMenu, onMenuClick }) => {
  const menus = [
    { key: "Dashboard", label: "Overview", icon: "grid" },
    { key: "Work Logs", label: "Submission", icon: "dot" },
  ];

  const Icon = ({ name, active }) => {
    if (name === "grid") {
      return (
        <svg viewBox="0 0 24 24" className={`sb-ico ${active ? "is-active" : ""}`} aria-hidden="true">
          <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
        </svg>
      );
    }
    return <span className={`sb-dot ${active ? "is-active" : ""}`} aria-hidden="true" />;
  };

  return (
    <aside className="sidebar">
      <div className="sb-logoCard">
        <div className="sb-logoBadge">
          <img src={logoImg} alt="logo" className="sb-logoImg" />
        </div>

        <div className="sb-logoText">
          <div className="sb-brand">MOVERET</div>
          <div className="sb-sub">Work Hours Portal</div>
        </div>
      </div>

      <ul className="sb-menu" role="list">
        {menus.map((m) => {
          const isActive = activeMenu === m.key;
          return (
            <li key={m.key}>
              <button
                type="button"
                className={`sb-item ${isActive ? "is-active" : ""}`}
                onClick={() => onMenuClick(m.key)}
              >
                <Icon name={m.icon} active={isActive} />
                <span className="sb-label">{m.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default Sidebar;
