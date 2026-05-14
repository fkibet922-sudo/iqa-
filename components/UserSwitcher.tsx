import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Role } from '../types';
import { Users, Shield, UserCheck, GraduationCap, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const UserSwitcher: React.FC = () => {
  const { users, currentUser, loginAs, logout } = useContext(AuthContext);

  const roles = [
    { id: Role.Trainer, label: 'Trainer', icon: GraduationCap, user: users.find(u => u.role === Role.Trainer) },
    { id: Role.ClassRep, label: 'Class Rep', icon: Users, user: users.find(u => u.role === Role.ClassRep) },
    { id: Role.IQA, label: 'IQA', icon: Shield, user: users.find(u => u.role === Role.IQA) },
    { id: Role.HOD, label: 'HOD', icon: UserCheck, user: users.find(u => u.role === Role.HOD) },
  ];

  return (
    <motion.div 
      initial={{ y: 100, x: '-50%', opacity: 0 }}
      animate={{ y: 0, x: '-50%', opacity: 1 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/40 rounded-full px-2 py-2 flex items-center gap-1 z-[9999]"
    >
      <div className="px-4 py-1.5 hidden md:block">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Switch Role</span>
      </div>
      
      {roles.map((role) => {
        const Icon = role.icon;
        const isActive = currentUser?.role === role.id;
        
        return (
          <button 
            key={role.id}
            onClick={() => role.user && loginAs(role.user.id)}
            className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 group ${
              isActive 
                ? 'text-white' 
                : 'text-slate-600 hover:bg-slate-100/50'
            }`}
          >
            {isActive && (
              <motion.div 
                layoutId="active-pill"
                className="absolute inset-0 bg-indigo-600 rounded-full shadow-lg shadow-indigo-200"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Icon size={18} className={`relative z-10 ${isActive ? 'text-white' : 'text-slate-500 transition-transform group-hover:scale-110'}`} />
            <span className="relative z-10 hidden sm:inline">{role.label}</span>
          </button>
        );
      })}

      <div className="w-px h-8 bg-slate-200/60 mx-2" />

      <button 
        onClick={logout}
        className="p-2.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-90"
        title="Logout"
      >
        <LogOut size={20} />
      </button>
    </motion.div>
  );
};

export default UserSwitcher;
