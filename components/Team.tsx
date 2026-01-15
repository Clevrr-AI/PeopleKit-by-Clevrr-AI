
import React, { useState, useEffect } from 'react';
import { UserProfile, UserMetadata, LeaveRequest } from '../types';
import { db, collection, query, where, getDocs, doc, getDoc, Timestamp } from '../firebase';

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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<{ profile: UserProfile; metadata: UserMetadata | null } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const fetchTeamData = async () => {
      setLoading(true);
      try {
        // 1. Fetch all users
        const usersQ = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQ);
        
        // 2. Fetch all approved leave requests to determine current status
        const leavesQ = query(
          collection(db, 'leaveRequests'), 
          where('status', '==', 'Approved')
        );
        const leavesSnapshot = await getDocs(leavesQ);
        const approvedLeaves = leavesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        // 3. Fetch today's attendance
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
        usersSnapshot.forEach((doc) => {
          const data = doc.data() as any;
          const uid = doc.id;
          
          // Convert Joining Date Timestamp to String
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

          // Check if this user is on leave today
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
            // Logic for Check-in status if not on leave
            const attendance = attendanceMap.get(uid);
            if (attendance) {
              if (attendance.isWfh) {
                checkinStatus = 'Working from Home';
              } else if (attendance.isOutOfOffice) {
                checkinStatus = 'Out of Office';
              } else {
                checkinStatus = 'Available';
              }
            } else {
              checkinStatus = 'Not Checked In';
            }
          }

          list.push({ 
            uid: uid, 
            ...data,
            joiningDate: joiningDateStr,
            isOnLeave: !!activeLeave,
            leaveUntil: leaveUntilStr,
            checkinStatus: checkinStatus
          } as MemberWithStatus);
        });

        // Sort: Available first, then WFH/OOO, then On Leave, then Not Checked In
        const statusOrder: Record<CheckinStatus, number> = {
          'Available': 0,
          'Working from Home': 1,
          'Out of Office': 2,
          'On Leave': 3,
          'Not Checked In': 4
        };

        list.sort((a, b) => {
          if (statusOrder[a.checkinStatus] !== statusOrder[b.checkinStatus]) {
            return statusOrder[a.checkinStatus] - statusOrder[b.checkinStatus];
          }
          return a.name.localeCompare(b.name);
        });

        setMembers(list);
      } catch (err) {
        console.error("Error fetching team data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [user.uid]);

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
      case 'Available':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Working from Home':
        return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'Out of Office':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'On Leave':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'Not Checked In':
        return 'bg-rose-50 text-rose-500 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-100';
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
          <h1 className="text-2xl font-bold text-slate-900 font-black">Internal Directory</h1>
          <p className="text-slate-500 text-sm font-medium">Browse team members and their current status.</p>
        </div>
        <div className="relative w-full md:w-64">
          <input 
            type="text"
            placeholder="Search name, title, dept..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold shadow-sm"
          />
          <svg className="absolute left-3 top-3 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 animate-pulse">
              <div className="h-16 w-16 bg-slate-50 rounded-2xl mb-4 mx-auto"></div>
              <div className="h-4 bg-slate-50 rounded w-3/4 mb-2 mx-auto"></div>
              <div className="h-3 bg-slate-50 rounded w-1/2 mx-auto"></div>
            </div>
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
             <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
             </svg>
          </div>
          <h3 className="text-lg font-black text-slate-900">No results found</h3>
          <p className="text-slate-500 text-sm mt-1">Try a different search term.</p>
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
              {/* Profile Image */}
              <div className="relative mb-4">
                <img 
                  className={`h-20 w-20 rounded-3xl object-cover ring-4 transition-all duration-300 ${
                    member.isOnLeave 
                    ? 'grayscale ring-slate-100' 
                    : member.checkinStatus === 'Not Checked In'
                      ? 'grayscale ring-slate-100'
                      : 'ring-indigo-50 group-hover:ring-indigo-100'
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
                      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>

              <h4 className={`text-base font-black line-clamp-1 ${member.isOnLeave || member.checkinStatus === 'Not Checked In' ? 'text-slate-400' : 'text-slate-900'}`}>
                {member.name}
              </h4>
              <p className={`text-xs font-bold mb-1 ${member.isOnLeave || member.checkinStatus === 'Not Checked In' ? 'text-slate-400' : 'text-indigo-600'}`}>
                {member.title}
              </p>
              <p className="text-[10px] text-slate-400 font-bold mb-4 uppercase tracking-widest">
                {member.department}
              </p>

              {/* Status Badge */}
              <div className="mb-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${getStatusBadgeStyles(member.checkinStatus)}`}>
                  {member.checkinStatus === 'On Leave' ? `On Leave till ${member.leaveUntil}` : member.checkinStatus}
                </span>
              </div>

              <button 
                onClick={() => handleViewProfile(member)}
                className={`w-full py-2.5 rounded-2xl text-xs font-black transition-all ${
                  member.isOnLeave 
                  ? 'bg-white border border-slate-100 text-slate-400 hover:bg-slate-100' 
                  : 'bg-slate-50 text-slate-600 hover:bg-indigo-600 hover:text-white'
                }`}
              >
                View Profile
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Member Profile Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedMember(null)}
          ></div>
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-[2rem] shadow-2xl">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md px-8 py-6 border-b border-slate-100 flex items-center justify-between z-10">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Profile Details</h2>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Profile Header */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                <img 
                  className="h-32 w-32 rounded-[2rem] object-cover shadow-xl border-4 border-slate-50" 
                  src={`https://picsum.photos/seed/${selectedMember.profile.uid}/200`} 
                  alt={selectedMember.profile.name} 
                />
                <div className="text-center md:text-left pt-2">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">{selectedMember.profile.name}</h3>
                  <p className="text-indigo-600 font-bold text-lg">{selectedMember.profile.title}</p>
                  <div className="flex flex-wrap gap-4 mt-2 justify-center md:justify-start text-slate-500 font-bold text-sm">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {selectedMember.profile.department}
                    </span>
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Joined {selectedMember.profile.joiningDate}
                    </span>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedMember.profile.role}</span>
                  </div>
                </div>
              </div>

              {/* Read Only Metadata Sections (Restricted to Founders or self) */}
              {user.role === 'Founder' || user.uid === selectedMember.profile.uid ? (
                <>
                {!selectedMember.metadata ? (
                  <div className="p-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold">Confidential records (bank/docs) not yet uploaded.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Bank Details */}
                    <div className="bg-slate-50 rounded-[2rem] p-8 space-y-6">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Confidential Bank Details</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Account No.</p>
                            <p className="text-sm font-black text-slate-900 font-mono tracking-wider">{selectedMember.metadata.bankDetails.accountNumber || '---'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1">IFSC Code</p>
                            <p className="text-sm font-black text-slate-900 font-mono tracking-wider">{selectedMember.metadata.bankDetails.ifscCode || '---'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Bank Institution</p>
                          <p className="text-sm font-black text-slate-900">{selectedMember.metadata.bankDetails.bankName || '---'} ({selectedMember.metadata.bankDetails.bankBranch || '---'})</p>
                        </div>
                        {selectedMember.metadata.bankDetails.chequeDriveLink && (
                          <a 
                            href={selectedMember.metadata.bankDetails.chequeDriveLink} 
                            target="_blank" rel="noreferrer"
                            className="inline-flex items-center text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            <span>Download Proof</span>
                            <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="bg-slate-50 rounded-[2rem] p-8 space-y-6">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Document Vault</h4>
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries({
                          ...selectedMember.metadata.educationDocs,
                          ...selectedMember.metadata.personalDocs
                        }).map(([key, link]) => (
                          link ? (
                            <a 
                              key={key}
                              href={link}
                              target="_blank" rel="noreferrer"
                              className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 group transition-all"
                            >
                              <span className="text-[10px] font-black text-slate-500 uppercase truncate pr-4">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              <svg className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <div className="p-12 text-center bg-indigo-50 rounded-[2rem] border border-indigo-100">
                  <div className="mx-auto w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-4 text-indigo-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-black text-indigo-900 tracking-tight">Confidential Records Hidden</h3>
                  <p className="text-indigo-600 text-sm mt-1 max-w-sm mx-auto font-medium">Bank details and sensitive documents are only visible to the profile owner and Founders.</p>
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
