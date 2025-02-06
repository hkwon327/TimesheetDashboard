import { useState } from "react"

export const DashboardHeader = () => {
  return (
    <div className="flex flex-col bg-white border-b">
      <div className="px-6 py-4 border-t">
        <h1 className="text-xl font-semibold text-gray-900">DASHBOARD</h1>
      </div>
    </div>
  )
}