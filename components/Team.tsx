
import React, { useState, useEffect } from 'react';
import { UserProfile, UserMetadata, LeaveRequest } from '../types';
import { db, collection, query, where, getDocs, doc, getDoc, Timestamp, setDoc, serverTimestamp, deleteDoc } from '../firebase';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

interface TeamProps {
  user: UserProfile;
}

type CheckinStatus = 'Not Checked In' | 'Working from Home' | 'Out of Office' | 'Available' | 'On Leave';

interface MemberWithStatus extends UserProfile {
  isOnLeave: boolean;
  leaveUntil?: string;
  checkinStatus: CheckinStatus;
}

const Team: React.FC<TeamProps> = ({ user }) => {
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [managers, setManagers] = useState<{uid: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<{ profile: UserProfile; metadata: UserMetadata | null } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // New Employee Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const [newEmpData, setNewEmpData] = useState({
    email: '',
    password: '',
    name: '',
    title: '',
    role: 'Employee' as 'Employee' | 'Manager' | 'Founder',
    department: '',
    joiningDate: new Date().toISOString().split('T')[0],
    managerId: '',
    baseSalary: '',
    taxDeduction: '0',
    hra: '0',
    travel: '0',
    other: '0'
  });

  const isFounder = user.role === 'Founder';

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersQ = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQ);
      
      const leavesQ = query(collection(db, 'leaveRequests'), where('status', '==', 'Approved'));
      const leavesSnapshot = await getDocs(leavesQ);
      const approvedLeaves = leavesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const attendanceQ = query(
        collection(db, 'attendance'),
        where('checkinAt', '>=', Timestamp.fromDate(todayStart)),
        where('checkinAt', '<=', Timestamp.fromDate(todayEnd))
      );
      const attendanceSnapshot = await getDocs(attendanceQ);
      const attendanceMap = new Map();
      attendanceSnapshot.docs.forEach(doc => {
        const data = doc.data();
        attendanceMap.set(data.userId, data);
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const list: MemberWithStatus[] = [];
      const managerList: {uid: string, name: string}[] = [];

      usersSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        const uid = doc.id;
        
        if (data.role === 'Manager' || data.role === 'Founder') {
          managerList.push({ uid, name: data.name });
        }

        let joiningDateStr = 'Unknown';
        if (data.joiningDate) {
          if (typeof data.joiningDate.toDate === 'function') {
            joiningDateStr = data.joiningDate.toDate().toISOString().split('T')[0];
          } else if (data.joiningDate.seconds) {
            joiningDateStr = new Date(data.joiningDate.seconds * 1000).toISOString().split('T')[0];
          } else {
            joiningDateStr = String(data.joiningDate);
          }
        }

        const activeLeave = approvedLeaves.find(leave => {
          if (leave.userId !== uid) return false;
          const start = leave.startDate.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
          const end = leave.endDate.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return today >= start && today <= end;
        });

        let leaveUntilStr = undefined;
        let checkinStatus: CheckinStatus = 'Not Checked In';

        if (activeLeave) {
           const endDate = activeLeave.endDate.toDate ? activeLeave.endDate.toDate() : new Date(activeLeave.endDate);
           leaveUntilStr = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
           checkinStatus = 'On Leave';
        } else {
          const attendance = attendanceMap.get(uid);
          if (attendance) {
            if (attendance.isWfh) checkinStatus = 'Working from Home';
            else if (attendance.isOutOfOffice) checkinStatus = 'Out of Office';
            else checkinStatus = 'Available';
          } else {
            checkinStatus = 'Not Checked In';
          }
        }

        list.push({ uid, ...data, joiningDate: joiningDateStr, isOnLeave: !!activeLeave, leaveUntil: leaveUntilStr, checkinStatus } as MemberWithStatus);
      });

      const statusOrder: Record<CheckinStatus, number> = {
        'Available': 0, 'Working from Home': 1, 'Out of Office': 2, 'On Leave': 3, 'Not Checked In': 4
      };

      list.sort((a, b) => {
        if (statusOrder[a.checkinStatus] !== statusOrder[b.checkinStatus]) return statusOrder[a.checkinStatus] - statusOrder[b.checkinStatus];
        return a.name.localeCompare(b.name);
      });

      setMembers(list);
      setManagers(managerList);
    } catch (err) {
      console.error("Error fetching team data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.uid]);

  const handleDeleteEmployee = async (targetUser: MemberWithStatus) => {
    if (!window.confirm(`Are you absolutely sure you want to delete ${targetUser.name}? This will permanently remove their profile, salary config, leave balances, and retention bonus records from the database.`)) {
      return;
    }

    setIsDeleting(targetUser.uid);
    try {
      // Collections to delete from as per request
      const collections = ['users', 'retentionBonus', 'salaryConfig', 'leaveBalances', 'userMetadata'];
      const deletions = collections.map(col => deleteDoc(doc(db, col, targetUser.uid)));
      
      await Promise.all(deletions);
      alert(`Records for ${targetUser.name} have been successfully deleted.`);
      fetchData();
    } catch (err: any) {
      console.error("Deletion error:", err);
      alert("Failed to delete user records: " + err.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCreateEmployee = async () => {
    if (!newEmpData.email || !newEmpData.password || !newEmpData.name) {
      alert("Please fill in all mandatory fields (Email, Password, Name)");
      return;
    }

    setIsCreating(true);
    let secondaryApp;
    try {
      const config = {
        apiKey: "AIzaSyDnqcY_PAsPmfLBt4eG7o62t7a5YV877dA",
        authDomain: "studio-2980330480-5ba3b.firebaseapp.com",
        projectId: "studio-2980330480-5ba3b",
        storageBucket: "studio-2980330480-5ba3b.firebasestorage.app",
        messagingSenderId: "1017876570620",
        appId: "1:1017876570620:web:287e44f78d6b3b743f9279"
      };

      const apps = getApps();
      const existingSecondary = apps.find(a => a.name === 'secondary');
      if (existingSecondary) await deleteApp(existingSecondary);
      
      secondaryApp = initializeApp(config, 'secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmpData.email, newEmpData.password);
      const newUid = userCredential.user.uid;
      const currentYear = new Date().getFullYear();
      const joiningTimestamp = Timestamp.fromDate(new Date(newEmpData.joiningDate));

      const batch: Promise<any>[] = [];

      batch.push(setDoc(doc(db, 'users', newUid), {
        email: newEmpData.email,
        name: newEmpData.name,
        title: newEmpData.title,
        role: newEmpData.role,
        department: newEmpData.department,
        joiningDate: newEmpData.joiningDate,
        managerId: newEmpData.managerId,
        createdAt: serverTimestamp(),
        employmentActive: true
      }));

      batch.push(setDoc(doc(db, 'salaryConfig', newUid), {
        userId: newUid,
        employeeName: newEmpData.name,
        baseSalary: parseFloat(newEmpData.baseSalary) || 0,
        taxDeduction: parseFloat(newEmpData.taxDeduction) || 0,
        allowances: {
          hra: parseFloat(newEmpData.hra) || 0,
          travel: parseFloat(newEmpData.travel) || 0,
          other: parseFloat(newEmpData.other) || 0
        },
        isActive: true,
        effectiveFrom: joiningTimestamp,
        effectiveTo: null,
        createdAt: serverTimestamp()
      }));

      batch.push(setDoc(doc(db, 'leaveBalances', newUid), {
        userId: newUid,
        employeeName: newEmpData.name,
        clTotal: 24,
        clBalance: 24,
        currentMonthClUsed: 0,
        slTotal: 12,
        slBalance: 12,
        currentMonthSlUsed: 0,
        hdlCount: 0,
        lateWarningLeft: 3,
        lastMonthlyReset: serverTimestamp(),
        createdAt: serverTimestamp(),
        year: currentYear
      }));

      batch.push(setDoc(doc(db, 'retentionBonus', newUid), {
        userId: newUid,
        employeeName: newEmpData.name,
        totalBonus: 0,
        bonusMonths: [],
        year: currentYear
      }));

      await Promise.all(batch);
      
      alert(`Employee ${newEmpData.name} created successfully!`);
      setShowAddModal(false);
      setAddStep(1);
      setNewEmpData({
        email: '', password: '', name: '', title: '', role: 'Employee', department: '',
        joiningDate: new Date().toISOString().split('T')[0], managerId: '',
        baseSalary: '', taxDeduction: '0', hra: '0', travel: '0', other: '0'
      });
      fetchData();
    } catch (err: any) {
      console.error("Creation error:", err);
      alert("Error: " + err.message);
    } finally {
      setIsCreating(false);
      if (secondaryApp) await deleteApp(secondaryApp);
    }
  };

  const handleViewProfile = async (member: UserProfile) => {
    setLoadingDetails(true);
    try {
      const metaSnap = await getDoc(doc(db, 'userMetadata', member.uid));
      const metadata = metaSnap.exists() ? (metaSnap.data() as UserMetadata) : null;
      setSelectedMember({ profile: member, metadata });
    } catch (err) {
      console.error("Error fetching member metadata:", err);
      setSelectedMember({ profile: member, metadata: null });
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStatusBadgeStyles = (status: CheckinStatus) => {
    switch (status) {
      case 'Available': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Working from Home': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'Out of Office': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'On Leave': return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'Not Checked In': return 'bg-rose-50 text-rose-500 border-rose-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-black tracking-tight">Internal Directory</h1>
          <p className="text-slate-500 text-sm font-medium">Browse team members and their current status.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          {isFounder && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center space-x-2 transition-all active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Add Employee</span>
            </button>
          )}
          <div className="relative w-full md:w-64">
            <input 
              type="text"
              placeholder="Search directory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold shadow-sm"
            />
            <svg className="absolute left-3 top-3 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 animate-pulse h-72"></div>
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center shadow-sm">
          <p className="text-slate-400 font-black text-lg">No team members found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMembers.map((member) => (
            <div 
              key={member.uid} 
              className={`p-6 rounded-3xl border transition-all duration-300 flex flex-col items-center text-center group relative overflow-hidden ${
                member.isOnLeave 
                ? 'bg-slate-50/80 border-slate-100 opacity-90' 
                : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-100'
              }`}
            >
              {/* Founder-only delete button */}
              {isFounder && member.uid !== user.uid && (
                <button 
                  onClick={() => handleDeleteEmployee(member)}
                  disabled={isDeleting === member.uid}
                  className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all z-10"
                  title="Delete User"
                >
                  {isDeleting === member.uid ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              )}

              <div className="relative mb-4">
                <img 
                  className={`h-20 w-20 rounded-3xl object-cover ring-4 transition-all duration-300 ${
                    member.isOnLeave || member.checkinStatus === 'Not Checked In' ? 'grayscale ring-slate-100' : 'ring-indigo-50 group-hover:ring-indigo-100'
                  }`} 
                  src={`https://picsum.photos/seed/${member.uid}/200`} 
                  alt={member.name} 
                />
                {member.checkinStatus === 'Available' && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full"></div>
                )}
                {member.checkinStatus === 'Working from Home' && (
                   <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-500 border-4 border-white rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {member.checkinStatus === 'Out of Office' && (
                   <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 border-4 border-white rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
              <h4 className={`text-base font-black line-clamp-1 ${member.isOnLeave || member.checkinStatus === 'Not Checked In' ? 'text-slate-400' : 'text-slate-900'}`}>{member.name}</h4>
              <p className={`text-xs font-bold mb-1 ${member.isOnLeave || member.checkinStatus === 'Not Checked In' ? 'text-slate-400' : 'text-indigo-600'}`}>{member.title}</p>
              <p className="text-[10px] text-slate-400 font-bold mb-4 uppercase tracking-widest">{member.department}</p>
              <div className="mb-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${getStatusBadgeStyles(member.checkinStatus)}`}>
                  {member.checkinStatus === 'On Leave' ? `On Leave till ${member.leaveUntil}` : member.checkinStatus}
                </span>
              </div>
              <button 
                onClick={() => handleViewProfile(member)}
                className={`w-full py-2.5 rounded-2xl text-xs font-black transition-all ${
                  member.isOnLeave ? 'bg-white border border-slate-100 text-slate-400 hover:bg-slate-100' : 'bg-slate-50 text-slate-600 hover:bg-indigo-600 hover:text-white'
                }`}
              >
                View Profile
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isCreating && setShowAddModal(false)}></div>
          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-900">Add New Employee</h2>
                <div className="flex items-center space-x-2 mt-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${addStep >= i ? 'bg-indigo-600 w-8' : 'bg-slate-200 w-4'}`}></div>
                  ))}
                </div>
              </div>
              <button onClick={() => !isCreating && setShowAddModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>

            <div className="p-10 space-y-6">
              {addStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Step 1: Access Credentials</h3>
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Work Email ID</label>
                      <input 
                        type="email" 
                        required
                        placeholder="e.g. employee@clevrr.ai"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 transition-all"
                        value={newEmpData.email}
                        onChange={e => setNewEmpData({...newEmpData, email: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Initial Password</label>
                      <input 
                        type="text" 
                        required
                        placeholder="min. 6 characters"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 transition-all"
                        value={newEmpData.password}
                        onChange={e => setNewEmpData({...newEmpData, password: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {addStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Step 2: Professional Profile</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Full Name</label>
                      <input 
                        placeholder="e.g. Ishan Kulshrestha"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                        value={newEmpData.name}
                        onChange={e => setNewEmpData({...newEmpData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Platform Role</label>
                      <select 
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newEmpData.role}
                        onChange={e => setNewEmpData({...newEmpData, role: e.target.value as any})}
                      >
                        <option value="Employee">Employee</option>
                        <option value="Manager">Manager</option>
                        <option value="Founder">Founder</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Joining Date</label>
                      <input 
                        type="date"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newEmpData.joiningDate}
                        onChange={e => setNewEmpData({...newEmpData, joiningDate: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Department</label>
                      <input 
                        placeholder="e.g. Engineering"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newEmpData.department}
                        onChange={e => setNewEmpData({...newEmpData, department: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Reporting Manager</label>
                      <select 
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newEmpData.managerId}
                        onChange={e => setNewEmpData({...newEmpData, managerId: e.target.value})}
                      >
                        <option value="">Select Manager</option>
                        {managers.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Designation / Job Title</label>
                      <input 
                        placeholder="e.g. Sr. Tech Lead"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newEmpData.title}
                        onChange={e => setNewEmpData({...newEmpData, title: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {addStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Step 3: Payroll Configuration</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Monthly Base Salary (Gross)</label>
                      <input 
                        type="number"
                        placeholder="₹ Amount"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newEmpData.baseSalary}
                        onChange={e => setNewEmpData({...newEmpData, baseSalary: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Monthly Tax Deduction</label>
                      <input 
                        type="number"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newEmpData.taxDeduction}
                        onChange={e => setNewEmpData({...newEmpData, taxDeduction: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">HRA Allowance</label>
                      <input 
                        type="number"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newEmpData.hra}
                        onChange={e => setNewEmpData({...newEmpData, hra: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Travel Allowance</label>
                      <input 
                        type="number"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newEmpData.travel}
                        onChange={e => setNewEmpData({...newEmpData, travel: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Other Allowances</label>
                      <input 
                        type="number"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newEmpData.other}
                        onChange={e => setNewEmpData({...newEmpData, other: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-10 py-8 border-t border-slate-100 bg-slate-50/50 flex justify-between gap-4">
              <button 
                onClick={() => setAddStep(s => s - 1)}
                disabled={addStep === 1 || isCreating}
                className="px-6 py-3 rounded-2xl text-slate-500 font-bold hover:bg-slate-100 disabled:opacity-0 transition-all"
              >
                Back
              </button>
              {addStep < 3 ? (
                <button 
                  onClick={() => setAddStep(s => s + 1)}
                  className="bg-slate-900 text-white px-10 py-3 rounded-2xl font-black text-sm hover:bg-black transition-all shadow-lg active:scale-95"
                >
                  Next Step
                </button>
              ) : (
                <button 
                  onClick={handleCreateEmployee}
                  disabled={isCreating}
                  className="bg-indigo-600 text-white px-12 py-3 rounded-2xl font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all flex items-center space-x-2 active:scale-95"
                >
                  {isCreating ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span>Finalizing...</span>
                    </>
                  ) : 'Finish & Create Profile'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Member Profile Modal (existing detail view) */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedMember(null)}></div>
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-[2.5rem] shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md px-10 py-8 border-b border-slate-100 flex items-center justify-between z-10">
              <h2 className="text-xl font-black text-slate-900 tracking-tight tracking-tight">Profile Details</h2>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-10 space-y-10">
              {/* Profile Header */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
                <img 
                  className="h-40 w-40 rounded-[2.5rem] object-cover shadow-2xl border-8 border-slate-50" 
                  src={`https://picsum.photos/seed/${selectedMember.profile.uid}/200`} 
                  alt={selectedMember.profile.name} 
                />
                <div className="text-center md:text-left pt-4">
                  <h3 className="text-4xl font-black text-slate-900 tracking-tight">{selectedMember.profile.name}</h3>
                  <p className="text-indigo-600 font-bold text-xl mt-1">{selectedMember.profile.title}</p>
                  <div className="flex flex-wrap gap-6 mt-4 justify-center md:justify-start text-slate-500 font-bold text-sm">
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2 opacity-40 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {selectedMember.profile.department}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2 opacity-40 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Joined {selectedMember.profile.joiningDate}
                    </span>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-3 justify-center md:justify-start">
                    <span className="px-5 py-2 bg-slate-100 text-slate-600 rounded-full text-[11px] font-black uppercase tracking-widest">{selectedMember.profile.role}</span>
                  </div>
                </div>
              </div>

              {/* Read Only Metadata Sections (Restricted) */}
              {user.role === 'Founder' || user.uid === selectedMember.profile.uid ? (
                <>
                {!selectedMember.metadata ? (
                  <div className="p-16 text-center bg-slate-50 rounded-[2.5rem] border-4 border-dashed border-slate-200">
                    <p className="text-slate-400 font-black text-lg">Confidential records (bank/docs) not yet uploaded.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Bank Details */}
                    <div className="bg-slate-50 rounded-[2.5rem] p-10 space-y-8">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5}/></svg>
                        Confidential Bank Details
                      </h4>
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1.5">Account No.</p>
                            <p className="text-base font-black text-slate-900 font-mono tracking-wider">{selectedMember.metadata.bankDetails.accountNumber || '---'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1.5">IFSC Code</p>
                            <p className="text-base font-black text-slate-900 font-mono tracking-wider">{selectedMember.metadata.bankDetails.ifscCode || '---'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase mb-1.5">Bank Institution</p>
                          <p className="text-base font-black text-slate-900">{selectedMember.metadata.bankDetails.bankName || '---'} ({selectedMember.metadata.bankDetails.bankBranch || '---'})</p>
                        </div>
                        {selectedMember.metadata.bankDetails.chequeDriveLink && (
                          <a 
                            href={selectedMember.metadata.bankDetails.chequeDriveLink} 
                            target="_blank" rel="noreferrer"
                            className="inline-flex items-center text-sm font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            <span>Download Proof</span>
                            <svg className="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="bg-slate-50 rounded-[2.5rem] p-10 space-y-8">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth={2.5}/></svg>
                        Document Vault
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries({
                          ...selectedMember.metadata.educationDocs,
                          ...selectedMember.metadata.personalDocs
                        }).map(([key, link]) => (
                          link ? (
                            <a 
                              key={key}
                              href={link}
                              target="_blank" rel="noreferrer"
                              className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 group transition-all"
                            >
                              <span className="text-[11px] font-black text-slate-500 uppercase truncate pr-4">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              <svg className="h-5 w-5 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          ) : null
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                </>
              ) : (
                <div className="p-16 text-center bg-indigo-50 rounded-[2.5rem] border-2 border-dashed border-indigo-100">
                  <div className="mx-auto w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center mb-6 text-indigo-400 shadow-sm">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-indigo-900 tracking-tight">Confidential Records Hidden</h3>
                  <p className="text-indigo-600 text-sm mt-2 max-w-sm mx-auto font-medium leading-relaxed">Bank details and sensitive documents are only visible to the profile owner and system Founders.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Team;
