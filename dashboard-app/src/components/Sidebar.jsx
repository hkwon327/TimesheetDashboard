import React from "react";
import "./Sidebar.css";

const Sidebar = ({ activeMenu, onMenuClick }) => {
  const menus = ["Dashboard", "Work Logs", "Monthly Summary"];

  return (
    <aside className="sidebar">
      <h1 className="logo">Moveret</h1>
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
