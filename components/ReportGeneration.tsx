import React, { useState, useMemo, useContext } from 'react';
import { DataContext } from '../contexts/DataContext';
import { AuthContext } from '../contexts/AuthContext';
import { Day, WeeklyTrainerReportData, WeeklyTraineeReportData, TimeSlot, Role, TraineeAttendanceRecord, PercentageReportData, PercentageReportItem } from '../types';
import ReportPreview from './ReportPreview';
import { generatePdf } from '../services/pdfService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Download, 
  Eye, 
  Calendar, 
  Settings2, 
  ChevronRight, 
  Search, 
  BarChart4, 
  Filter,
  ArrowRight,
  School,
  Clock
} from 'lucide-react';

// Helper to get date range of a week (YYYY-W##)
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
    ISOweekEnd.setDate(ISOweekStart.getDate() + 4); // Monday to Friday
    return [ISOweekStart, ISOweekEnd];
};

const getDatesOfWeek = (weekStr: string): Date[] => {
    const [year, week] = weekStr.split('-W').map(Number);
    const d = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    d.setUTCDate(d.getUTCDate() + 1 - (d.getUTCDay() || 7));
    
    const dates: Date[] = [];
    for (let i = 0; i < 5; i++) { 
        const dayDate = new Date(d);
        dayDate.setUTCDate(d.getUTCDate() + i);
        dates.push(dayDate);
    }
    return dates;
};

const ReportGeneration: React.FC = () => {
  const { classes, remarks, trainerSchedules, trainees, units, trainers, traineeAttendanceRecords, logo } = useContext(DataContext);
  const { currentUser } = useContext(AuthContext);

  const isHOD = currentUser?.role === Role.HOD;

  // State for weekly reports
  const [selectedDepartment, setSelectedDepartment] = useState(isHOD ? currentUser?.department || '' : '');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [week, setWeek] = useState('');
  const [reportType, setReportType] = useState<'trainee' | 'trainer'>('trainee');
  const [message, setMessage] = useState('');
  const [previewData, setPreviewData] = useState<WeeklyTrainerReportData | WeeklyTraineeReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // State for aggregate reports
  const [aggStartDate, setAggStartDate] = useState('');
  const [aggEndDate, setAggEndDate] = useState('');
  const [aggSubject, setAggSubject] = useState<'trainees' | 'trainers'>('trainees');
  const [aggGroupBy, setAggGroupBy] = useState<'class' | 'individual' | 'department' | 'overall'>('class');
  const [aggMessage, setAggMessage] = useState('');
  const [aggIsLoading, setAggIsLoading] = useState(false);
  const [aggReportData, setAggReportData] = useState<PercentageReportData | null>(null);

  const departments = useMemo(() => [...new Set(classes.map(c => c.department))].sort(), [classes]);

  const filteredClasses = useMemo(() => {
    if (!selectedDepartment) return isHOD ? classes.filter(c => c.department === currentUser?.department) : [];
    return classes.filter(c => c.department === selectedDepartment);
  }, [classes, selectedDepartment, isHOD, currentUser]);
  
  const generateAndPrepareWeeklyReportData = async (
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

  const handleWeeklyAction = async (action: 'preview' | 'download') => {
    setMessage('');
    setPreviewData(null);
    if (!selectedClassId || !week) {
        setMessage("Please select a department, class, and week.");
        return;
    }
    setIsLoading(true);
    const data = await generateAndPrepareWeeklyReportData(reportType, selectedClassId, week);
    
    if(!data) {
        setMessage(`No ${reportType} records available for the selected week.`);
        setIsLoading(false);
        return;
    }

    if(action === 'preview') {
        setPreviewData(data);
    } else {
        const hodRemark = remarks.find(r => r.classId === selectedClassId && r.week === week && r.type === reportType);
        await generatePdf(reportType, data, hodRemark, logo);
    }

    setIsLoading(false);
  };
  
  const handleGenerateAggregateReport = async () => {
    setAggMessage('');
    setAggReportData(null);
    if (!aggStartDate || !aggEndDate) {
      setAggMessage('Date boundaries are required.');
      return;
    }
    setAggIsLoading(true);

    const period = `${aggStartDate} to ${aggEndDate}`;
    const start = new Date(aggStartDate);
    const end = new Date(aggEndDate);
    end.setHours(23, 59, 59, 999);

    let title = '';
    const items: PercentageReportItem[] = [];
    let grandTotalPresent = 0;
    let grandTotalSessions = 0;

    const departmentScope = isHOD ? currentUser.department : null;

    if (aggSubject === 'trainees') {
        const relevantRecords = traineeAttendanceRecords.filter(r => {
            const recordDate = new Date(r.date);
            const classDept = classes.find(c => c.id === r.classId)?.department;
            if (departmentScope && classDept !== departmentScope) return false;
            return recordDate >= start && recordDate <= end;
        });

        if (relevantRecords.length === 0) {
            setAggMessage('No records found for the specified timeframe.');
            setAggIsLoading(false);
            return;
        }

        const traineeMap = new Map<string, string>(trainees.map(t => [t.id, t.name]));
        const classMap = new Map<string, { name: string; department: string }>(classes.map(c => [c.id, { name: c.name, department: c.department }]));

        let groups: Map<string, TraineeAttendanceRecord[]>;

        switch (aggGroupBy) {
            case 'individual':
                title = 'Trainee Attendance: Individual Breakdown';
                groups = groupBy(relevantRecords, 'traineeId');
                break;
            case 'class':
                title = 'Trainee Attendance: Class Breakdown';
                groups = groupBy(relevantRecords, 'classId');
                break;
            case 'department':
                title = 'Trainee Attendance: Department Breakdown';
                groups = new Map<string, TraineeAttendanceRecord[]>();
                relevantRecords.forEach(r => {
                    const dept = classMap.get(r.classId)?.department;
                    if (dept) {
                        if (!groups.has(dept)) groups.set(dept, []);
                        groups.get(dept)!.push(r);
                    }
                });
                break;
            case 'overall':
            default:
                title = 'Institutional Trainee Attendance Overview';
                groups = new Map([['overall', relevantRecords]]);
                break;
        }

        groups.forEach((records, key) => {
            const presentCount = records.filter(r => r.status === 'present').length;
            const totalSessions = records.length;
            const percentage = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;
            
            let name = 'Overall';
            if (aggGroupBy === 'individual') name = traineeMap.get(key) || 'Unknown Trainee';
            if (aggGroupBy === 'class') name = classMap.get(key)?.name || 'Unknown Class';
            if (aggGroupBy === 'department') name = key;

            items.push({ id: key, name, presentCount, totalSessions, percentage });
        });

    } else { // Trainers
        const flatSessions: { trainerId: string, status: string, date: Date, classId: string, department: string }[] = [];
        const relevantSchedules = trainerSchedules.filter(s => {
            const classDept = classes.find(c => c.id === s.classId)?.department;
            if (departmentScope && classDept !== departmentScope) return false;
            const [weekStart] = getDateRangeOfWeek(s.week);
            return weekStart <= end; 
        });

        relevantSchedules.forEach(schedule => {
            const dates = getDatesOfWeek(schedule.week);
            days.forEach((day, i) => {
                const daySessions = schedule.schedule[day];
                if (daySessions) {
                    for (const time in daySessions) {
                        const session = daySessions[time as TimeSlot];
                        const sessionDate = dates[i];
                        if (session && sessionDate >= start && sessionDate <= end) {
                            flatSessions.push({
                                trainerId: session.trainerId,
                                status: session.status,
                                date: sessionDate,
                                classId: schedule.classId,
                                department: classes.find(c => c.id === schedule.classId)?.department || ''
                            });
                        }
                    }
                }
            });
        });

        if (flatSessions.length === 0) {
            setAggMessage('No trainer data available for this range.');
            setAggIsLoading(false);
            return;
        }
        
        const trainerMap = new Map<string, string>(trainers.map(t => [t.id, t.name]));
        const classMap = new Map<string, { name: string; department: string }>(classes.map(c => [c.id, { name: c.name, department: c.department }]));

        let groups: Map<string, typeof flatSessions>;
         switch (aggGroupBy) {
            case 'individual':
                title = 'Trainer Activity: Professional Breakdown';
                groups = groupBy(flatSessions, 'trainerId');
                break;
            case 'class':
                title = 'Trainer Activity: Course Breakdown';
                groups = groupBy(flatSessions, 'classId');
                break;
            case 'department':
                title = 'Trainer Activity: Academic Department Breakdown';
                groups = groupBy(flatSessions, 'department');
                break;
            case 'overall':
            default:
                title = 'Institutional Trainer Performance Summary';
                groups = new Map([['overall', flatSessions]]);
                break;
        }

        groups.forEach((sessions, key) => {
            const presentCount = sessions.filter(s => s.status === 'Taught' || s.status === 'Assignment').length;
            const totalSessions = sessions.length;
            const percentage = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;
            
            let name = 'Overall';
            if (aggGroupBy === 'individual') name = trainerMap.get(key) || 'Unknown Trainer';
            if (aggGroupBy === 'class') name = classMap.get(key)?.name || 'Unknown Class';
            if (aggGroupBy === 'department') name = key;

            items.push({ id: key, name, presentCount, totalSessions, percentage });
        });
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    grandTotalPresent = items.reduce((sum, item) => sum + item.presentCount, 0);
    grandTotalSessions = items.reduce((sum, item) => sum + item.totalSessions, 0);

    setAggReportData({
        title,
        period,
        items,
        overall: {
            present: grandTotalPresent,
            total: grandTotalSessions,
            percentage: grandTotalSessions > 0 ? (grandTotalPresent / grandTotalSessions) * 100 : 0,
        }
    });

    setAggIsLoading(false);
  };
  
  const handleDownloadAggregateReport = () => {
    if (aggReportData) {
        generatePdf('percentage', aggReportData, undefined, logo);
    }
  };

  const days: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const groupBy = <T, K extends keyof T>(arr: T[], key: K): Map<string, T[]> => {
    return arr.reduce((map, item) => {
        const itemKey = String(item[key]);
        if (!map.has(itemKey)) map.set(itemKey, []);
        map.get(itemKey)!.push(item);
        return map;
    }, new Map<string, T[]>());
  };

  return (
    <div className="space-y-12">
      {/* --- Weekly Reports --- */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Periodic Records</h2>
            <p className="text-sm text-slate-500 font-medium">Generate structured weekly attendance and activity logs</p>
          </div>
        </div>

        <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-200/50 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <label className="label-sm">Academic Scope</label>
                    {isHOD ? (
                        <div className="input-field bg-slate-100 flex items-center gap-2 text-slate-500 cursor-not-allowed">
                          <School size={14} />
                          {selectedDepartment}
                        </div>
                    ) : (
                        <select value={selectedDepartment} onChange={e => { setSelectedDepartment(e.target.value); setSelectedClassId(''); }} className="input-field bg-white">
                            <option value="">Department</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    )}
                </div>
                <div className="space-y-2">
                    <label className="label-sm">Student Class</label>
                    <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} disabled={!selectedDepartment} className="input-field bg-white disabled:opacity-50">
                        <option value="">Select Class</option>
                        {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="label-sm">Reporting Window</label>
                    <input type="week" value={week} onChange={e => setWeek(e.target.value)} className="input-field bg-white" />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-slate-200/50">
              <div className="flex bg-white p-1 rounded-2xl border border-slate-200 mr-auto">
                <button 
                  onClick={() => setReportType('trainee')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    reportType === 'trainee' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Trainee Attendance
                </button>
                <button 
                  onClick={() => setReportType('trainer')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    reportType === 'trainer' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Trainer Activity
                </button>
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <button onClick={() => handleWeeklyAction('preview')} disabled={isLoading || !selectedClassId || !week} className="btn-secondary whitespace-nowrap">
                   <Eye size={18} /> Preview
                </button>
                <button onClick={() => handleWeeklyAction('download')} disabled={isLoading || !selectedClassId || !week} className="btn-primary whitespace-nowrap">
                   <Download size={18} /> {isLoading ? 'Processing...' : 'Download PDF'}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {message && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <p className="text-sm font-bold text-rose-500 bg-rose-50 p-4 rounded-2xl border border-rose-100">{message}</p>
                </motion.div>
              )}
            </AnimatePresence>
        </div>

        {previewData && <ReportPreview data={previewData} type={reportType} onClose={() => setPreviewData(null)} />}
      </section>

      {/* --- Aggregate Percentage Reports --- */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-600">
            <BarChart4 size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Performance Analytics</h2>
            <p className="text-sm text-slate-500 font-medium">Aggregated attendance statistics across custom intervals</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
                <label className="label-sm">Start Interval</label>
                <input type="date" value={aggStartDate} onChange={e => setAggStartDate(e.target.value)} className="input-field" />
            </div>
            <div className="space-y-2">
                <label className="label-sm">End Interval</label>
                <input type="date" value={aggEndDate} onChange={e => setAggEndDate(e.target.value)} className="input-field" />
            </div>
            <div className="space-y-2">
                <label className="label-sm">Subject Focus</label>
                <select value={aggSubject} onChange={e => setAggSubject(e.target.value as 'trainees' | 'trainers')} className="input-field">
                    <option value="trainees">Trainees</option>
                    <option value="trainers">Trainers</option>
                </select>
            </div>
            <div className="space-y-2">
                <label className="label-sm">Grouping Logic</label>
                <select value={aggGroupBy} onChange={e => setAggGroupBy(e.target.value as 'class' | 'individual' | 'department' | 'overall')} className="input-field">
                    <option value="class">Group by Class</option>
                    <option value="individual">Individual Metrics</option>
                    {!isHOD && <option value="department">By Department</option>}
                    <option value="overall">Cumulative Institutional</option>
                </select>
            </div>
          </div>
          
          <button 
            onClick={handleGenerateAggregateReport} 
            disabled={aggIsLoading} 
            className="btn-primary w-full py-4 text-lg bg-violet-600 hover:bg-violet-700 shadow-violet-100"
          >
            {aggIsLoading ? 'Crunching Metrics...' : 'Generate Dashboard Overview'}
          </button>

          {aggMessage && <p className="text-sm font-bold text-rose-500 text-center">{aggMessage}</p>}
        </div>

        <AnimatePresence>
        {aggReportData && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 bg-slate-50/30 p-10 rounded-[3rem] border border-slate-100"
            >
                <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 pb-6 border-b border-slate-200">
                    <div className="space-y-1">
                        <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{aggReportData.title}</h3>
                        <p className="text-sm font-medium text-slate-400 flex items-center gap-2">
                          <Clock size={14} />
                          Timeframe: {aggReportData.period}
                        </p>
                    </div>
                    <button onClick={handleDownloadAggregateReport} className="btn-secondary bg-white">
                       <Download size={18} /> Export as High-Quality PDF
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                   <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status: Present/Taught</p>
                      <p className="text-3xl font-black text-slate-900">{aggReportData.overall.present}</p>
                   </div>
                   <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Log Sessions</p>
                      <p className="text-3xl font-black text-slate-900">{aggReportData.overall.total}</p>
                   </div>
                   <div className="p-6 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Compliance Rate</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-3xl font-black text-white">{aggReportData.overall.percentage.toFixed(1)}</p>
                        <span className="text-xl font-bold text-indigo-300">%</span>
                      </div>
                   </div>
                </div>

                <div className="overflow-x-auto rounded-[2rem] border border-slate-100 shadow-sm">
                    <table className="min-w-full bg-white">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="p-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entity Name</th>
                                <th className="p-5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Present/Log</th>
                                <th className="p-5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sessions</th>
                                <th className="p-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {aggReportData.items.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/20 transition-colors">
                                    <td className="p-5 font-bold text-slate-800">{item.name}</td>
                                    <td className="p-5 text-center text-slate-500 font-medium">{item.presentCount}</td>
                                    <td className="p-5 text-center text-slate-500 font-medium">{item.totalSessions}</td>
                                    <td className="p-5 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                            <motion.div 
                                              initial={{ width: 0 }}
                                              animate={{ width: `${item.percentage}%` }}
                                              className={`h-full ${item.percentage > 80 ? 'bg-green-500' : item.percentage > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                            />
                                          </div>
                                          <span className="text-sm font-black text-slate-900 min-w-[3rem]">{item.percentage.toFixed(1)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        )}
        </AnimatePresence>
      </section>
    </div>
  );
};

export default ReportGeneration;
