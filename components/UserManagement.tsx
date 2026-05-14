import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Role, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  Users, 
  Mail, 
  Lock, 
  Building, 
  Shield, 
  ExternalLink, 
  Edit3, 
  Trash2,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const UserManagement: React.FC = () => {
  const { currentUser, users, addUser, updateUser, deleteUser } = useContext(AuthContext);

  // State for the "Add User" form
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(currentUser?.role === Role.IQA ? Role.HOD : Role.Trainer);
  const [department, setDepartment] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // State for the "Edit User" modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<Role>(Role.Trainer);
  const [editDepartment, setEditDepartment] = useState('');
  const [editEPortfolioLink, setEditEPortfolioLink] = useState('');

  // Set initial department for HOD
  useEffect(() => {
    if (currentUser?.role === Role.HOD) {
      setDepartment(currentUser.department || '');
    }
  }, [currentUser]);

  const isIQA = currentUser?.role === Role.IQA;

  const displayUsers = useMemo(() => {
    if (isIQA) {
      return users.filter(u => u.role !== Role.IQA);
    }
    return users.filter(u => u.department === currentUser?.department && u.id !== currentUser?.id);
  }, [users, currentUser, isIQA]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!name || !username || !password || !role || !department) {
      setMessage({ text: 'All fields are mandatory.', type: 'error' });
      return;
    }
    const success = await addUser({
      name,
      username,
      password,
      role,
      department,
      ePortfolioLink: '',
    });
    if (success) {
      setMessage({ text: `Account for ${name} created successfully!`, type: 'success' });
      setName('');
      setUsername('');
      setPassword('');
      if (isIQA) {
          setDepartment('');
          setRole(Role.HOD);
      }
      setTimeout(() => setMessage(null), 4000);
    } else {
      setMessage({ text: `The username "${username}" is already taken.`, type: 'error' });
    }
  };
  
  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditPassword('');
    setEditRole(user.role);
    setEditDepartment(user.department || '');
    setEditEPortfolioLink(user.ePortfolioLink || '');
    setIsModalOpen(true);
  };
  
  const closeEditModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };
  
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    const updatedData: Partial<Omit<User, 'id' | 'username'>> = {
      name: editName,
      role: editRole,
      department: editDepartment,
      ePortfolioLink: editEPortfolioLink,
    };
    
    if (editPassword) {
      updatedData.password = editPassword;
    }
    
    await updateUser(editingUser.id, updatedData);
    closeEditModal();
  };
  
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (window.confirm(`Permanently delete account for "${userName}"?`)) {
      await deleteUser(userId);
    }
  };

  return (
    <div className="space-y-12">
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg relative overflow-hidden"
            >
              <button 
                onClick={closeEditModal}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400"
              >
                <X size={20} />
              </button>

              <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Edit Profile</h2>
                <p className="text-slate-500 font-medium">Modifying credentials for <span className="text-indigo-600 font-bold">{editingUser?.name}</span></p>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-6">
                <div className="space-y-2">
                  <label className="label-sm">Display Name</label>
                  <div className="relative">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required className="input-field pl-12" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label-sm">Security Role</label>
                    <select value={editRole} onChange={e => setEditRole(e.target.value as Role)} required className="input-field appearance-none bg-white font-bold">
                      {isIQA && <option value={Role.HOD}>Department Head</option>}
                      <option value={Role.Trainer}>Trainer</option>
                      <option value={Role.ClassRep}>Representative</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="label-sm">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Keep current" className="input-field pl-12" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label-sm">Assigned Department</label>
                  <div className="relative">
                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      value={editDepartment} 
                      onChange={e => setEditDepartment(e.target.value)} 
                      required 
                      disabled={!isIQA}
                      className="input-field pl-12 disabled:bg-slate-50 disabled:text-slate-400" 
                    />
                  </div>
                </div>

                {editRole === Role.Trainer && (
                  <div className="space-y-2">
                      <label className="label-sm">E-Portfolio Address</label>
                      <div className="relative">
                        <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="url" value={editEPortfolioLink} onChange={e => setEditEPortfolioLink(e.target.value)} placeholder="https://..." className="input-field pl-12" />
                      </div>
                  </div>
                )}

                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={closeEditModal} className="btn-secondary flex-1 py-4">Cancel</button>
                  <button type="submit" className="btn-primary flex-1 py-4">Commit Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Add User Form */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Onboard Staff</h2>
              <p className="text-sm text-slate-500 font-medium">Provision new accounts for the department</p>
            </div>
          </div>

          <form onSubmit={handleAddUser} className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="label-sm">Identify Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full legal name" required className="input-field bg-white" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="label-sm">Legacy Username</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="unique_handle" required className="input-field pl-12 bg-white" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label-sm">Initial Secret</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="input-field pl-12 bg-white" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="label-sm">Operational Department</label>
                <input 
                  type="text" 
                  value={department} 
                  onChange={e => setDepartment(e.target.value)} 
                  required 
                  disabled={!isIQA}
                  placeholder="Business / IT / Engineering" 
                  className="input-field bg-white disabled:bg-slate-100 disabled:text-slate-400" 
                />
              </div>
              <div className="space-y-2">
                <label className="label-sm">Security Privilege</label>
                <select value={role} onChange={e => setRole(e.target.value as Role)} required className="input-field bg-white font-bold">
                  {isIQA && <option value={Role.HOD}>Department Head</option>}
                  <option value={Role.Trainer}>Subject Trainer</option>
                  <option value={Role.ClassRep}>Class Student Rep</option>
                </select>
              </div>
            </div>

            <div className="pt-4">
              <button type="submit" className="btn-primary w-full py-4 text-lg">
                Activate User Account
              </button>
            </div>

            <AnimatePresence>
              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold ${
                    message.type === 'success' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </section>

        {/* Existing Users List */}
        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Active Directory</h2>
                <p className="text-sm text-slate-500 font-medium">Current personnel within {isIQA ? 'the system' : currentUser?.department}</p>
              </div>
            </div>
            <div className="badge border border-slate-200 text-slate-400 font-black">
              {displayUsers.length} MEMBERS
            </div>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 scroller">
            {displayUsers.length > 0 ? (
              [...displayUsers].sort((a, b) => a.name.localeCompare(b.name)).map((user, i) => (
                <motion.div 
                  key={user.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-black group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {user.name.charAt(0)}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 leading-none">{user.name}</p>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          user.role === Role.HOD ? 'bg-amber-100 text-amber-700' : 
                          user.role === Role.Trainer ? 'bg-indigo-100 text-indigo-700' : 
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-400">@{user.username} • {user.department}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    {user.role === Role.Trainer && user.ePortfolioLink && (
                      <a href={user.ePortfolioLink} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="View Portfolio">
                        <ExternalLink size={18} />
                      </a>
                    )}
                    <button onClick={() => openEditModal(user)} className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="Edit User">
                      <Edit3 size={18} />
                    </button>
                    <button onClick={() => handleDeleteUser(user.id, user.name)} className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all" title="Delete Account">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
                <Users size={48} className="mx-auto mb-4 text-slate-200" strokeWidth={1} />
                <p className="text-slate-400 font-medium">No personnel discovered in this directory.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default UserManagement;
