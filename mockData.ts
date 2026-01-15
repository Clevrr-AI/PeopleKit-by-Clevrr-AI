
import { UserProfile, LeaveBalances, RetentionBonus } from './types';

// Updated mockUser to strictly match UserProfile interface and fixed invalid role type
export const mockUser: UserProfile = {
  uid: 'clevrr_emp_001',
  email: 'jordan.smith@clevrr.ai',
  name: 'Jordan Smith',
  title: 'Senior Frontend Engineer',
  role: 'Employee',
  department: 'Product Engineering',
  joiningDate: '2023-01-15',
  managerId: 'clevrr_mgr_001'
};

// Added missing lateWarningLeft property to satisfy LeaveBalances interface
export const mockLeaveBalances: LeaveBalances = {
  clTotal: 24,
  clBalance: 16,
  currentMonthClUsed: 2,
  slTotal: 12,
  slBalance: 10,
  currentMonthSlUsed: 1,
  hdlCount: 3,
  lateWarningLeft: 3
};

export const mockRetentionBonus: RetentionBonus = {
  totalBonus: 12500,
  bonusMonths: [
    { month: 'January', leaves: 1, bonus: 2500 },
    { month: 'February', leaves: 0, bonus: 2500 },
    { month: 'March', leaves: 2, bonus: 2500 },
    { month: 'April', leaves: 3, bonus: 0 },
    { month: 'May', leaves: 1, bonus: 2500 },
    { month: 'June', leaves: 2, bonus: 2500 }
  ]
};
