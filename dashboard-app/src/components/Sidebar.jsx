import React from "react";
import "./Sidebar.css";
import logoImg from "../assets/logo.png";

const Sidebar = ({ activeMenu, onMenuClick }) => {
  const menus = ["Dashboard", "Work Logs"];

  return (
    <aside className="sidebar">
      <div className="logo-row">
        <img src={logoImg} alt="logo" className="logo-img" />
        <h1 className="logo">M O V E R E T</h1>
      </div>
      <ul>
        {menus.map((menu) => (
          <li
            key={menu}
            className={activeMenu === menu ? "active" : ""}
            onClick={() => onMenuClick(menu)}
          >
            {menu}
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default Sidebar;
