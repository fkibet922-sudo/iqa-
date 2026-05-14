import React, { useState, useMemo, useContext, useEffect } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { DataContext } from '../contexts/DataContext';
import { Day, Remark, Role, TimeSlot, WeeklyTrainerReportData, WeeklyTraineeReportData } from '../types';
import ReportPreview from './ReportPreview';
import { generatePdf } from '../services/pdfService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquareText, 
  Download, 
  Eye, 
  Calendar, 
  ChevronRight, 
  CheckCircle2, 
  Clock,
  User,
  History,
  FileText
} from 'lucide-react';

// Helper to get date range of a week (YYYY-W##)
const getDateRangeOfWeek = (weekStr: string): [Date, Date] => {
    const [year, week] = weekStr.split('-W').map(Number);
    const d = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    const ISOweekEnd = new Date(ISOweekStart);
    ISOweekEnd.setDate(ISOweekStart.getDate() + 4); // Monday to Friday
    return [ISOweekStart, ISOweekEnd];
};


const AttendanceRemarks: React.FC = () => {
  const { currentUser } = useContext(AuthContext);
  const { classes, remarks, addRemark, trainerSchedules, trainees, units, trainers, traineeAttendanceRecords, logo } = useContext(DataContext);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [week, setWeek] = useState('');
  const [reportType, setReportType] = useState<'trainee' | 'trainer'>('trainee');
  const [remarkText, setRemarkText] = useState('');
  const [message, setMessage] = useState('');
  const [previewData, setPreviewData] = useState<WeeklyTrainerReportData | WeeklyTraineeReportData | null>(null);
  
  // State for post-submission flow
  const [showDownloadConfirmation, setShowDownloadConfirmation] = useState(false);
  const [dataForPdf, setDataForPdf] = useState<WeeklyTrainerReportData | WeeklyTraineeReportData | null>(null);
  const [remarkForPdf, setRemarkForPdf] = useState<Remark | null>(null);

  const isIQA = currentUser?.role === Role.IQA;

  const departmentClasses = useMemo(() => {
    if (!currentUser?.department && !isIQA) return [];
    if (isIQA) return classes;
    return classes.filter(c => c.department === currentUser!.department);
  }, [classes, currentUser, isIQA]);

  const displayedRemarks = useMemo(() => {
    const departmentClassIds = new Set(departmentClasses.map(c => c.id));
    return remarks.filter(r => departmentClassIds.has(r.classId)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [remarks, departmentClasses]);

  const currentRemark = useMemo(() => {
    if (!selectedClassId || !week) return null;
    return remarks.find(r =>
      r.classId === selectedClassId &&
      r.week === week &&
      r.type === reportType
    );
  }, [remarks, selectedClassId, week, reportType]);
  
  // When selection changes, clear the preview and reset confirmation state
  useEffect(() => {
    setPreviewData(null);
    setShowDownloadConfirmation(false);
    setDataForPdf(null);
    setRemarkForPdf(null);
  }, [selectedClassId, week, reportType]);


  useEffect(() => {
    setRemarkText(currentRemark?.remarkText || '');
  }, [currentRemark]);

  const generateAndPrepareReportData = async (
    type: 'trainee' | 'trainer',
    classId: string,
    weekStr: string
  ): Promise<WeeklyTrainerReportData | WeeklyTraineeReportData | null> => {
    if (type === 'trainer') {
        const scheduleRecord = trainerSchedules.find(s => s.classId === classId && s.week === weekStr);
        if (!scheduleRecord) return null;

        const selectedClass = classes.find(c => c.id === classId)!;
        const unitMap = new Map(units.map(u => [u.id, u.name]));
        const trainerMap = new Map(trainers.map(t => [t.id, t.name]));
        const reportSchedule: WeeklyTrainerReportData['schedule'] = { monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {} };
        const days: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

        for (const day of days) {
            const dayScheduleInput = scheduleRecord.schedule[day];
            const dayScheduleOutput: { [time: string]: { subject: string; status: string; trainer: string; } } = {};
            for (const time in dayScheduleInput) {
                const sessionInput = dayScheduleInput[time as TimeSlot];
                if (sessionInput && sessionInput.unitId && sessionInput.trainerId) {
                    dayScheduleOutput[time] = {
                        subject: String(unitMap.get(sessionInput.unitId) || 'Unknown Unit'),
                        status: String(sessionInput.status),
                        trainer: String(trainerMap.get(sessionInput.trainerId) || 'Unknown Trainer')
                    };
                }
            }
            reportSchedule[day] = dayScheduleOutput;
        }

        const dates = days.reduce((acc, day, i) => {
            const [start] = getDateRangeOfWeek(weekStr);
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);
            return { ...acc, [day]: currentDate.toLocaleDateString('en-CA')};
        }, {} as {[day: string]: string});

        return {
            department: selectedClass.department,
            className: selectedClass.name,
            classRepName: "N/A",
            schedule: reportSchedule,
            dates: dates,
        };
    } else { // trainee report
        const traineesForClass = trainees.filter(t => t.classId === classId);
        if (traineesForClass.length === 0) return null;

        const [startDate, endDate] = getDateRangeOfWeek(weekStr);
        const relevantRecords = traineeAttendanceRecords.filter(rec => {
            const recordDate = new Date(rec.date);
            return rec.classId === classId && recordDate >= startDate && recordDate <= endDate;
        });

        if (relevantRecords.length === 0) return null;

        const uniqueSessionsPerDay: Record<number, number> = {};
        for(let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                 const dateStr = d.toISOString().split('T')[0];
                 uniqueSessionsPerDay[dayOfWeek] = new Set(relevantRecords.filter(r => r.date === dateStr).map(r => r.time)).size;
            }
        }

        const totalWeeklySessions = Object.values(uniqueSessionsPerDay).reduce((sum, count) => sum + count, 0);
        let grandTotalPresent = 0;
        const attendanceGrid = traineesForClass.map(trainee => {
            const traineeRecords = relevantRecords.filter(r => r.traineeId === trainee.id);
            const dailyAttendance = { mon: '-', tue: '-', wed: '-', thu: '-', fri: '-' };
            const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            for(let i=1; i<=5; i++) {
                const dayKey = dayMap[i] as keyof typeof dailyAttendance;
                const totalSessionsOnDay = uniqueSessionsPerDay[i] || 0;
                if(totalSessionsOnDay > 0) {
                    const presentOnDay = new Set(traineeRecords.filter(r => new Date(r.date).getDay() === i && r.status === 'present').map(r => r.time)).size;
                    dailyAttendance[dayKey] = `${presentOnDay}/${totalSessionsOnDay}`;
                }
            }
            const totalPresentForTrainee = traineeRecords.filter(r => r.status === 'present').length;
            grandTotalPresent += totalPresentForTrainee;
            const weeklyPercentage = totalWeeklySessions > 0 ? (totalPresentForTrainee / totalWeeklySessions) * 100 : 0;

            return { name: trainee.name, attendance: dailyAttendance, weeklyPercentage: weeklyPercentage };
        }).sort((a,b) => a.name.localeCompare(b.name));

        const totalPossibleAttendances = totalWeeklySessions * traineesForClass.length;
        const overallPercentage = totalPossibleAttendances > 0 ? (grandTotalPresent / totalPossibleAttendances) * 100 : 0;
        
        return {
            attendanceGrid,
            summary: {
                overallPercentage: overallPercentage,
                perfectAttendance: attendanceGrid.filter(g => g.weeklyPercentage === 100).map(g => g.name),
                lowAttendance: attendanceGrid.filter(g => g.weeklyPercentage < 80).map(g => g.name),
            },
            recommendations: ""
        };
    }
  }
  
  const handlePreviewReport = async () => {
    setMessage('');
    if (!selectedClassId || !week) {
        setMessage("Please select a class and week first.");
        return;
    }
    const data = await generateAndPrepareReportData(reportType, selectedClassId, week);
    if(data) {
        setPreviewData(data);
    } else {
        setMessage(`No ${reportType} data found for the selected timeframe.`);
        setPreviewData(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !week || !remarkText || !currentUser) {
      setMessage('All fields are required.');
      return;
    }
    
    setMessage('Applying endorsement...');
    
    const newRemarkData: Omit<Remark, 'id'> = {
      classId: selectedClassId,
      week,
      type: reportType,
      remarkText,
      authorName: currentUser.name,
      authorSignature: currentUser.name,
      date: new Date().toLocaleDateString(),
    };
    addRemark(newRemarkData);

    const generatedData = await generateAndPrepareReportData(reportType, selectedClassId, week);
    
    if (generatedData) {
        setDataForPdf(generatedData);
        setRemarkForPdf({ ...newRemarkData, id: `remark-${Date.now()}` });
        setShowDownloadConfirmation(true);
        setMessage('');
        setRemarkText('');
        setPreviewData(null);
    } else {
        setRemarkForPdf(null);
        setDataForPdf(null);
        setShowDownloadConfirmation(true);
    }
  };

  const handleDownloadPdfWithRemark = () => {
    if (dataForPdf && remarkForPdf) {
        generatePdf(reportType, dataForPdf, remarkForPdf, logo);
    }
  };

  const resetFormAndContinue = () => {
      setShowDownloadConfirmation(false);
      setDataForPdf(null);
      setRemarkForPdf(null);
      setSelectedClassId('');
      setWeek('');
      setRemarkText('');
      setMessage('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <MessageSquareText size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Report Endorsement</h2>
            <p className="text-sm text-slate-500 font-medium">Add official HOD remarks to weekly logs</p>
          </div>
        </div>
        
        {showDownloadConfirmation ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-10 bg-indigo-50/30 rounded-[2.5rem] border border-indigo-100 text-center space-y-8"
            >
                <div className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-indigo-100">
                  <CheckCircle2 size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900">Remark Registered</h3>
                  <p className="text-slate-500 font-medium">The official record has been updated with your feedback.</p>
                </div>

                <div className="space-y-3">
                  {dataForPdf && remarkForPdf ? (
                      <button onClick={handleDownloadPdfWithRemark} className="btn-primary w-full py-4 bg-teal-600 hover:bg-teal-700 shadow-teal-100">
                          <Download size={18} /> Download Endorsed PDF
                      </button>
                  ) : (
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 text-sm text-slate-400 font-medium">
                        No attendance data available for PDF generation.
                      </div>
                  )}
                   <button onClick={resetFormAndContinue} className="btn-secondary w-full py-4">
                      Write Another Remark
                  </button>
                </div>
            </motion.div>
        ) : (
            <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-200/50 space-y-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="label-sm">Academic Class</label>
                        <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} required className="input-field bg-white">
                            <option value="">Select Class</option>
                            {departmentClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="label-sm">Subject Week</label>
                        <input type="week" value={week} onChange={e => setWeek(e.target.value)} required className="input-field bg-white" />
                      </div>
                    </div>

                    <div className="space-y-2">
                        <label className="label-sm">Report Category</label>
                        <div className="flex bg-white p-1 rounded-2xl border border-slate-200">
                          <button 
                            type="button"
                            onClick={() => setReportType('trainee')}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                              reportType === 'trainee' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            Trainee
                          </button>
                          <button 
                            type="button"
                            onClick={() => setReportType('trainer')}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                              reportType === 'trainer' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            Trainer
                          </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                      <label className="label-sm">Executive Remark</label>
                      <textarea
                          value={remarkText}
                          onChange={e => setRemarkText(e.target.value)}
                          required
                          placeholder={currentRemark ? "Refine existing endorsement..." : "Enter formal assessment..."}
                          className="input-field min-h-[160px] bg-white resize-none"
                          disabled={!selectedClassId || !week}
                      />
                    </div>
                    
                    <button type="submit" disabled={!selectedClassId || !week || !remarkText} className="btn-primary w-full py-4 text-lg">
                      {currentRemark ? 'Update Endorsement' : 'Commit Remark'}
                    </button>
                </form>

                <div className="pt-8 border-t border-slate-200/50">
                    <button onClick={handlePreviewReport} disabled={!selectedClassId || !week} className="btn-secondary w-full py-4">
                        <Eye size={18} /> Preview Current Data
                    </button>
                </div>
                
                <AnimatePresence>
                  {message && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-rose-50 rounded-2xl border border-rose-100 text-rose-500 text-xs font-bold text-center">
                      {message}
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>
        )}
        {previewData && <ReportPreview data={previewData} type={reportType} onClose={() => setPreviewData(null)} />}
      </section>

      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Recent Activity</h2>
              <p className="text-sm text-slate-500 font-medium">Last {displayedRemarks.length} endorsements from your department</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 max-h-[700px] overflow-y-auto scroller pr-4">
          {displayedRemarks.length > 0 ? (
            displayedRemarks.map((remark, i) => {
              const associatedClass = classes.find(c => c.id === remark.classId);
              return (
                <motion.div 
                  key={remark.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 transition-all space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{associatedClass?.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{remark.week}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          remark.type === 'trainee' ? 'bg-indigo-50 text-indigo-500' : 'bg-emerald-50 text-emerald-500'
                        }`}>
                          {remark.type}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300 text-[10px] font-bold uppercase">
                      <Clock size={12} />
                      {remark.date}
                    </div>
                  </div>
                  
                  <blockquote className="relative p-4 bg-slate-50/50 rounded-2xl border-l-4 border-indigo-500 italic text-sm text-slate-600 font-medium">
                    "{remark.remarkText}"
                  </blockquote>
                  
                  <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <User size={12} />
                    {remark.authorName}
                  </div>
                </motion.div>
              )
            })
          ) : (
            <div className="text-center py-20 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
              <MessageSquareText size={40} className="mx-auto mb-4 text-slate-200" strokeWidth={1} />
              <p className="text-slate-400 font-medium">No historical feedback on record.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AttendanceRemarks;
