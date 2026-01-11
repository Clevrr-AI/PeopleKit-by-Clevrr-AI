import React, { useState } from 'react';
import { useHR } from '../App';
import { Employee, Role, Department } from '../types';
import { Plus, Search, Edit2, X, Loader2, Save } from 'lucide-react';
import { createEmployeeInFirebase } from '../services/firebase';

const EmployeeList: React.FC = () => {
  const { employees, setEmployees } = useHR();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');

  // Form State
  const initialFormState: Partial<Employee> = {
    name: '',
    email: '',
    role: Role.EMPLOYEE,
    title: '',
    department: Department.ENGINEERING,
    managerId: '',
    joiningDate: new Date().toISOString().split('T')[0],
    baseSalary: 50000,
    allowances: { hra: 0, travel: 0, other: 0 },
    taxDeduction: 0,
    isActive: true,
  };
  const [formData, setFormData] = useState<Partial<Employee>>(initialFormState);

  const handleOpenModal = (employee?: Employee) => {
    if (employee) {
      setEditingId(employee.id);
      setFormData(employee);
      setPassword(''); // Password edit not supported in this simple view
    } else {
      setEditingId(null);
      setFormData(initialFormState);
      setPassword('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      if (editingId) {
        // Edit Logic (Local State for now, strictly per prompt request to focus on ADD)
        setEmployees((prev) =>
          prev.map((e) => (e.id === editingId ? ({ ...formData, id: editingId } as Employee) : e))
        );
      } else {
        // Create Logic (Firebase)
        if (!password) {
            alert("Password is required for new employees");
            setIsSubmitting(false);
            return;
        }

        // 1. Call Firebase Service
        const newUid = await createEmployeeInFirebase(formData, password);

        // 2. Update Local State (So UI reflects changes immediately)
        const newEmp = {
          ...formData,
          id: newUid,
          allowances: formData.allowances || { hra: 0, travel: 0, other: 0 },
        } as Employee;
        setEmployees((prev) => [...prev, newEmp]);
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving employee:", error);
      alert(`Failed to save: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employee Management</h1>
          <p className="text-slate-500">Manage roles, departments, and compensation.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or department..."
          className="flex-1 outline-none text-slate-700"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-sm uppercase">
            <tr>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Dept</th>
              <th className="p-4 font-medium">Salary (Base)</th>
              <th className="p-4 font-medium">Joined</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEmployees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition">
                <td className="p-4">
                  <div className="font-medium text-slate-900">{emp.name}</div>
                  <div className="text-xs text-slate-400">{emp.email}</div>
                  <div className="text-xs text-slate-500 italic mt-0.5">{emp.title}</div>
                </td>
                <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        emp.role === Role.FOUNDER ? 'bg-purple-100 text-purple-700' :
                        emp.role === Role.MANAGER ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                    }`}>
                        {emp.role}
                    </span>
                </td>
                <td className="p-4 text-slate-600">{emp.department}</td>
                <td className="p-4 font-mono text-slate-700">${emp.baseSalary.toLocaleString()}</td>
                <td className="p-4 text-slate-500">{emp.joiningDate}</td>
                <td className="p-4 text-right">
                  <button onClick={() => handleOpenModal(emp)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredEmployees.length === 0 && (
          <div className="p-8 text-center text-slate-400">No employees found.</div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? 'Edit Employee' : 'New Employee'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.email}
                  disabled={!!editingId}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              {!editingId && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password (For Account Creation)</label>
                    <input
                      type="password"
                      className="w-full border border-slate-300 rounded-lg p-2"
                      value={password}
                      placeholder="Min 6 characters"
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
              )}

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                <input
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.title}
                  placeholder="e.g. Senior Engineer"
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

               <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Joining</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.joiningDate}
                  onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value as Department })}
                >
                  {Object.values(Department).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                >
                  {Object.values(Role).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Manager</label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                >
                  <option value="">Select Reporting Manager</option>
                  {employees
                    .filter(e => e.id !== editingId && (e.role === Role.MANAGER || e.role === Role.FOUNDER))
                    .map((e) => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 border-t border-slate-100 my-2 pt-2">
                <h3 className="font-semibold text-slate-800 mb-2">Compensation</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base Salary</label>
                <input
                  type="number"
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.baseSalary}
                  onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                />
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Tax Deductions</label>
                 <input
                  type="number"
                  className="w-full border border-slate-300 rounded-lg p-2"
                  value={formData.taxDeduction}
                  onChange={(e) => setFormData({ ...formData, taxDeduction: Number(e.target.value) })}
                />
              </div>

               <div className="col-span-2 grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">HRA</label>
                    <input
                      type="number"
                      className="w-full border border-slate-200 rounded p-1 text-sm"
                      value={formData.allowances?.hra}
                      onChange={(e) => setFormData({ ...formData, allowances: { ...formData.allowances!, hra: Number(e.target.value) } })}
                    />
                  </div>
                   <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Travel</label>
                    <input
                      type="number"
                      className="w-full border border-slate-200 rounded p-1 text-sm"
                      value={formData.allowances?.travel}
                      onChange={(e) => setFormData({ ...formData, allowances: { ...formData.allowances!, travel: Number(e.target.value) } })}
                    />
                  </div>
                   <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Other</label>
                    <input
                      type="number"
                      className="w-full border border-slate-200 rounded p-1 text-sm"
                      value={formData.allowances?.other}
                      onChange={(e) => setFormData({ ...formData, allowances: { ...formData.allowances!, other: Number(e.target.value) } })}
                    />
                  </div>
               </div>

            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Update Employee' : 'Create & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;