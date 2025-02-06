export interface FormData {
  No: number;
  'Employee Name': string;
  'Requester Name': string;
  'Request Date': string;
  'Service Week': string;
  'Total Hours': number;
  Status: string;
}

export interface DashboardCounts {
  pending: number;
  approved: number;
  past_2months: number;
}

export interface DashboardData {
  counts: DashboardCounts;
  forms: FormData[];
} 