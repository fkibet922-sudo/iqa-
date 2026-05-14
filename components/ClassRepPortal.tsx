import React, { useState, useMemo, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { DataContext } from '../contexts/DataContext';
import { WeeklyScheduleInput, TimeSlot, Day, SessionInput, WeeklyTrainerReportData, Unit, DaySchedule, Trainer, Class, User, TrainerSchedule } from '../types';
import { generateWeeklyScheduleSubmissionSummary } from '../services/geminiService';
import { generatePdf } from '../services/pdfService';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, FileText, CheckCircle2, Download, Eye, ChevronRight, LayoutDashboard, Clock, User as UserIcon } from 'lucide-react';

const timeSlots: TimeSlot[] = ['08:00-10:00', '10:00-12:00', '12:00-13:00', '13:00-15:00', '15:00-17:00'];
const days: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

const initialSchedule: WeeklyScheduleInput = {
    monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}
};

const ClassRepPortal: React.FC = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const { classes, units, trainers, addTrainerSchedule, remarks, logo, unitAssignments, trainerSchedules } = useContext(DataContext);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [week, setWeek] = useState('');
  const [schedule, setSchedule] = useState<WeeklyScheduleInput>(initialSchedule);
  const [summary, setSummary] = useState('');
  const [reportData, setReportData] = useState<WeeklyTrainerReportData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingSchedule, setViewingSchedule] = useState<TrainerSchedule | null>(null);


  const repClasses = useMemo(() => {
    if (!currentUser?.department) return [];
    return classes.filter(c => c.department === currentUser.department);
  }, [classes, currentUser]);

  const pastSubmissions = useMemo(() => {
    if (!currentUser) return [];
    return trainerSchedules
      .filter(s => s.submittedBy === currentUser.id)
      .sort((a,b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [trainerSchedules, currentUser]);
  
  const selectedClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
  const unitsInClass = useMemo(() => units.filter(u => u.classId === selectedClassId), [units, selectedClassId]);

  const unitMap = useMemo(() => new Map(units.map(u => [u.id, u.name])), [units]);
  const trainerMap = useMemo(() => new Map(trainers.map(t => [t.id, t.name])), [trainers]);
  const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);

  const handleSessionChange = (day: Day, time: TimeSlot, field: keyof SessionInput, value: string) => {
    setSchedule(prev => {
        const newSchedule = JSON.parse(JSON.stringify(prev));

        if (field === 'unitId' && !value) {
            delete newSchedule[day][time];
            return newSchedule;
        }

        if (!newSchedule[day][time]) {
            newSchedule[day][time] = { unitId: '', trainerId: '', status: 'Taught' };
        }
        
        const session = newSchedule[day][time] as SessionInput;

        switch(field) {
            case 'unitId':
                session.unitId = String(value);
                // When unit changes, auto-assign the trainer
                const assignment = unitAssignments.find(a => a.unitId === value);
                session.trainerId = assignment ? assignment.trainerId : '';
                break;
            case 'trainerId':
                session.trainerId = String(value);
                break;
            case 'status':
                session.status = value as 'Taught' | 'Not Taught' | 'Assignment';
                break;
        }
        
        return newSchedule;
    });
  };
  
  const getDatesForWeek = (weekString: string): { [day: string]: string } => {
      if (!weekString || !weekString.includes('-W')) {
        const now = new Date();
        const formatDate = (date: Date) => date.toLocaleDateString('en-CA');
        return days.reduce((acc, day) => ({ ...acc, [day]: formatDate(now) }), {});
      }
      const [year, week] = weekString.split('-W').map(Number);
      const simpleDate = new Date(year, 0, 1 + (week - 1) * 7);
      const dayOfWeek = simpleDate.getDay();
      const diff = simpleDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(simpleDate.setDate(diff));
      const formatDate = (date: Date) => date.toLocaleDateString('en-CA');
      const dates: { [day: string]: string } = {};
      for (let i = 0; i < 5; i++) {
        const currentDate = new Date(monday);
        currentDate.setDate(monday.getDate() + i);
        dates[days[i]] = formatDate(currentDate);
      }
      return dates;
  };
  
  const transformScheduleToReportData = (
    scheduleInput: WeeklyScheduleInput, 
    unitsList: Unit[], 
    trainersList: Trainer[], 
    weekString: string,
    cls: Class,
    classRep: User,
  ): WeeklyTrainerReportData => {
    const unitMap = new Map(unitsList.map(u => [u.id, u.name]));
    const trainerMap = new Map(trainersList.map(t => [t.id, t.name]));
    const reportSchedule: WeeklyTrainerReportData['schedule'] = { monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {} };
    
    for (const day of days) {
        const dayScheduleInput = scheduleInput[day];
        const dayScheduleOutput: DaySchedule = {};
        for (const time in dayScheduleInput) {
            const sessionInput = dayScheduleInput[time as TimeSlot];
            if (sessionInput && sessionInput.unitId && sessionInput.trainerId) {
                dayScheduleOutput[time] = {
                    subject: unitMap.get(sessionInput.unitId) || 'Unknown Unit',
                    status: sessionInput.status,
                    trainer: trainerMap.get(sessionInput.trainerId) || 'Unknown Trainer'
                };
            }
        }
        reportSchedule[day] = dayScheduleOutput;
    }
    return { 
      department: cls.department,
      className: cls.name,
      classRepName: classRep.name,
      schedule: reportSchedule, 
      dates: getDatesForWeek(weekString),
    };
  };

  const handleSubmit = async () => {
    if (!selectedClassId || !week || !currentUser || !selectedClass) return;
    setIsSubmitting(true);
    addTrainerSchedule({ classId: selectedClassId, week, schedule, submittedBy: currentUser.id });
    const generatedReportData = transformScheduleToReportData(schedule, unitsInClass, trainers, week, selectedClass, currentUser);
    setReportData(generatedReportData);
    const result = await generateWeeklyScheduleSubmissionSummary(selectedClass.name, week);
    setSummary(result);
    setIsSubmitting(false);
  };

  const handleDownloadPdf = async (scheduleToDownload: TrainerSchedule) => {
    const classForSchedule = classes.find(c => c.id === scheduleToDownload.classId);
    const unitsForClass = units.filter(u => u.classId === scheduleToDownload.classId);
    if (!classForSchedule || !currentUser) return;

    const reportDataForPdf = transformScheduleToReportData(scheduleToDownload.schedule, unitsForClass, trainers, scheduleToDownload.week, classForSchedule, currentUser);
    const hodRemark = remarks.find(r => r.classId === scheduleToDownload.classId && r.week === scheduleToDownload.week && r.type === 'trainer');
    await generatePdf('trainer', reportDataForPdf, hodRemark, logo);
  };
  
  const resetForm = () => {
    setSummary('');
    setSelectedClassId('');
    setWeek('');
    setSchedule(initialSchedule);
    setReportData(null);
    setIsSubmitting(false);
    setViewingSchedule(null);
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-24 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 md:p-10 border-b border-slate-50 bg-slate-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Class Rep Portal</h1>
              <p className="text-slate-500 font-medium flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" />
                Weekly Trainer Performance Log
              </p>
            </div>
            <div className="flex items-center gap-4 bg-white p-2.5 pr-6 rounded-2xl border border-slate-200 shadow-sm self-start">
              <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-violet-100">
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
          {summary ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-10 bg-indigo-50/30 rounded-[2rem] border border-indigo-100 text-center"
            >
              <div className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
                <CheckCircle2 size={40} strokeWidth={2} />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Submission Confirmed</h2>
              <p className="text-slate-500 mb-8 max-w-2xl mx-auto font-medium whitespace-pre-wrap">{summary}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button onClick={() => {if(reportData && selectedClass) handleDownloadPdf({classId: selectedClassId, week, schedule, submittedBy: currentUser!.id, id: '', submittedAt:''})}} disabled={!reportData} className="btn-primary px-8 bg-teal-600 hover:bg-teal-700 shadow-teal-100">
                    <Download size={18} />
                    Download Weekly PDF
                  </button>
                  <button onClick={resetForm} className="btn-secondary px-8">
                    Submit Another Week
                  </button>
              </div>
            </motion.div>
          ) : viewingSchedule ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Reviewing Record</h2>
                  <p className="text-slate-500 font-medium">
                    Class: <span className="text-indigo-600">{classMap.get(viewingSchedule.classId)}</span> | Week: <span className="text-indigo-600">{viewingSchedule.week}</span>
                  </p>
                </div>
                <button onClick={() => setViewingSchedule(null)} className="btn-ghost">
                   Back to Editor
                </button>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-sm">
                  <table className="min-w-full border-collapse bg-white">
                      <thead>
                          <tr className="bg-slate-50/80">
                              <th className="p-4 border-b border-slate-100 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time Slot</th>
                              {days.map(day => <th key={day} className="p-4 border-b border-slate-100 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">{day}</th>)}
                          </tr>
                      </thead>
                      <tbody>
                          {timeSlots.map(time => (
                              <tr key={time} className="hover:bg-slate-50/30 transition-colors">
                                  <td className="p-4 border-b border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-600">
                                      <Clock size={14} className="text-slate-400" />
                                      <span className="font-mono text-xs font-bold">{time}</span>
                                    </div>
                                  </td>
                                  {days.map(day => {
                                    const session = viewingSchedule.schedule[day]?.[time];
                                    return (
                                      <td key={`${day}-${time}`} className="p-4 border-b border-slate-100">
                                        {session ? (
                                          <div className="space-y-1.5">
                                            <p className="text-xs font-bold text-slate-800">{unitMap.get(session.unitId)}</p>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase">
                                              <UserIcon size={10} />
                                              {trainerMap.get(session.trainerId)}
                                            </div>
                                            <span className={`badge ${
                                              session.status === 'Taught' ? 'bg-green-50 text-green-600' : 
                                              session.status === 'Not Taught' ? 'bg-rose-50 text-rose-600' : 
                                              'bg-amber-50 text-amber-600'
                                            }`}>
                                              {session.status}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Free</span>
                                        )}
                                      </td>
                                    )
                                  })}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
              <div className="flex gap-4">
                  <button onClick={() => handleDownloadPdf(viewingSchedule)} className="btn-primary flex-1 py-4 bg-teal-600 hover:bg-teal-700 shadow-teal-100">
                    <Download size={18} />
                    Download PDF Document
                  </button>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-12">
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <LayoutDashboard size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">New Weekly Log</h2>
                    <p className="text-sm text-slate-500 font-medium">Select a class and week to begin entries</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                    <div className="space-y-2">
                        <label className="label-sm">Subject Class</label>
                        <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="input-field bg-white">
                            <option value="">Select Class</option>
                            {repClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="label-sm">Reporting Week</label>
                        <input type="week" value={week} onChange={e => setWeek(e.target.value)} className="input-field bg-white disabled:opacity-50" disabled={!selectedClassId} />
                    </div>
                </div>
                
                <AnimatePresence>
                {selectedClassId && week && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-8 pt-8"
                    >
                        <div className="overflow-x-auto rounded-[2rem] border border-slate-200 overflow-hidden shadow-xl shadow-slate-100">
                            <table className="min-w-full border-collapse bg-white">
                                <thead>
                                    <tr className="bg-slate-50/80">
                                        <th className="p-4 border-b border-slate-100 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time</th>
                                        {days.map(day => <th key={day} className="p-4 border-b border-slate-100 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">{day}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeSlots.map(time => (
                                        <tr key={time} className="hover:bg-slate-50/20 transition-colors">
                                            <td className="p-4 border-b border-slate-100 bg-slate-50/20">
                                              <span className="font-mono text-xs font-bold text-slate-500">{time}</span>
                                            </td>
                                            {days.map(day => (
                                                <td key={`${day}-${time}`} className="p-2 border-b border-slate-100 align-top min-w-[160px]">
                                                    <div className="space-y-2">
                                                        <select
                                                          value={schedule[day]?.[time]?.unitId || ''}
                                                          onChange={e => handleSessionChange(day, time, 'unitId', e.target.value)}
                                                          className="w-full text-[11px] p-2 border border-slate-200 rounded-xl bg-white shadow-sm focus:border-indigo-500 transition-all outline-none"
                                                        >
                                                            <option value="">Unit...</option>
                                                            {unitsInClass.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                        </select>
                                                        {schedule[day]?.[time]?.unitId && (
                                                            <motion.div 
                                                              initial={{ opacity: 0, scale: 0.95 }}
                                                              animate={{ opacity: 1, scale: 1 }}
                                                              className="space-y-2"
                                                            >
                                                              <select
                                                                  value={schedule[day]?.[time]?.trainerId || ''}
                                                                  onChange={e => handleSessionChange(day, time, 'trainerId', e.target.value)}
                                                                  className="w-full text-[10px] p-2 border border-slate-200 rounded-xl bg-slate-50/50 font-medium"
                                                              >
                                                                  <option value="">Trainer...</option>
                                                                  {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                              </select>
                                                              <div className="flex gap-1">
                                                                {['Taught', 'Not Taught', 'Assignment'].map(status => (
                                                                  <button 
                                                                    key={status}
                                                                    onClick={() => handleSessionChange(day, time, 'status', status)}
                                                                    className={`flex-1 text-[8px] font-bold uppercase tracking-tighter py-1 rounded-md border transition-all ${
                                                                      schedule[day]?.[time]?.status === status
                                                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                                                        : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-200'
                                                                    }`}
                                                                  >
                                                                    {status.charAt(0)}
                                                                  </button>
                                                                ))}
                                                              </div>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="pt-4">
                          <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary w-full py-5 text-xl rounded-2xl">
                            {isSubmitting ? 'Processing Submission...' : 'Securely Submit Weekly Log'}
                          </button>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>
              </section>

              {/* Previous Submissions */}
              <section className="space-y-8 pt-16 border-t border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800">Historical Records</h2>
                      <p className="text-sm text-slate-500 font-medium">Archive of your previously submitted logs</p>
                    </div>
                  </div>
                  
                  {pastSubmissions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {pastSubmissions.map((submission, i) => (
                              <motion.div 
                                key={submission.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="group p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all"
                              >
                                  <div className="flex justify-between items-start mb-6">
                                    <div className="p-2 bg-indigo-50 rounded-xl">
                                      <Calendar className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <button 
                                        onClick={() => setViewingSchedule(submission)} 
                                        className="p-2 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                        title="View Details"
                                    >
                                        <Eye size={20} />
                                    </button>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{classMap.get(submission.classId)}</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Week {submission.week.split('-W')[1]}, {submission.week.split('-W')[0]}</p>
                                  </div>
                                  <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{new Date(submission.submittedAt).toLocaleDateString()}</span>
                                    <button onClick={() => handleDownloadPdf(submission)} className="flex items-center gap-2 text-xs font-bold text-teal-600 hover:translate-x-1 transition-transform">
                                      PDF <ChevronRight size={14} />
                                    </button>
                                  </div>
                              </motion.div>
                          ))}
                      </div>
                  ) : (
                      <div className="text-center p-16 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                        <FileText size={48} className="text-slate-200 mx-auto mb-4" strokeWidth={1} />
                        <p className="text-slate-400 font-medium">No submission history found.</p>
                      </div>
                  )}
              </section>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ClassRepPortal;
