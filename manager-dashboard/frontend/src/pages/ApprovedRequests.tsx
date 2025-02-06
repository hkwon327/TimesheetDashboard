
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Sidebar, SidebarItem } from "@/components/ui/sidebar";

const ApprovedRequests = () => {
  return (
    <div className="flex h-screen">
      <Sidebar>
        <SidebarItem label="Tennessee" active={true} />
        <SidebarItem label="Kentucky" />
      </Sidebar>

      <div className="flex-grow p-6">
        <h1 className="text-xl font-bold mb-6">Approved Requests</h1>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>No</TableCell>
              <TableCell>Employee Name</TableCell>
              <TableCell>Requester Name</TableCell>
              <TableCell>Request Date</TableCell>
              <TableCell>Service Week</TableCell>
              <TableCell>Service Purpose</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Add your table rows here */}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ApprovedRequests;