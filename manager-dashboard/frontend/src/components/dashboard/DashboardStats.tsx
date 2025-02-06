import { StatsCard } from "./StatsCard"
import { useNavigate, useLocation } from "react-router-dom"

export const DashboardStats = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const handlePendingClick = () => {
    if (location.pathname !== '/pending') {
      navigate("/pending")
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
      <div onClick={handlePendingClick}>
        <StatsCard
          icon="/user-icon.png"
          title="PENDING"
          count="3"
          variant="pending"
        />
      </div>
      <div onClick={() => navigate("/approved")}>
        <StatsCard
          icon="/check-icon.png"
          title="APPROVED"
          count="30"
          variant="approved"
        />
      </div>
      <div onClick={() => navigate("/past")}>
        <StatsCard
          icon="/chart-icon.png"
          title="PAST 2 MONTHS"
          count="143"
          variant="past"
        />
      </div>
    </div>
  )
}