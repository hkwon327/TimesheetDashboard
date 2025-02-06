import { Button } from "@/components/ui/button"
import { AnimatedDeleteButton } from "@/components/ui/animated-delete-button"

export const DashboardActions = () => {
  return (
    <div className="flex justify-center space-x-8 p-6 border-t">
      <AnimatedDeleteButton />
      <Button className="bg-blue-600 text-white hover:bg-blue-700 px-8">
        Approve
      </Button>
    </div>
  )
}