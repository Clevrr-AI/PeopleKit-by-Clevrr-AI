
import React, { useState, useEffect } from 'react';
import { UserProfile, UserMetadata } from '../types';
import { db, collection, query, where, getDocs, doc, getDoc } from '../firebase';

interface TeamProps {
  user: UserProfile;
}

const Team: React.FC<TeamProps> = ({ user }) => {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<{ profile: UserProfile; metadata: UserMetadata | null } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const isFounder = user.role === 'Founder';

  useEffect(() => {
    const fetchTeam = async () => {
      setLoading(true);
      try {
        let q;
        if (isFounder) {
          // Founder sees everyone
          q = query(collection(db, 'users'));
        } else {
          // Manager sees only direct reports
          q = query(collection(db, 'users'), where('managerId', '==', user.uid));
        }

        const snapshot = await getDocs(q);
        const list: UserProfile[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          
          // CRITICAL: Convert Timestamp to String to avoid React error #31
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

          list.push({ 
            uid: doc.id, 
            ...data,
            joiningDate: joiningDateStr 
          } as UserProfile);
        });
        setMembers(list);
      } catch (err) {
        console.error("Error fetching team members:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [user.uid, isFounder]);

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

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
          <p className="text-slate-500 text-sm">
            {isFounder ? "Viewing all organization members." : "Viewing your direct reports."}
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <input 
            type="text"
            placeholder="Search team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
          />
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 animate-pulse">
              <div className="h-12 w-12 bg-slate-50 rounded-full mb-4"></div>
              <div className="h-4 bg-slate-50 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-slate-50 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Team Members Found</h3>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your search or contact HR for assignments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMembers.map((member) => (
            <div 
              key={member.uid} 
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center group"
            >
              <img 
                className="h-16 w-16 rounded-2xl object-cover mb-4 ring-2 ring-slate-50 group-hover:ring-indigo-50 transition-all" 
                src={`https://picsum.photos/seed/${member.uid}/200`} 
                alt={member.name} 
              />
              <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{member.name}</h4>
              <p className="text-xs text-indigo-600 font-bold mb-1">{member.title}</p>
              <p className="text-[10px] text-slate-400 font-medium mb-4 uppercase tracking-wider">{member.department}</p>
              <button 
                onClick={() => handleViewProfile(member)}
                className="w-full py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all"
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
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedMember(null)}
          ></div>
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md px-8 py-6 border-b border-slate-100 flex items-center justify-between z-10">
              <h2 className="text-xl font-black text-slate-900">Member Profile</h2>
              <button 
                onClick={() => setSelectedMember(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Profile Header */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <img 
                  className="h-24 w-24 rounded-3xl object-cover shadow-lg" 
                  src={`https://picsum.photos/seed/${selectedMember.profile.uid}/200`} 
                  alt={selectedMember.profile.name} 
                />
                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-black text-slate-900">{selectedMember.profile.name}</h3>
                  <p className="text-indigo-600 font-bold">{selectedMember.profile.title}</p>
                  <p className="text-slate-500 font-medium text-sm mt-1">{selectedMember.profile.department} • Joined {selectedMember.profile.joiningDate}</p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-widest">{selectedMember.profile.role}</span>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest">Active</span>
                  </div>
                </div>
              </div>

              {/* Read Only Metadata Sections */}
              {!selectedMember.metadata ? (
                <div className="p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-medium">No additional documents or bank details shared yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Bank Details */}
                  <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bank Details</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Account Number</p>
                        <p className="text-sm font-bold text-slate-900 font-mono">{selectedMember.metadata.bankDetails.accountNumber || '---'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">IFSC Code</p>
                          <p className="text-sm font-bold text-slate-900 font-mono">{selectedMember.metadata.bankDetails.ifscCode || '---'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Bank Name</p>
                          <p className="text-sm font-bold text-slate-900">{selectedMember.metadata.bankDetails.bankName || '---'}</p>
                        </div>
                      </div>
                      {selectedMember.metadata.bankDetails.chequeDriveLink && (
                        <a 
                          href={selectedMember.metadata.bankDetails.chequeDriveLink} 
                          target="_blank" rel="noreferrer"
                          className="inline-block text-xs font-bold text-indigo-600 hover:underline"
                        >
                          View Cheque/Passbook Proof →
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Documents */}
                  <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Employee Documents</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries({
                        ...selectedMember.metadata.educationDocs,
                        ...selectedMember.metadata.personalDocs
                      }).map(([key, link]) => (
                        link ? (
                          <a 
                            key={key}
                            href={link}
                            target="_blank" rel="noreferrer"
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 hover:border-indigo-200 group transition-colors"
                          >
                            <span className="text-[10px] font-bold text-slate-500 uppercase truncate pr-4">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <svg className="h-4 w-4 text-slate-300 group-hover:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ) : null
                      ))}
                    </div>
                  </div>
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
