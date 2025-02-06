import React, { useState } from 'react';
import { cn } from "@/lib/utils";

interface AnimatedDeleteButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onDelete?: () => void;
}

export const AnimatedDeleteButton = ({ 
  className,
  onDelete,
  ...props 
}: AnimatedDeleteButtonProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = () => {
    setIsDeleting(true);
    setTimeout(() => {
      onDelete?.();
      setIsDeleting(false);
    }, 2500); // Match animation duration
  };

  return (
    <button 
      className={cn(
        "button",
        isDeleting && "delete",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      <div className="trash">
        <div className="top">
          <div className="paper"></div>
        </div>
        <div className="box"></div>
        <div className="check">
          <svg viewBox="0 0 8 6">
            <polyline points="1 3.4 2.71428571 5 7 1"></polyline>
          </svg>
        </div>
      </div>
      <span>Delete</span>
    </button>
  );
};