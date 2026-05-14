import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import UserManagement from './UserManagement';
import TraineeManagement from './TraineeManagement';
import SettingsManagement from './SettingsManagement';
import ReportGeneration from './ReportGeneration';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Users, UserPlus, Settings, ShieldCheck, LogOut } from 'lucide-react';

type IQATab = 'reports' | 'trainees' | 'users' | 'settings';

export const IQAPortal: React.FC = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<IQATab>('reports');

  const tabs = [
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'trainees', label: 'Trainees', icon: UserPlus },
    { id: 'users', label: 'Staff Users', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'reports': return <ReportGeneration />;
      case 'users': return <UserManagement />;
      case 'trainees': return <TraineeManagement />;
      case 'settings': return <SettingsManagement />;
      default: return <ReportGeneration />;
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
          <div className="px-10 py-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-100 flex items-center justify-center text-white">
                <ShieldCheck size={32} />
              </div>
              <div className="space-y-1">
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">IQA Executive</h1>
                <div className="flex items-center gap-3">
                  <span className="badge bg-indigo-100 text-indigo-600">Administrator</span>
                  <p className="text-sm font-medium text-slate-400">Manage institutional quality standards</p>
                </div>
              </div>
            </div>

            <nav className="flex items-center p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto scroller-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                      isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="active-tab"
                        className="absolute inset-0 bg-slate-900 rounded-xl"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon size={16} className={`relative z-10 ${isActive ? 'text-white' : ''}`} />
                    <span className="relative z-10 uppercase tracking-widest text-[11px]">{tab.label}</span>
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
              transition={{ duration: 0.3 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
