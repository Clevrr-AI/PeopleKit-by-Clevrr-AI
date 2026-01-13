
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db, doc, getDoc } from '../firebase';

interface ProfileProps {
  user: UserProfile;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const [managerName, setManagerName] = useState<string>('Loading...');

  useEffect(() => {
    const fetchManager = async () => {
      if (!user.managerId) {
        setManagerName('Not Assigned');
        return;
      }
      try {
        const mgrSnap = await getDoc(doc(db, 'users', user.managerId));
        if (mgrSnap.exists()) {
          const mgrData = mgrSnap.data();
          setManagerName(mgrData.name || mgrData.displayName || 'Unnamed Manager');
        } else {
          setManagerName('Manager not found');
        }
      } catch (err) {
        console.error("Error fetching manager name:", err);
        setManagerName('Unknown');
      }
    };

    fetchManager();
  }, [user.managerId]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm">View and manage your personal employee details.</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Cover image placeholder */}
        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
        
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="p-1.5 bg-white rounded-2xl shadow-sm">
              <img 
                className="h-24 w-24 rounded-xl border-4 border-white object-cover" 
                src={`https://picsum.photos/seed/${user.uid}/200`} 
                alt={user.name} 
              />
            </div>
            <div className="flex space-x-2">
               <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100">
                 {user.role}
               </span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
            <p className="text-slate-500 font-medium">{user.title}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-8">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                <p className="text-slate-900 font-semibold">{user.name}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Job Title</label>
                <p className="text-slate-900 font-semibold">{user.title}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Department</label>
                <p className="text-slate-900 font-semibold">{user.department}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Joining Date</label>
                <p className="text-slate-900 font-semibold">{user.joiningDate}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                <p className="text-slate-900 font-semibold">{user.email}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Direct Manager</label>
                <div className="flex items-center mt-1">
                  <div className="h-6 w-6 rounded-full bg-slate-100 mr-2 flex items-center justify-center">
                    <svg className="h-3 w-3 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-indigo-600 font-bold text-sm underline cursor-pointer hover:text-indigo-800">
                    {managerName}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
