
import React, { useState, useEffect } from 'react';
import { UserProfile, UserMetadata } from '../types';
import { db, doc, getDoc, setDoc } from '../firebase';

interface ProfileProps {
  user: UserProfile;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const [managerName, setManagerName] = useState<string>('Loading...');
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState<UserMetadata>({
    bankDetails: {
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      bankBranch: '',
      chequeDriveLink: '',
    },
    educationDocs: {
      marksheet10th: '',
      marksheet12th: '',
      collegeDegree: '',
      lastPayslip: '',
    },
    personalDocs: {
      offerLetter: '',
      codeOfConduct: '',
      aadhaarCard: '',
      panCard: '',
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      // Fetch manager
      if (!user.managerId) {
        setManagerName('Not Assigned');
      } else {
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
      }

      // Fetch metadata
      try {
        const metaSnap = await getDoc(doc(db, 'userMetadata', user.uid));
        if (metaSnap.exists()) {
          setMetadata(metaSnap.data() as UserMetadata);
        }
      } catch (err) {
        console.error("Error fetching user metadata:", err);
      } finally {
        setLoadingMetadata(false);
      }
    };

    fetchData();
  }, [user.uid, user.managerId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'userMetadata', user.uid), metadata);
      alert("Profile metadata updated successfully!");
    } catch (err) {
      console.error("Error saving metadata:", err);
      alert("Failed to save profile details.");
    } finally {
      setSaving(false);
    }
  };

  const updateNestedField = (category: keyof UserMetadata, field: string, value: string) => {
    setMetadata((prev) => ({
      ...prev,
      [category]: {
        ...(prev[category] as any),
        [field]: value,
      },
    }));
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-500 text-sm">View and manage your personal employee details.</p>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Department</label>
                <p className="text-slate-900 font-semibold">{user.department}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Direct Manager</label>
                <p className="text-indigo-600 font-bold text-sm">{managerName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Bank Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-900">Bank Details</h3>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Account Number</label>
              <input 
                type="text"
                required
                value={metadata.bankDetails.accountNumber}
                onChange={(e) => updateNestedField('bankDetails', 'accountNumber', e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">IFSC Code</label>
              <input 
                type="text"
                required
                value={metadata.bankDetails.ifscCode}
                onChange={(e) => updateNestedField('bankDetails', 'ifscCode', e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Bank Name</label>
              <input 
                type="text"
                required
                value={metadata.bankDetails.bankName}
                onChange={(e) => updateNestedField('bankDetails', 'bankName', e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Bank Branch</label>
              <input 
                type="text"
                required
                value={metadata.bankDetails.bankBranch}
                onChange={(e) => updateNestedField('bankDetails', 'bankBranch', e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Cheque/Passbook (Google Drive Link - Optional)</label>
              <input 
                type="url"
                placeholder="https://drive.google.com/..."
                value={metadata.bankDetails.chequeDriveLink}
                onChange={(e) => updateNestedField('bankDetails', 'chequeDriveLink', e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* Education Documents */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-900">Education Documents</h3>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">10th Marksheet (Link)</label>
                <input 
                  type="url" required placeholder="https://drive.google.com/..."
                  value={metadata.educationDocs.marksheet10th}
                  onChange={(e) => updateNestedField('educationDocs', 'marksheet10th', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">12th Marksheet (Link)</label>
                <input 
                  type="url" required placeholder="https://drive.google.com/..."
                  value={metadata.educationDocs.marksheet12th}
                  onChange={(e) => updateNestedField('educationDocs', 'marksheet12th', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">College Degree / Semester Marksheet (Link)</label>
                <input 
                  type="url" required placeholder="https://drive.google.com/..."
                  value={metadata.educationDocs.collegeDegree}
                  onChange={(e) => updateNestedField('educationDocs', 'collegeDegree', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Employment Payslip (Link - Optional)</label>
                <input 
                  type="url" placeholder="https://drive.google.com/..."
                  value={metadata.educationDocs.lastPayslip}
                  onChange={(e) => updateNestedField('educationDocs', 'lastPayslip', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Personal Documents */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-900">Personal Documents</h3>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Offer Letter (Link)</label>
                <input 
                  type="url" required placeholder="https://drive.google.com/..."
                  value={metadata.personalDocs.offerLetter}
                  onChange={(e) => updateNestedField('personalDocs', 'offerLetter', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Code of Conduct (Link)</label>
                <input 
                  type="url" required placeholder="https://drive.google.com/..."
                  value={metadata.personalDocs.codeOfConduct}
                  onChange={(e) => updateNestedField('personalDocs', 'codeOfConduct', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aadhaar Card (Link)</label>
                <input 
                  type="url" required placeholder="https://drive.google.com/..."
                  value={metadata.personalDocs.aadhaarCard}
                  onChange={(e) => updateNestedField('personalDocs', 'aadhaarCard', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">PAN Card (Link)</label>
                <input 
                  type="url" required placeholder="https://drive.google.com/..."
                  value={metadata.personalDocs.panCard}
                  onChange={(e) => updateNestedField('personalDocs', 'panCard', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            type="submit"
            disabled={saving}
            className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {saving ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : null}
            <span>Update Profile Details</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
