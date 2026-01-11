import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, writeBatch, collection, getDocs } from "firebase/firestore";
import { Employee, Role, Department, LeaveRequest, AttendanceRecord } from "../types";

// NOTE: Replace with your actual Firebase config
const firebaseConfig = {
  // load from env.local
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const createEmployeeInFirebase = async (
  employeeData: Partial<Employee>, 
  password: string
) => {
  if (!employeeData.email || !employeeData.name) {
    throw new Error("Missing required fields");
  }

  // 1. Create Auth User
  const userCredential = await createUserWithEmailAndPassword(auth, employeeData.email, password);
  const user = userCredential.user;
  const uid = user.uid;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 2. Prepare Batch Write for Firestore
  const batch = writeBatch(db);

  // A. Collection: users
  const userRef = doc(db, "users", uid);
  batch.set(userRef, {
    name: employeeData.name,
    email: employeeData.email,
    role: employeeData.role || 'Employee',
    title: employeeData.title || 'Staff',
    managerId: employeeData.managerId || '',
    department: employeeData.department || 'Engineering',
    joiningDate: employeeData.joiningDate ? new Date(employeeData.joiningDate) : now,
    employmentActive: true,
    createdAt: now,
  });

  // B. Collection: salaryConfig
  const salaryRef = doc(db, "salaryConfig", uid);
  batch.set(salaryRef, {
    userId: uid,
    employeeName: employeeData.name,
    baseSalary: employeeData.baseSalary || 0,
    allowances: employeeData.allowances || { hra: 0, travel: 0, other: 0 },
    taxDeduction: employeeData.taxDeduction || 0,
    effectiveFrom: now,
    effectiveTo: null,
    isActive: true,
    createdAt: now,
  });

  // C. Collection: leaveBalances
  const leaveRef = doc(db, "leaveBalances", uid);
  batch.set(leaveRef, {
    userId: uid,
    employeeName: employeeData.name,
    year: currentYear,
    clBalance: 24, // Default per prompt
    clTotal: 24,
    slBalance: 12, // Default per prompt
    slTotal: 12,
    hdlCount: 0,
    currentMonthClUsed: 0,
    currentMonthSlUsed: 0,
    currentMonth: currentMonth,
    lastMonthlyReset: now,
    createdAt: now,
  });

  // D. Collection: retentionBonus
  const retentionRef = doc(db, "retentionBonus", uid);
  batch.set(retentionRef, {
    userId: uid,
    employeeName: employeeData.name,
    year: currentYear,
    bonusMonths: [],
    totalBonus: 0
  });

  await batch.commit();

  return uid;
};

export const fetchEmployees = async (): Promise<Employee[]> => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const salariesSnap = await getDocs(collection(db, 'salaryConfig'));

    const salaryMap: Record<string, any> = {};
    salariesSnap.forEach(doc => {
      salaryMap[doc.id] = doc.data();
    });

    const employees: Employee[] = [];
    usersSnap.forEach(doc => {
      const userData = doc.data();
      const salaryData = salaryMap[doc.id];
      
      // Merge User and Salary Data
      employees.push({
        id: doc.id,
        name: userData.name,
        email: userData.email,
        role: userData.role as Role,
        department: userData.department as Department,
        title: userData.title,
        managerId: userData.managerId,
        joiningDate: userData.joiningDate?.toDate?.().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        baseSalary: salaryData?.baseSalary || 0,
        allowances: salaryData?.allowances || { hra: 0, travel: 0, other: 0 },
        taxDeduction: salaryData?.taxDeduction || 0,
        isActive: userData.employmentActive
      });
    });

    return employees;
  } catch (error) {
    console.error("Error fetching employees:", error);
    return [];
  }
};

export const fetchLeaves = async (): Promise<LeaveRequest[]> => {
  try {
    const snap = await getDocs(collection(db, 'leaveRequests'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
  } catch (error) {
    console.error("Error fetching leaves:", error);
    return [];
  }
};

export const fetchAttendance = async (): Promise<AttendanceRecord[]> => {
  try {
    const snap = await getDocs(collection(db, 'attendance'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return [];
  }
};