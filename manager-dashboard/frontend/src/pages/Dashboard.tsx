import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckBox } from "@/components/ui/checkbox";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function Dashboard() {
    return (
        <div className="flex h-screen">
            {/* Left Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 p-6">
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <img 
                            src="/logo.png" 
                            alt="BOSK Logo" 
                            className="h-6 w-auto"
                        />
                        <h2 className="text-xl font-bold">M O V E R E T</h2>
                    </div>
                </div>
                
                {/* Navigation */}
                <nav>
                    <a href="#" className="block px-4 py-2 mb-1 bg-blue-500 text-white rounded">
                        Tennessee
                    </a>
                    <a href="#" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
                        Kentucky
                    </a>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8">
                <h1 className="text-2xl font-bold mb-8">DASHBOARD</h1>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <Card className="shadow-sm">
                        <CardContent className="p-6">
                            <h2 className="text-center text-gray-600 font-semibold mb-2">PENDING</h2>
                            <p className="text-center text-4xl font-bold">0</p>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardContent className="p-6">
                            <h2 className="text-center text-gray-600 font-semibold mb-2">APPROVED</h2>
                            <p className="text-center text-4xl font-bold">0</p>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardContent className="p-6">
                            <h2 className="text-center text-gray-600 font-semibold mb-2">PAST 2 MONTHS</h2>
                            <p className="text-center text-4xl font-bold">0</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs and Table */}
                <Tabs defaultValue="pending" className="w-full">
                    <TabsList className="flex gap-8 mb-6">
                        <TabsTrigger 
                            value="pending"
                            className="text-gray-600 hover:text-gray-900 data-[state=active]:text-black data-[state=active]:border-b-2 data-[state=active]:border-blue-500 pb-2"
                        >
                            PENDING
                        </TabsTrigger>
                        <TabsTrigger 
                            value="approved"
                            className="text-gray-600 hover:text-gray-900 data-[state=active]:text-black data-[state=active]:border-b-2 data-[state=active]:border-blue-500 pb-2"
                        >
                            APPROVED
                        </TabsTrigger>
                        <TabsTrigger 
                            value="past"
                            className="text-gray-600 hover:text-gray-900 data-[state=active]:text-black data-[state=active]:border-b-2 data-[state=active]:border-blue-500 pb-2"
                        >
                            PAST 2 MONTHS
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending">
                        <div className="space-y-6">
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100">
                                <div className="h-[500px] overflow-auto">
                                    <Table className="w-full">
                                        <TableHead className="sticky top-0 bg-white z-10">
                                            <TableRow>
                                                <TableCell className="w-[8%] py-4 pl-10 pr-6 text-blue-500 font-normal">No.</TableCell>
                                                <TableCell className="w-[14%] py-4 px-6 text-blue-500 font-normal">Employee Name</TableCell>
                                                <TableCell className="w-[14%] py-4 px-6 text-blue-500 font-normal">Requester Name</TableCell>
                                                <TableCell className="w-[12%] py-4 px-6 text-blue-500 font-normal">Request Date</TableCell>
                                                <TableCell className="w-[12%] py-4 px-6 text-blue-500 font-normal">Service Week</TableCell>
                                                <TableCell className="w-[11%] py-4 px-6 text-blue-500 font-normal">Total Hours</TableCell>
                                                <TableCell className="w-[20.5%] py-4 px-6 text-blue-500 font-normal text-center">Service Purpose</TableCell>
                                                <TableCell className="w-[10%] py-4 pr-10 pl-6 text-blue-500 font-normal">
                                                    <div className="flex items-center justify-end whitespace-nowrap">
                                                        <span className="mr-2">Select All</span>
                                                        <div className="w-5 h-5 border border-gray-300 rounded flex items-center justify-center">
                                                            <CheckBox className="w-4 h-4 " />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody className="relative">
                                            <TableRow>
                                                <TableCell 
                                                    colSpan={8}
                                                    className="h-[400px] text-center text-gray-500"
                                                >
                                                    No data available
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            <div className="flex justify-center gap-4">
                                <Button 
                                    variant="outline" 
                                    className="w-[200px] py-2.5 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        Delete
                                    </span>
                                </Button>
                                <Button 
                                    className="w-[200px] py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        Approve
                                    </span>
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="approved">
                        {/* Similar table structure for approved requests */}
                    </TabsContent>

                    <TabsContent value="past">
                        {/* Similar table structure for past requests */}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

export default Dashboard;