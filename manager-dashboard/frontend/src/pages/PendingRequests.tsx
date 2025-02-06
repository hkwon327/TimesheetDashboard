import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { CheckBox } from "@/components/ui/checkbox";
import { Sidebar, SidebarItem } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FormData {
  No: number;
  'Employee Name': string;
  'Requester Name': string;
  'Request Date': string;
  'Service Week': string;
  'Total Hours': number;
}

const PendingRequests = () => {
  const [forms, setForms] = useState<FormData[]>([]);
  const [selectedForms, setSelectedForms] = useState<number[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, past_2months: 0 });
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`http://localhost:8000/dashboard?status=${activeTab}`);
        const data = await response.json();
        console.log('Fetched data:', data);
        setForms(data.forms);
        setCounts(data.counts);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [activeTab]);

  return (
    <div className="flex h-screen">
      <Sidebar>
        <SidebarItem label="Tennessee" active={true} />
        <SidebarItem label="Kentucky" />
      </Sidebar>

      <div className="flex-grow p-6">
        <h1 className="text-xl font-bold mb-6">DASHBOARD</h1>
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <h3 className="text-gray-500 uppercase">PENDING</h3>
            <p className="text-4xl font-bold mt-2">{counts.pending}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <h3 className="text-gray-500 uppercase">APPROVED</h3>
            <p className="text-4xl font-bold mt-2">{counts.approved}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <h3 className="text-gray-500 uppercase">PAST 2 MONTHS</h3>
            <p className="text-4xl font-bold mt-2">{counts.past_2months}</p>
          </div>
        </div>

        <Tabs defaultValue="pending" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="border-b mb-4">
            <TabsTrigger value="pending" className="text-blue-500">PENDING</TabsTrigger>
            <TabsTrigger value="approved">APPROVED</TabsTrigger>
            <TabsTrigger value="past2months">PAST 2 MONTHS</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending">
            <div className="bg-white rounded-lg">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-4 text-left text-blue-500">No.</th>
                    <th className="p-4 text-left text-blue-500">Employee Name</th>
                    <th className="p-4 text-left text-blue-500">Requester Name</th>
                    <th className="p-4 text-left text-blue-500">Request Date</th>
                    <th className="p-4 text-left text-blue-500">Service Week</th>
                    <th className="p-4 text-left text-blue-500">Total Hours</th>
                    <th className="p-4 text-left text-blue-500">
                      <div className="flex items-center">
                        <span>Select All</span>
                        <CheckBox 
                          className="ml-2"
                          checked={selectedForms.length === forms.length && forms.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedForms(forms.map(f => f.No));
                            } else {
                              setSelectedForms([]);
                            }
                          }}
                        />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {forms.length > 0 ? (
                    forms.map(form => (
                      <tr key={form.No} className="border-b">
                        <td className="p-4">{form.No}</td>
                        <td className="p-4">{form['Employee Name']}</td>
                        <td className="p-4">{form['Requester Name']}</td>
                        <td className="p-4">{form['Request Date']}</td>
                        <td className="p-4">{form['Service Week']}</td>
                        <td className="p-4">{form['Total Hours']} hours</td>
                        <td className="p-4">
                          <CheckBox 
                            checked={selectedForms.includes(form.No)}
                            onCheckedChange={() => {
                              setSelectedForms(prev => 
                                prev.includes(form.No) 
                                  ? prev.filter(id => id !== form.No)
                                  : [...prev, form.No]
                              );
                            }}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center p-4 text-gray-500">
                        No data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-4 gap-4">
          <Button variant="outline">Delete</Button>
          <Button variant="default">Approve</Button>
        </div>
      </div>
    </div>
  );
};

export default PendingRequests;