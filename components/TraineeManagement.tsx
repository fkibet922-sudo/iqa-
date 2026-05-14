import React, { useContext, useState, useMemo } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { Role } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  Users, 
  Search, 
  GraduationCap,
  Building,
  CheckCircle2,
  AlertCircle,
  Hash
} from 'lucide-react';

const TraineeManagement: React.FC = () => {
  const { trainees, addTrainee, classes } = useContext(DataContext);
  const { currentUser } = useContext(AuthContext);

  const [name, setName] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [classId, setClassId] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isHOD = currentUser?.role === Role.HOD;

  const departmentClasses = useMemo(() => {
    if (isHOD) {
        return classes.filter(c => c.department === currentUser?.department);
    }
    return classes;
  }, [classes, currentUser, isHOD]);

  const displayedTrainees = useMemo(() => {
    let filtered = trainees;
    if (isHOD) {
        const departmentClassIds = new Set(departmentClasses.map(c => c.id));
        filtered = trainees.filter(t => departmentClassIds.has(t.classId));
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(term) || 
        t.admissionNumber.toLowerCase().includes(term)
      );
    }
    
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [trainees, departmentClasses, isHOD, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !admissionNumber || !classId) {
      setMessage({ text: 'Incomplete trainee data.', type: 'error' });
      return;
    }
    const success = await addTrainee(name, admissionNumber, classId);
    if (success) {
      setMessage({ text: `${name} has been enrolled successfully.`, type: 'success' });
      setName('');
      setAdmissionNumber('');
      setClassId('');
      setTimeout(() => setMessage(null), 4000);
    } else {
      setMessage({ text: `Admission number ${admissionNumber} is already registered.`, type: 'error' });
    }
  };

  const classMap = new Map(classes.map(c => [c.id, c.name]));

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Add Trainee Form */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Enroll Trainee</h2>
              <p className="text-sm text-slate-500 font-medium">Add a new student to the academic records</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="label-sm">FullName</label>
              <div className="relative">
                <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Trainee Name" required className="input-field pl-12 bg-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="label-sm">Admission No.</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" value={admissionNumber} onChange={e => setAdmissionNumber(e.target.value)} placeholder="Reg 001/2024" required className="input-field pl-12 bg-white" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label-sm">Assigned Class</label>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select value={classId} onChange={e => setClassId(e.target.value)} required className="input-field pl-12 bg-white appearance-none font-bold">
                      <option value="" disabled>Select Class</option>
                      {departmentClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button type="submit" className="btn-primary w-full py-4">
                Register New Trainee
              </button>
            </div>

            <AnimatePresence>
              {message && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
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

        {/* Existing Trainees List */}
        <section className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Active Roster</h2>
                <p className="text-sm text-slate-500 font-medium">{displayedTrainees.length} total trainees listed</p>
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Find trainee..."
                className="input-field pl-10 py-2 min-w-[200px]"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto scroller pr-4">
            {displayedTrainees.length > 0 ? (
              displayedTrainees.map((trainee, i) => (
                <motion.div 
                  key={trainee.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl hover:shadow-slate-200/40 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {trainee.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-none mb-1">{trainee.name}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{trainee.admissionNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="badge bg-slate-100 text-slate-600 font-black">
                      {classMap.get(trainee.classId) || 'NO CLASS'}
                    </span>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
                <Users size={40} className="mx-auto mb-4 text-slate-200" strokeWidth={1} />
                <p className="text-slate-400 font-medium">No trainees match your criteria.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TraineeManagement;
