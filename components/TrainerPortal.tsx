import React, { useState, useMemo, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { DataContext } from '../contexts/DataContext';
import { generatePdf } from '../services/pdfService';
import { SessionTraineeReportData, TraineeAttendanceRecord, PeriodicTraineeReportData } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, FileText, User, Download, Check, LayoutDashboard, ShieldCheck } from 'lucide-react';

type ReportPeriod = 'weekly' | 'monthly' | 'termly';

// --- Helper Functions for Date Calculation ---
const getWeekNumber = (d: Date): number => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

const getDateRangeOfWeek = (weekStr: string): [Date, Date] => {
    const [year, week] = weekStr.split('-W').map(Number);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    const ISOweekEnd = new Date(ISOweekStart);
    ISOweekEnd.setDate(ISOweekStart.getDate() + 6);
    return [ISOweekStart, ISOweekEnd];
};


const TrainerPortal: React.FC = () => {
  const { currentUser, logout, updateUser } = useContext(AuthContext);
  const { classes, units, trainees, logo, addTraineeAttendance, traineeAttendanceRecords, unitAssignments } = useContext(DataContext);

  // State for taking attendance
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [presentTrainees, setPresentTrainees] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [reportData, setReportData] = useState<SessionTraineeReportData | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceTime, setAttendanceTime] =useState('08:00');

  // State for generating reports
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('weekly');
  const [reportWeek, setReportWeek] = useState('');
  const [reportMonth, setReportMonth] = useState('');
  const [reportTerm, setReportTerm] = useState('1');
  const [reportClassId, setReportClassId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportError, setReportError] = useState('');

  // State for Profile section
  const [portfolioLink, setPortfolioLink] = useState(currentUser?.ePortfolioLink || '');
  const [profileMessage, setProfileMessage] = useState('');

  const trainerClasses = useMemo(() => {
    if (!currentUser?.department) return [];
    return classes.filter(c => c.department === currentUser.department);
  }, [currentUser, classes]);

  const unitsInClass = useMemo(() => {
    if (!selectedClassId || !currentUser) return [];

    // Get IDs of units assigned to the current trainer
    const assignedUnitIds = new Set(
        unitAssignments
            .filter(a => a.trainerId === currentUser.id)
            .map(a => a.unitId)
    );
    
    // Filter units for the selected class to only include assigned ones
    return units.filter(u => u.classId === selectedClassId && assignedUnitIds.has(u.id));
  }, [selectedClassId, units, unitAssignments, currentUser]);
  
  const traineesInClass = useMemo(() => trainees.filter(t => t.classId === selectedClassId).sort((a, b) => a.name.localeCompare(b.name)), [selectedClassId, trainees]);

  const handleTraineeToggle = (traineeId: string) => {
    setPresentTrainees(prev => {
      const newSet = new Set(prev);
      newSet.has(traineeId) ? newSet.delete(traineeId) : newSet.add(traineeId);
      return newSet;
    });
  };

  const handleSelectAll = () => setPresentTrainees(new Set(traineesInClass.map(t => t.id)));
  const handleDeselectAll = () => setPresentTrainees(new Set());

  const handleSubmit = async () => {
    const selectedClass = classes.find(c => c.id === selectedClassId);
    const selectedUnit = units.find(u => u.id === selectedUnitId);

    if (!selectedClass || !selectedUnit || !currentUser) return;
    
    const presentList = traineesInClass.filter(t => presentTrainees.has(t.id));
    const absentList = traineesInClass.filter(t => !presentTrainees.has(t.id));

    // Create and save historical records
    const records: TraineeAttendanceRecord[] = traineesInClass.map(trainee => ({
        traineeId: trainee.id,
        classId: selectedClassId,
        unitId: selectedUnitId,
        trainerId: currentUser.id,
        date: attendanceDate,
        time: attendanceTime,
        status: presentTrainees.has(trainee.id) ? 'present' : 'absent',
    }));
    addTraineeAttendance(records);

    const data: SessionTraineeReportData = {
        className: selectedClass.name,
        unitName: selectedUnit.name,
        trainerName: currentUser.name,
        date: attendanceDate,
        time: attendanceTime,
        presentTrainees: presentList.map(t => ({ name: t.name, admissionNumber: t.admissionNumber })),
        absentTrainees: absentList.map(t => ({ name: t.name, admissionNumber: t.admissionNumber })),
        summary: {
            present: presentList.length,
            absent: absentList.length,
            total: traineesInClass.length,
        }
    };

    setReportData(data);
    setSummaryText(`Attendance for ${selectedClass.name} on ${attendanceDate} at ${attendanceTime} submitted.`);
    setShowSummary(true);
  };

  const handleDownloadPdf = async () => {
      if (!reportData) return;
      await generatePdf('sessionTrainee', reportData, undefined, logo);
  };

  const resetForm = () => {
    setShowSummary(false);
    setSummaryText('');
    setSelectedClassId('');
    setSelectedUnitId('');
    setPresentTrainees(new Set());
    setReportData(null);
  };
  
  const handleGeneratePeriodicReport = async () => {
    if (!reportClassId || !currentUser) {
        setReportError('Please select a class.');
        return;
    }
    setIsGenerating(true);
    setReportError('');

    let startDate: Date, endDate: Date;
    let periodStr = '';

    try {
        if (reportPeriod === 'weekly') {
            if (!reportWeek) { setReportError('Please select a week.'); setIsGenerating(false); return; }
            [startDate, endDate] = getDateRangeOfWeek(reportWeek);
            periodStr = `Week: ${reportWeek}`;
        } else if (reportPeriod === 'monthly') {
            if (!reportMonth) { setReportError('Please select a month.'); setIsGenerating(false); return; }
            const [year, month] = reportMonth.split('-').map(Number);
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0);
            periodStr = `Month: ${startDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
        } else { // Termly
            const year = new Date().getFullYear();
            const startWeek = (parseInt(reportTerm) - 1) * 12 + 1;
            const endWeek = startWeek + 11;
            [startDate] = getDateRangeOfWeek(`${year}-W${startWeek}`);
            [endDate] = getDateRangeOfWeek(`${year}-W${endWeek}`);
            periodStr = `Term ${reportTerm} (${year})`;
        }
    } catch (e) {
        setReportError('Invalid date selection.');
        setIsGenerating(false);
        return;
    }
    
    const reportClass = classes.find(c => c.id === reportClassId)!;
    const traineesForClass = trainees.filter(t => t.classId === reportClassId);

    const relevantRecords = traineeAttendanceRecords.filter(rec => {
        const recordDate = new Date(rec.date);
        return rec.classId === reportClassId &&
               rec.trainerId === currentUser.id &&
               recordDate >= startDate && recordDate <= endDate;
    });

    if (relevantRecords.length === 0) {
        setReportError('No attendance records found for this period.');
        setIsGenerating(false);
        return;
    }

    const uniqueSessions = [...new Set(relevantRecords.map(r => `${r.date}-${r.time}`))].length;

    const reportGrid: PeriodicTraineeReportData['attendanceGrid'] = traineesForClass.map(trainee => {
        const traineeRecords = relevantRecords.filter(r => r.traineeId === trainee.id);
        const presentCount = traineeRecords.filter(r => r.status === 'present').length;
        const absentCount = uniqueSessions - presentCount;
        const attendancePercentage = uniqueSessions > 0 ? (presentCount / uniqueSessions) * 100 : 0;
        return {
            traineeName: trainee.name,
            admissionNumber: trainee.admissionNumber,
            presentCount,
            absentCount,
            totalSessions: uniqueSessions,
            attendancePercentage,
        };
    }).sort((a,b) => a.traineeName.localeCompare(b.traineeName));

    const periodicReportData: PeriodicTraineeReportData = {
        reportTitle: `${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)} Attendance Report`,
        period: periodStr,
        className: reportClass.name,
        trainerName: currentUser.name,
        attendanceGrid: reportGrid,
    };
    
    await generatePdf('periodicTrainee', periodicReportData, undefined, logo);

    setIsGenerating(false);
  };

  const handleUpdatePortfolio = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser) {
        updateUser(currentUser.id, { ePortfolioLink: portfolioLink });
        setProfileMessage('E-Portfolio link updated successfully!');
        setTimeout(() => setProfileMessage(''), 3000);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto pb-24 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 md:p-10 border-b border-slate-50 bg-slate-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Trainer Portal</h1>
              <p className="text-slate-500 font-medium flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-500" />
                Internal Quality Assurance Tracking
              </p>
            </div>
            <div className="flex items-center gap-4 bg-white p-2.5 pr-6 rounded-2xl border border-slate-200 shadow-sm self-start">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-100">
                {currentUser?.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{currentUser?.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{currentUser?.role}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-10 space-y-16">
          {/* --- Take Attendance Section --- */}
          <section className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Session Attendance</h2>
                  <p className="text-sm text-slate-500 font-medium">Log presence for your current teaching session</p>
                </div>
              </div>

              {showSummary ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-10 bg-indigo-50/30 rounded-[2rem] border border-indigo-100 text-center"
                >
                  <div className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
                    <Check size={40} strokeWidth={3} />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">Attendance Recorded</h2>
                  <p className="text-slate-500 mb-8 max-w-md mx-auto font-medium">{summaryText}</p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={handleDownloadPdf} className="btn-primary px-8">
                      <Download size={18} />
                      Download Session Report
                    </button>
                    <button onClick={resetForm} className="btn-secondary px-8">
                      Mark Another Session
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="label-sm">1. Class</label>
                      <select 
                        value={selectedClassId} 
                        onChange={e => { setSelectedClassId(e.target.value); setSelectedUnitId(''); }} 
                        className="input-field appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_1rem_center] bg-[length:1.25rem_1.25rem] bg-no-repeat pr-10"
                      >
                        <option value="" disabled>Select Class</option>
                        {trainerClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="label-sm">2. Unit</label>
                      <select 
                        value={selectedUnitId} 
                        onChange={e => setSelectedUnitId(e.target.value)} 
                        disabled={!selectedClassId} 
                        className="input-field appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_1rem_center] bg-[length:1.25rem_1.25rem] bg-no-repeat pr-10 disabled:opacity-50"
                      >
                        <option value="" disabled>Select Unit</option>
                        {unitsInClass.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="label-sm">3. Date</label>
                      <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="input-field font-medium text-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <label className="label-sm">4. Time</label>
                      <input type="time" value={attendanceTime} onChange={e => setAttendanceTime(e.target.value)} className="input-field font-medium text-slate-700" />
                    </div>
                  </div>

                  <AnimatePresence>
                  {selectedClassId && selectedUnitId && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-8 pt-10 border-t border-slate-100"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">5. Mark Trainee Status</h3>
                          <p className="text-sm text-slate-500 font-medium">Click to toggle presence. All new logs default to absent.</p>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
                          <span className="px-3 text-xs font-bold text-slate-500">{presentTrainees.size} / {traineesInClass.length} Present</span>
                          <div className="flex gap-1">
                            <button onClick={handleSelectAll} className="px-3 py-1.5 rounded-xl bg-white shadow-sm text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 transition-colors">Select All</button>
                            <button onClick={handleDeselectAll} className="px-3 py-1.5 rounded-xl bg-white shadow-sm text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors">Reset</button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {traineesInClass.map((trainee, index) => (
                          <motion.button
                            key={trainee.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.02 }}
                            onClick={() => handleTraineeToggle(trainee.id)}
                            className={`p-5 rounded-2xl text-left transition-all duration-300 border-2 flex items-center gap-5 relative overflow-hidden group ${
                              presentTrainees.has(trainee.id)
                                ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-100'
                                : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                               presentTrainees.has(trainee.id) 
                                ? 'bg-white/20 text-white rotate-12' 
                                : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                            }`}>
                              {presentTrainees.has(trainee.id) ? <Check size={20} strokeWidth={3} /> : <User size={20} />}
                            </div>
                            <div className="relative z-10">
                              <p className={`font-bold transition-colors ${presentTrainees.has(trainee.id) ? 'text-white' : 'text-slate-800'}`}>{trainee.name}</p>
                              <p className={`text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${presentTrainees.has(trainee.id) ? 'text-white/70' : 'text-slate-400'}`}>{trainee.admissionNumber}</p>
                            </div>
                            {presentTrainees.has(trainee.id) && (
                              <motion.div 
                                layoutId={`sparkle-${trainee.id}`}
                                className="absolute -right-2 -bottom-2 w-12 h-12 bg-white/10 rounded-full blur-xl"
                              />
                            )}
                          </motion.button>
                        ))}
                      </div>

                      <div className="pt-6">
                        <button onClick={handleSubmit} className="btn-primary w-full py-5 text-xl rounded-2xl">
                          Finalize Attendance Data
                        </button>
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              )}
          </section>

          {/* --- Generate Reports Section --- */}
          <section className="space-y-8 pt-16 border-t border-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Periodic Insights</h2>
                  <p className="text-sm text-slate-500 font-medium">Detailed PDF reports for quality assurance reviews</p>
                </div>
              </div>
              
              <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-200/50 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <label className="label-sm">Class</label>
                          <select value={reportClassId} onChange={e => setReportClassId(e.target.value)} className="input-field bg-white">
                              <option value="">Select Class</option>
                              {trainerClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-2">
                          <label className="label-sm">Report Period</label>
                          <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value as ReportPeriod)} className="input-field bg-white">
                              <option value="weekly">Weekly Analysis</option>
                              <option value="monthly">Monthly Overview</option>
                              <option value="termly">Termly Assessment (12 Weeks)</option>
                          </select>
                      </div>
                  </div>

                  <div className="space-y-2">
                      <label className="label-sm">Time Window Selection</label>
                      {reportPeriod === 'weekly' && <input type="week" value={reportWeek} onChange={e => setReportWeek(e.target.value)} className="input-field bg-white"/>}
                      {reportPeriod === 'monthly' && <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="input-field bg-white"/>}
                      {reportPeriod === 'termly' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                             {['1', '2', '3', '4'].map(t => (
                               <button 
                                 key={t}
                                 onClick={() => setReportTerm(t)}
                                 className={`px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                   reportTerm === t 
                                    ? 'bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-100' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-teal-200 hover:text-teal-600'
                                 }`}
                               >
                                 Term {t}
                               </button>
                             ))}
                          </div>
                      )}
                  </div>
                  
                  {reportError && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      className="p-4 bg-rose-50 rounded-xl border border-rose-100 flex items-center gap-3 text-rose-600"
                    >
                      <ShieldCheck size={16} />
                      <p className="text-sm font-bold tracking-tight">{reportError}</p>
                    </motion.div>
                  )}
                  
                  <button 
                    onClick={handleGeneratePeriodicReport}
                    disabled={isGenerating || !reportClassId}
                    className="btn-primary w-full bg-teal-600 hover:bg-teal-700 shadow-teal-200 py-4"
                  >
                    {isGenerating ? (
                      <div className="flex items-center gap-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                        Generating Document...
                      </div>
                    ) : (
                      <>
                        <Download size={20} />
                        Fetch PDF Attendance Report
                      </>
                    )}
                  </button>
              </div>
          </section>

          {/* --- My Profile Section --- */}
          <section className="space-y-8 pt-16 border-t border-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Account Profile</h2>
                  <p className="text-sm text-slate-500 font-medium">Professional identity and e-portfolio settings</p>
                </div>
              </div>
              
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <User size={120} />
                </div>
                
                <form onSubmit={handleUpdatePortfolio} className="relative z-10 flex flex-col sm:flex-row gap-6 items-end">
                    <div className="flex-1 space-y-2 w-full">
                        <label className="label-sm">Global E-Portfolio Link</label>
                        <input 
                            type="url"
                            value={portfolioLink}
                            onChange={e => setPortfolioLink(e.target.value)}
                            placeholder="https://your-portfolio-showcase.com"
                            className="input-field border-slate-300 focus:border-indigo-600"
                        />
                    </div>
                    <button type="submit" className="btn-primary whitespace-nowrap w-full sm:w-auto px-10 py-3.5">
                      Apply Changes
                    </button>
                </form>
                
                <AnimatePresence>
                  {profileMessage && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0 }}
                      className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3 text-green-600"
                    >
                      <CheckCircle2 size={16} />
                      <p className="text-sm font-bold leading-none">{profileMessage}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
};

export default TrainerPortal;
