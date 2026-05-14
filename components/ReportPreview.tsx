import React from 'react';
import { createPortal } from 'react-dom';
import { WeeklyTrainerReportData, WeeklyTraineeReportData, Day, TimeSlot } from '../types';

interface ReportPreviewProps {
  data: WeeklyTrainerReportData | WeeklyTraineeReportData | null;
  type: 'trainer' | 'trainee';
  onClose: () => void;
}

const timeSlots: TimeSlot[] = ['08:00-10:00', '10:00-12:00', '12:00-13:00', '13:00-15:00', '15:00-17:00'];
const days: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

const ReportPreview: React.FC<ReportPreviewProps> = ({ data, type, onClose }) => {
  if (!data) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0 border-b pb-3">
                <h3 className="text-xl font-bold text-slate-800">Report Preview</h3>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-800 transition-colors p-1 rounded-full hover:bg-slate-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="overflow-auto flex-grow">
                {type === 'trainer' ? (
                <TrainerReportPreview data={data as WeeklyTrainerReportData} />
                ) : (
                <TraineeReportPreview data={data as WeeklyTraineeReportData} />
                )}
            </div>
             <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors font-medium">
                    Close Preview
                </button>
            </div>
        </div>
    </div>,
    document.body
  );
};

const TrainerReportPreview: React.FC<{ data: WeeklyTrainerReportData }> = ({ data }) => {
  const statusStyles: { [key: string]: string } = {
    'Taught': 'text-green-700 font-medium',
    'Not Taught': 'text-red-700 font-medium',
    'Assignment': 'text-amber-700 font-medium',
  };
  return (
    <table className="min-w-full border-collapse text-xs">
      <thead>
        <tr className="bg-slate-100">
          <th className="p-2 border border-slate-200 text-left font-semibold text-slate-600 sticky top-0 bg-slate-100 z-10">Time</th>
          {days.map(day => (
            <th key={day} className="p-2 border border-slate-200 text-left font-semibold text-slate-600 capitalize sticky top-0 bg-slate-100 z-10">
              {day} <span className="font-normal text-slate-500">({data.dates[day]})</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {timeSlots.map(time => (
          <tr key={time} className="hover:bg-slate-50">
            <td className="p-2 border border-slate-200 font-medium text-slate-500 align-top bg-slate-50">{time}</td>
            {days.map(day => {
              const session = data.schedule[day]?.[time];
              return (
                <td key={`${day}-${time}`} className="p-2 border border-slate-200 align-top">
                  {session ? (
                    <div className="space-y-1">
                      <p><span className="font-semibold text-slate-600">Unit:</span> {session.subject}</p>
                      <p><span className="font-semibold text-slate-600">Trainer:</span> {session.trainer}</p>
                       <p>
                        <span className="font-semibold text-slate-600">Status:</span>{' '}
                        <span className={statusStyles[session.status] || ''}>
                            {session.status}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const TraineeReportPreview: React.FC<{ data: WeeklyTraineeReportData }> = ({ data }) => {
    const getPercentageColor = (percentage: number) => {
        if (percentage >= 80) return 'text-green-700';
        if (percentage >= 50) return 'text-amber-700';
        return 'text-red-700';
    };
    
    const overallPercentage = data.summary.overallPercentage;
    const overallPercentageColor = getPercentageColor(overallPercentage);

    return (
        <>
        <table className="min-w-full border-collapse text-sm">
            <thead>
                <tr className="bg-slate-100">
                    <th className="p-2 border border-slate-200 text-left font-semibold text-slate-600 sticky top-0 bg-slate-100 z-10">Trainee Name</th>
                    <th className="p-2 border border-slate-200 text-center font-semibold text-slate-600 sticky top-0 bg-slate-100 z-10">Mon</th>
                    <th className="p-2 border border-slate-200 text-center font-semibold text-slate-600 sticky top-0 bg-slate-100 z-10">Tue</th>
                    <th className="p-2 border border-slate-200 text-center font-semibold text-slate-600 sticky top-0 bg-slate-100 z-10">Wed</th>
                    <th className="p-2 border border-slate-200 text-center font-semibold text-slate-600 sticky top-0 bg-slate-100 z-10">Thu</th>
                    <th className="p-2 border border-slate-200 text-center font-semibold text-slate-600 sticky top-0 bg-slate-100 z-10">Fri</th>
                    <th className="p-2 border border-slate-200 text-center font-semibold text-slate-600 sticky top-0 bg-slate-100 z-10">Weekly %</th>
                </tr>
            </thead>
            <tbody>
                {data.attendanceGrid.map((row, index) => {
                    const percentageColor = getPercentageColor(row.weeklyPercentage);
                    return (
                        <tr key={index} className="hover:bg-slate-50">
                            <td className="p-2 border border-slate-200 font-medium bg-white">{row.name}</td>
                            <td className="p-2 border border-slate-200 text-center">{row.attendance.mon}</td>
                            <td className="p-2 border border-slate-200 text-center">{row.attendance.tue}</td>
                            <td className="p-2 border border-slate-200 text-center">{row.attendance.wed}</td>
                            <td className="p-2 border border-slate-200 text-center">{row.attendance.thu}</td>
                            <td className="p-2 border border-slate-200 text-center">{row.attendance.fri}</td>
                            <td className={`p-2 border border-slate-200 text-center font-bold ${percentageColor}`}>{row.weeklyPercentage.toFixed(1)}%</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
         <div className="mt-4 p-4 bg-slate-50 rounded-md text-sm border">
            <h4 className="font-bold text-base text-slate-700 mb-2">Summary</h4>
            <div className="space-y-1">
                <p>
                    <strong>Overall Attendance:</strong>{' '}
                    <span className={`font-bold ${overallPercentageColor}`}>
                        {overallPercentage.toFixed(1)}%
                    </span>
                </p>
                <p><strong>Perfect Attendance ({data.summary.perfectAttendance.length}):</strong> {data.summary.perfectAttendance.join(', ') || 'None'}</p>
                <p><strong>Low Attendance (&lt;80%, {data.summary.lowAttendance.length}):</strong> {data.summary.lowAttendance.join(', ') || 'None'}</p>
            </div>
        </div>
        </>
    );
};

export default ReportPreview;