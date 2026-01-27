
export interface UserProfile {
  uid: string;
  email: string;
  name: string; 
  title: string; 
  role: 'Employee' | 'Manager' | 'Founder';
  department: string;
  joiningDate: string;
  managerId: string;
}

export interface UserMetadata {
  bankDetails: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    bankBranch: string;
    chequeDriveLink: string;
  };
  educationDocs: {
    marksheet10th: string;
    marksheet12th: string;
    collegeDegree: string;
    lastPayslip: string;
  };
  personalDocs: {
    offerLetter: string;
    codeOfConduct: string;
    aadhaarCard: string;
    panCard: string;
  };
}

export interface SalaryConfig {
  userId: string;
  baseSalary: number;
  taxDeduction: number;
}

export interface Payslip {
  id?: string;
  userId: string;
  employeeName: string;
  month: number;
  monthName: string;
  year: number;
  salaryConfigId: string;
  totalDeductions: number;
  deductions: {
    tax: number;
    leaveDeductions: number;
    lateDeductions: number; // New field
    sl: number;
    cl: number;
    lateDays: number; // New field
  };
  reimbursements: number;
  netSalary: number;
  processedDate: any;
}

export interface Reimbursement {
  id?: string;
  userId: string;
  employeeName: string;
  dateOfPayment: string;
  amount: number;
  reason: string;
  receiptDriveLink: string | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  createdAt: any;
  approvedAt: any | null;
  rejectionReason?: string;
}

export interface LeaveBalances {
  clTotal: number;
  clBalance: number;
  currentMonthClUsed: number;
  slTotal: number;
  slBalance: number;
  currentMonthSlUsed: number;
  hdlCount: number;
  lateWarningLeft: number;
}

export interface BonusMonth {
  month: string;
  leaves: number;
  bonus: number;
}

export interface RetentionBonus {
  totalBonus: number;
  bonusMonths: BonusMonth[];
}

export interface LeaveRequest {
  id?: string;
  userId: string;
  employeeName: string;
  managerId: string;
  leaveType: 'CL' | 'SL' | 'HDL';
  startDate: any; 
  endDate: any; 
  totalDays: number;
  isHalfDay: boolean;
  halfDayType: 'Morning' | 'Afternoon' | null;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Escalated' | 'Cancelled';
  isEscalated: boolean;
  escalationReason: string | null;
  requestedAt: any;
  approvedBy: string | null;
  approvedAt: any | null;
  rejectionReason: string | null;
  comments: string | null;
  cancelledAt: any | null;
  cancelledBy: string | null;
}

export type ViewType = 'dashboard' | 'apply-leave' | 'profile' | 'salaries' | 'payslips' | 'reimbursements' | 'team' | 'check-in' | 'attendance';

export interface AppState {
  user: UserProfile | null;
  leaveBalances: LeaveBalances | null;
  retentionBonus: RetentionBonus | null;
  loading: boolean;
  error: string | null;
}
