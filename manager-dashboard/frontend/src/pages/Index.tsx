import { Card, CardContent } from "@/components/ui/card";
import { Sidebar, SidebarItem } from "@/components/ui/sidebar";

const Index = () => {
  return (
    <div className="flex h-screen">
      <Sidebar>
        <SidebarItem label="Tennessee" active={true} />
        <SidebarItem label="Kentucky" />
      </Sidebar>

      <div className="flex-grow p-6">
        <h1 className="text-xl font-bold mb-6">DASHBOARD</h1>
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent>
              <h2 className="text-center text-lg font-bold">PENDING</h2>
              <p className="text-center text-2xl">3</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h2 className="text-center text-lg font-bold">APPROVED</h2>
              <p className="text-center text-2xl">30</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h2 className="text-center text-lg font-bold">PAST 2 MONTHS</h2>
              <p className="text-center text-2xl">143</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;