import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"

const serviceData = [
  {
    id: 1,
    employeeName: "Haeun Kwon",
    requestorName: "Hong Gil Dong",
    requestDate: "02/07/2025",
    serviceWeek: "02/03/25 - 02/07/25",
    servicePurpose: [
      "Mon 08:00 AM - 05:00 PM BOSK Trailer",
      "Tue 08:00 AM - 05:00 PM BOSK Trailer",
      "Wed 08:00 AM - 05:00 PM BOSK Trailer",
      "Thu 08:00 AM - 05:00 PM BOSK Trailer",
      "Fri 08:00 AM - 05:00 PM BOSK Trailer"
    ]
  },
  {
    id: 2,
    employeeName: "Sonia Song",
    requestorName: "Hymi Kwon",
    requestDate: "02/07/2025",
    serviceWeek: "02/03/25 - 02/07/25",
    servicePurpose: [
      "Mon 08:00 AM - 05:00 PM SAMKOO Trailer",
      "Tue 08:00 AM - 05:00 PM SAMKOO Trailer",
      "Wed 08:00 AM - 05:00 PM SAMKOO Trailer",
      "Thu 08:00 AM - 05:00 PM SAMKOO Trailer",
      "Fri 08:00 AM - 05:00 PM SAMKOO Trailer"
    ]
  },
  {
    id: 3,
    employeeName: "Mickel Lee",
    requestorName: "Hymi Kwon",
    requestDate: "02/07/2025",
    serviceWeek: "02/03/25 - 02/07/25",
    servicePurpose: [
      "Mon 08:00 AM - 05:00 PM SAMKOO Trailer",
      "Tue 08:00 AM - 05:00 PM SAMKOO Trailer",
      "Wed 08:00 AM - 05:00 PM SAMKOO Trailer",
      "Thu 08:00 AM - 05:00 PM SAMKOO Trailer",
      "Fri 08:00 AM - 05:00 PM SAMKOO Trailer"
    ]
  }
]

export const DashboardTable = () => {
  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <div className="flex space-x-8">
          <button className="text-blue-600 font-medium border-b-2 border-blue-600 pb-2">Pending</button>
          <button className="text-gray-500 pb-2">Approved</button>
          <button className="text-gray-500 pb-2">Past 2 Months</button>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Select All</span>
          <Checkbox />
        </div>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow className="border-t border-b">
            <TableHead className="w-12"><Checkbox /></TableHead>
            <TableHead className="font-medium">Employee Name</TableHead>
            <TableHead className="font-medium">Requestor Name</TableHead>
            <TableHead className="font-medium">Request Date</TableHead>
            <TableHead className="font-medium">Service Week</TableHead>
            <TableHead className="font-medium">Service Purpose</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {serviceData.map((row) => (
            <TableRow key={row.id} className="border-b">
              <TableCell className="py-4"><Checkbox /></TableCell>
              <TableCell className="py-4">{row.employeeName}</TableCell>
              <TableCell className="py-4">{row.requestorName}</TableCell>
              <TableCell className="py-4">{row.requestDate}</TableCell>
              <TableCell className="py-4">{row.serviceWeek}</TableCell>
              <TableCell className="py-4">
                <div className="space-y-1">
                  {row.servicePurpose.map((service, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      {service}
                    </div>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}