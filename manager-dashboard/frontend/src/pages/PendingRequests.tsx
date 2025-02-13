import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { CheckBox } from "@/components/ui/checkbox";

interface FormData {
  No: number;
  'Employee Name': string;
  'Requester Name': string;
  'Request Date': string;
  'Service Week': string;
  'Total Hours': number;
}

interface CountData {
  pending: number;
  approved: number;
  past_2months: number;
}

const PendingRequests = () => {
  const [forms, setForms] = useState<FormData[]>([]);
  const [selectedForms, setSelectedForms] = useState<number[]>([]);
  const [counts, setCounts] = useState<CountData>({ pending: 0, approved: 0, past_2months: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('http://localhost:8000/dashboard?status=pending');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setForms(data.forms);
        setCounts(data.counts);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
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

      <div className="bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead>
            <tr className="border-b">
              <th className="p-4 text-left text-blue-500">No.</th>
              <th className="p-4 text-left text-blue-500">Employee Name</th>
              <th className="p-4 text-left text-blue-500">Requester Name</th>
              <th className="p-4 text-left text-blue-500">Request Date</th>
              <th className="p-4 text-left text-blue-500">Service Week</th>
              <th className="p-4 text-left text-blue-500">Total Hours</th>
              <th className="p-4 text-left text-blue-500">Select</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center p-4">Loading...</td>
              </tr>
            ) : forms.length > 0 ? (
              forms.map(form => (
                <tr key={form.No} className="border-b">
                  <td className="p-4">{form.No}</td>
                  <td className="p-4">{form['Employee Name']}</td>
                  <td className="p-4">{form['Requester Name']}</td>
                  <td className="p-4">{form['Request Date']}</td>
                  <td className="p-4">{form['Service Week']}</td>
                  <td className="p-4">{form['Total Hours']}</td>
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

      <div className="flex justify-end mt-4 gap-4">
        <Button variant="outline">Delete</Button>
        <Button variant="default">Approve</Button>
      </div>
    </div>
  );
};

export default PendingRequests;