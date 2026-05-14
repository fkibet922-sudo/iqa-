import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import UserManagement from './UserManagement';
import TraineeManagement from './TraineeManagement';
import AttendanceRemarks from './AttendanceRemarks';
import UnitManagement from './UnitManagement';
import ClassManagement from './ClassManagement';
import UnitAssignmentManagement from './UnitAssignmentManagement';
import ReportGeneration from './ReportGeneration';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  MessageSquareText, 
  Users, 
  UserPlus, 
  BookOpen, 
  Layers, 
  Link2, 
  ShieldCheck,
  School
} from 'lucide-react';

type HODTab = 'reports' | 'remarks' | 'trainees' | 'users' | 'units' | 'classes' | 'assignments';

const HODPortal: React.FC = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<HODTab>('reports');

  const tabs = [
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'remarks', label: 'Remarks', icon: MessageSquareText },
    { id: 'classes', label: 'Classes', icon: Layers },
    { id: 'units', label: 'Units', icon: BookOpen },
    { id: 'assignments', label: 'Assignments', icon: Link2 },
    { id: 'trainees', label: 'Trainees', icon: UserPlus },
    { id: 'users', label: 'Staff', icon: Users },
  ] as const;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'reports': return <ReportGeneration />;
      case 'users': return <UserManagement />;
      case 'trainees': return <TraineeManagement />;
      case 'units': return <UnitManagement />;
      case 'classes': return <ClassManagement />;
      case 'assignments': return <UnitAssignmentManagement />;
      case 'remarks':
      default: return <AttendanceRemarks />;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-24 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[600px]"
      >
        {/* Modern Header + Tab Bar Combined */}
        <div className="bg-slate-50/50 border-b border-slate-100">
          <div className="px-10 py-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 shadow-xl shadow-slate-200 flex items-center justify-center text-white">
                <School size={32} />
              </div>
              <div className="space-y-1">
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">HOD Portal</h1>
                <div className="flex items-center gap-3">
                  <span className="badge bg-slate-200 text-slate-700">{currentUser?.department} Department</span>
                  <p className="text-sm font-medium text-slate-400">Head of Department Oversight</p>
                </div>
              </div>
            </div>

            <nav className="flex items-center p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto scroller-hide max-w-full">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as HODTab)}
                    className={`relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                      isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="hod-active-tab"
                        className="absolute inset-0 bg-slate-900 rounded-xl"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon size={16} className={`relative z-10 ${isActive ? 'text-white' : ''}`} />
                    <span className="relative z-10 uppercase tracking-widest text-[10px]">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
        
        <div className="p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default HODPortal;
