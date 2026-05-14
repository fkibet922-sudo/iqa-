

import React, { useContext } from 'react';
import { AuthContext } from './contexts/AuthContext';
import { Role } from './types';
import TrainerPortal from './components/TrainerPortal';
import ClassRepPortal from './components/ClassRepPortal';
import { IQAPortal } from './components/IQAPortal';
import HODPortal from './components/HODPortal';
import UserSwitcher from './components/UserSwitcher';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, CheckCircle2, Users2, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const { currentUser, isAuthReady } = useContext(AuthContext);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="h-12 w-12 border-t-2 border-b-2 border-indigo-600 rounded-full"
        />
      </div>
    );
  }

  const renderContent = () => {
    if (!currentUser) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-12 text-center max-w-3xl px-4 py-12"
        >
          <div className="space-y-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center justify-center p-4 bg-indigo-600 rounded-3xl shadow-2xl shadow-indigo-200"
            >
              <LayoutDashboard className="w-12 h-12 text-white" strokeWidth={1.5} />
            </motion.div>
            
            <div className="space-y-4">
              <h1 className="text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
                ELADAMA RAVINE <br/>
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">IQA Master</span>
              </h1>
              <p className="text-xl text-slate-500 max-w-xl mx-auto leading-relaxed font-medium">
                A specialized Internal Quality Assurance system designed for precise monitoring and reporting.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
            {[
              { icon: CheckCircle2, title: 'Verified Data', desc: 'Secure trainer & trainee logs' },
              { icon: Users2, title: 'Role Based', desc: 'Custom portals for all staff' },
              { icon: ShieldCheck, title: 'Audited', desc: 'Integrated IQA & HOD review' }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (i * 0.1) }}
                className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-2 bg-slate-50 rounded-lg w-fit mb-4">
                  <feature.icon className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.8 }}
            className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400"
          >
            Select a role from the bar below to begin
          </motion.p>
        </motion.div>
      );
    }

    return (
      <motion.div 
        key={currentUser.role}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.02 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-7xl"
      >
        {(() => {
          switch (currentUser.role) {
            case Role.Trainer: return <TrainerPortal />;
            case Role.ClassRep: return <ClassRepPortal />;
            case Role.IQA: return <IQAPortal />;
            case Role.HOD: return <HODPortal />;
            default: return <div className="text-center p-12 bg-white rounded-3xl shadow-xl border border-slate-100">Invalid Role Profile</div>;
          }
        })()}
      </motion.div>
    );
  };

  return (
    <main className="min-h-screen bg-[#fafbfc] flex items-center justify-center p-4 pb-32">
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
      <UserSwitcher />
    </main>
  );
};


export default App;