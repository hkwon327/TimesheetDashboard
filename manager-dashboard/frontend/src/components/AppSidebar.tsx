import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useEffect } from "react"

export function AppSidebar() {
  const [activeLocation, setActiveLocation] = useState("tennessee")

  useEffect(() => {
    // Load Palanquin Dark font
    const loadFont = async () => {
      const font = new FontFace(
        'Palanquin Dark',
        'url(https://fonts.googleapis.com/css2?family=Palanquin+Dark:wght@500&display=swap)'
      );

      try {
        await font.load();
        document.fonts.add(font);
        console.log('Palanquin Dark font loaded successfully');
      } catch (error) {
        console.error('Error loading Palanquin Dark font:', error);
      }
    };

    loadFont();
  }, []);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img 
            src="/lovable-uploads/3eba15f1-2553-4eac-a785-48d66b8ffede.png" 
            alt="Logo" 
            className="h-6 w-auto"
          />
          <span 
            className="font-palanquin text-[25px] font-medium text-black w-[157px] h-[34px]"
            style={{ 
              textShadow: "0px 4px 4px rgba(0, 0, 0, 0.25)",
              lineHeight: "normal"
            }}
          >
            MOVERET
          </span>
        </div>
        <div className="mt-6">
          <Tabs defaultValue="tennessee" value={activeLocation} onValueChange={setActiveLocation} className="flex flex-col gap-2">
            <TabsList className="flex flex-col h-auto bg-transparent space-y-2">
              <TabsTrigger value="tennessee" className="flex items-center gap-2 w-full justify-start data-[state=active]:bg-accent">
                <div className="w-4 h-4 bg-blue-600 rounded-sm" />
                Tennessee
              </TabsTrigger>
              <TabsTrigger value="kentucky" className="flex items-center gap-2 w-full justify-start data-[state=active]:bg-accent">
                <div className="w-4 h-4 bg-gray-400 rounded-sm" />
                Kentucky
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Add sidebar content here when needed */}
      </SidebarContent>
    </Sidebar>
  )
}