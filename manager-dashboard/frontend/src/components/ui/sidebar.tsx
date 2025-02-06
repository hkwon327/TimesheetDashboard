import * as React from "react"

export const Sidebar = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`w-64 bg-gray-100 p-4 ${className}`} {...props}>
    {children}
  </div>
)

export const SidebarItem = ({ 
  label, 
  active, 
  className, 
  ...props 
}: { 
  label: string; 
  active?: boolean; 
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`p-2 mb-2 rounded cursor-pointer ${
      active ? "bg-blue-500 text-white" : "hover:bg-gray-200"
    } ${className}`}
    {...props}
  >
    {label}
  </div>
)