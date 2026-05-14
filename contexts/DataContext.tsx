import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { Class, Trainee, Trainer, Unit, Remark, TrainerSchedule, WeeklyScheduleInput, TraineeAttendanceRecord, UnitAssignment } from '../types';
import { CLASSES, TRAINEES, TRAINERS, UNITS, UNIT_ASSIGNMENTS } from '../constants';
import { storage } from '../lib/storage';
import { db, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, onAuthStateChanged, auth } from '../firebase';

// --- Historical Data ... (rest of constants)

// --- Historical Data for 2024 & 2025 ---
const PREVIOUS_TRAINER_SCHEDULES: TrainerSchedule[] = [
  {
    id: 'schedule-2024-1',
    classId: 'class-1',
    week: '2024-W42', // October 2024
    submittedBy: 'user-rep-1',
    submittedAt: '2024-10-21T10:00:00Z',
    schedule: {
      monday: { '08:00-10:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' }, '10:00-12:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' } },
      tuesday: { '13:00-15:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Assignment' } },
      wednesday: {},
      thursday: { '08:00-10:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' } },
      friday: {},
    },
  },
  {
    id: 'schedule-2024-2',
    classId: 'class-1',
    week: '2024-W20', // May 2024
    submittedBy: 'user-rep-1',
    submittedAt: '2024-05-13T09:00:00Z',
    schedule: {
      monday: { '08:00-10:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' } },
      tuesday: { '10:00-12:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' } },
      wednesday: { '13:00-15:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' } },
      thursday: { '08:00-10:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' } },
      friday: { '10:00-12:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Assignment' } },
    },
  },
  {
    id: 'schedule-2025-1',
    classId: 'class-1',
    week: '2025-W10', // March 2025
    submittedBy: 'user-rep-1',
    submittedAt: '2025-03-03T10:00:00Z',
    schedule: {
      monday: { '08:00-10:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' } },
      tuesday: { '10:00-12:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' } },
      wednesday: { '13:00-15:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' } },
      thursday: { '08:00-10:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' } },
      friday: {},
    },
  },
  {
    id: 'schedule-2025-2',
    classId: 'class-1',
    week: '2025-W30', // July 2025
    submittedBy: 'user-rep-1',
    submittedAt: '2025-07-21T11:00:00Z',
    schedule: {
      monday: { '08:00-10:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' } },
      tuesday: { '10:00-12:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' } },
      wednesday: {},
      thursday: { '13:00-15:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' } },
      friday: { '08:00-10:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' } },
    },
  },
  {
    id: 'schedule-2026-current',
    classId: 'class-1',
    week: '2026-W11', // Current week
    submittedBy: 'user-rep-1',
    submittedAt: '2026-03-10T10:00:00Z',
    schedule: {
      monday: { 
        '08:00-10:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' },
        '10:00-12:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' } 
      },
      tuesday: { 
        '13:00-15:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' } 
      },
      wednesday: {
        '08:00-10:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' }
      },
      thursday: {
        '10:00-12:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' }
      },
      friday: {
        '08:00-10:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' }
      },
    },
  },
];

const PREVIOUS_TRAINEE_RECORDS: TraineeAttendanceRecord[] = [
  // 2026-W11 (Current week)
  { traineeId: 'trainee-1', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2026-03-09', time: '08:00', status: 'present' },
  { traineeId: 'trainee-2', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2026-03-09', time: '08:00', status: 'present' },
  { traineeId: 'trainee-3', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2026-03-09', time: '08:00', status: 'present' },
  { traineeId: 'trainee-4', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2026-03-09', time: '08:00', status: 'present' },
  { traineeId: 'trainee-5', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2026-03-09', time: '08:00', status: 'present' },
  
  { traineeId: 'trainee-1', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2026-03-09', time: '10:00', status: 'present' },
  { traineeId: 'trainee-2', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2026-03-09', time: '10:00', status: 'present' },
  { traineeId: 'trainee-3', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2026-03-09', time: '10:00', status: 'present' },
  { traineeId: 'trainee-4', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2026-03-09', time: '10:00', status: 'absent' },
  { traineeId: 'trainee-5', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2026-03-09', time: '10:00', status: 'present' },
  // 2024-W42
  { traineeId: 'trainee-1', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2024-10-14', time: '08:00', status: 'present' },
  { traineeId: 'trainee-2', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2024-10-14', time: '08:00', status: 'present' },
  { traineeId: 'trainee-3', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2024-10-14', time: '08:00', status: 'present' },
  { traineeId: 'trainee-4', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2024-10-14', time: '08:00', status: 'absent' },
  { traineeId: 'trainee-5', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2024-10-14', time: '08:00', status: 'absent' },
  
  // 2024-W20 (May 13, 2024)
  { traineeId: 'trainee-1', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2024-05-13', time: '08:00', status: 'present' },
  { traineeId: 'trainee-2', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2024-05-13', time: '08:00', status: 'present' },
  { traineeId: 'trainee-3', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2024-05-13', time: '08:00', status: 'present' },
  { traineeId: 'trainee-4', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2024-05-13', time: '08:00', status: 'present' },
  { traineeId: 'trainee-5', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2024-05-13', time: '08:00', status: 'present' },

  // 2025-W10 (March 3, 2025)
  { traineeId: 'trainee-1', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-03-03', time: '08:00', status: 'present' },
  { traineeId: 'trainee-2', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-03-03', time: '08:00', status: 'absent' },
  { traineeId: 'trainee-3', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-03-03', time: '08:00', status: 'present' },
  { traineeId: 'trainee-4', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-03-03', time: '08:00', status: 'present' },
  { traineeId: 'trainee-5', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-03-03', time: '08:00', status: 'present' },

  // 2025-W30 (July 21, 2025)
  { traineeId: 'trainee-1', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-07-21', time: '08:00', status: 'present' },
  { traineeId: 'trainee-2', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-07-21', time: '08:00', status: 'present' },
  { traineeId: 'trainee-3', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-07-21', time: '08:00', status: 'present' },
  { traineeId: 'trainee-4', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-07-21', time: '08:00', status: 'present' },
  { traineeId: 'trainee-5', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-07-21', time: '08:00', status: 'absent' },
];

// --- Dummy Data for Easy Demonstration ---
const DEMO_TRAINER_SCHEDULES: TrainerSchedule[] = [
  {
    id: 'schedule-demo-1',
    classId: 'class-1', // CS-L6-24S
    week: '2025-W05', // A week in Feb 2025
    submittedBy: 'user-rep-1', // Alex Ray
    submittedAt: '2025-02-10T11:00:00Z',
    schedule: {
      monday: {
        '08:00-10:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' },
        '10:00-12:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Taught' },
      },
      tuesday: {
        '13:00-15:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' },
      },
      wednesday: {
        '08:00-10:00': { unitId: 'unit-2', trainerId: 'trainer-3', status: 'Assignment' },
      },
      thursday: {
        '10:00-12:00': { unitId: 'unit-1', trainerId: 'trainer-1', status: 'Taught' },
      },
      friday: {},
    },
  },
  {
    id: 'schedule-demo-ee-1',
    classId: 'class-4', // EE-L6-24S
    week: '2025-W06',
    submittedBy: 'user-rep-3', // crep_ee
    submittedAt: '2025-02-17T11:00:00Z',
    schedule: {
      monday: { '08:00-10:00': { unitId: 'unit-6', trainerId: 'trainer-4', status: 'Taught' } },
      tuesday: { '10:00-12:00': { unitId: 'unit-7', trainerId: 'trainer-4', status: 'Taught' } },
      wednesday: { '08:00-10:00': { unitId: 'unit-6', trainerId: 'trainer-4', status: 'Not Taught' } },
      thursday: { '13:00-15:00': { unitId: 'unit-7', trainerId: 'trainer-4', status: 'Taught' } },
      friday: {},
    },
  },
  {
    id: 'schedule-demo-me-1',
    classId: 'class-6', // ME-L6-24S
    week: '2025-W06',
    submittedBy: 'user-rep-5', // crep_me
    submittedAt: '2025-02-17T11:00:00Z',
    schedule: {
      monday: { '10:00-12:00': { unitId: 'unit-9', trainerId: 'trainer-6', status: 'Taught' } },
      tuesday: { '08:00-10:00': { unitId: 'unit-9', trainerId: 'trainer-6', status: 'Taught' } },
      wednesday: {},
      thursday: { '10:00-12:00': { unitId: 'unit-9', trainerId: 'trainer-6', status: 'Assignment' } },
      friday: {},
    },
  },
];

const DEMO_TRAINEE_RECORDS: TraineeAttendanceRecord[] = [
  // Data for 2025-W05 for class-1
  // Monday, Feb 3, 2025
  // Session 1: 08:00
  { traineeId: 'trainee-1', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-02-03', time: '08:00', status: 'present' },
  { traineeId: 'trainee-2', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-02-03', time: '08:00', status: 'present' },
  { traineeId: 'trainee-3', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-02-03', time: '08:00', status: 'absent' },
  { traineeId: 'trainee-4', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-02-03', time: '08:00', status: 'present' },
  { traineeId: 'trainee-5', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-02-03', time: '08:00', status: 'present' },
  // Session 2: 10:00
  { traineeId: 'trainee-1', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2025-02-03', time: '10:00', status: 'present' },
  { traineeId: 'trainee-2', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2025-02-03', time: '10:00', status: 'absent' },
  { traineeId: 'trainee-3', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2025-02-03', time: '10:00', status: 'present' },
  { traineeId: 'trainee-4', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2025-02-03', time: '10:00', status: 'present' },
  { traineeId: 'trainee-5', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2025-02-03', time: '10:00', status: 'present' },
  // Tuesday, Feb 4, 2025
  { traineeId: 'trainee-1', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-02-04', time: '13:00', status: 'present' },
  { traineeId: 'trainee-2', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-02-04', time: '13:00', status: 'present' },
  { traineeId: 'trainee-3', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-02-04', time: '13:00', status: 'present' },
  { traineeId: 'trainee-4', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-02-04', time: '13:00', status: 'present' },
  { traineeId: 'trainee-5', classId: 'class-1', unitId: 'unit-1', trainerId: 'trainer-1', date: '2025-02-04', time: '13:00', status: 'present' },
   // Wednesday, Feb 5, 2025
  { traineeId: 'trainee-1', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2025-02-05', time: '08:00', status: 'present' },
  { traineeId: 'trainee-2', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2025-02-05', time: '08:00', status: 'present' },
  { traineeId: 'trainee-3', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2025-02-05', time: '08:00', status: 'present' },
  { traineeId: 'trainee-4', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2025-02-05', time: '08:00', status: 'absent' },
  { traineeId: 'trainee-5', classId: 'class-1', unitId: 'unit-2', trainerId: 'trainer-3', date: '2025-02-05', time: '08:00', status: 'absent' },

  // EE-L6-24S (class-4)
  { traineeId: 'trainee-16', classId: 'class-4', unitId: 'unit-6', trainerId: 'trainer-4', date: '2025-02-10', time: '08:00', status: 'present' },
  { traineeId: 'trainee-17', classId: 'class-4', unitId: 'unit-6', trainerId: 'trainer-4', date: '2025-02-10', time: '08:00', status: 'present' },
  { traineeId: 'trainee-16', classId: 'class-4', unitId: 'unit-7', trainerId: 'trainer-4', date: '2025-02-11', time: '10:00', status: 'present' },
  { traineeId: 'trainee-17', classId: 'class-4', unitId: 'unit-7', trainerId: 'trainer-4', date: '2025-02-11', time: '10:00', status: 'absent' },

  // ME-L6-24S (class-6)
  { traineeId: 'trainee-20', classId: 'class-6', unitId: 'unit-9', trainerId: 'trainer-6', date: '2025-02-10', time: '10:00', status: 'present' },
];

const DEMO_REMARKS: Remark[] = [
  {
    id: 'remark-1',
    classId: 'class-1',
    week: '2025-W05',
    type: 'trainee',
    remarkText: 'The class representative noted that the state management unit was particularly challenging but well-explained.',
    authorName: 'Alex Ray',
    authorSignature: 'AR',
    date: '2025-02-10',
  },
  {
    id: 'remark-2',
    classId: 'class-1',
    week: '2025-W05',
    type: 'trainer',
    remarkText: 'Students are showing great progress in React patterns. Attendance was good overall.',
    authorName: 'Dr. Evelyn Reed',
    authorSignature: 'ER',
    date: '2025-02-10',
  },
  {
    id: 'remark-3',
    classId: 'class-4',
    week: '2025-W06',
    type: 'trainee',
    remarkText: 'Electrical engineering students requested more practical sessions for circuit analysis.',
    authorName: 'Charlie Day',
    authorSignature: 'CD',
    date: '2025-02-17',
  },
];


interface DataContextType {
  classes: Class[];
  trainees: Trainee[];
  trainers: Trainer[];
  units: Unit[];
  unitAssignments: UnitAssignment[];
  remarks: Remark[];
  trainerSchedules: TrainerSchedule[];
  traineeAttendanceRecords: TraineeAttendanceRecord[];
  logo: string | null;
  setLogo: (logo: string | null) => void;
  addTrainer: (id: string, name: string, department: string) => Promise<void>;
  updateTrainer: (id: string, updatedData: Partial<Omit<Trainer, 'id'>>) => Promise<void>;
  deleteTrainer: (id: string) => Promise<void>;
  addTrainee: (name: string, admissionNumber: string, classId: string) => Promise<boolean>;
  addClass: (name: string, department: string) => Promise<boolean>;
  addUnit: (name: string, classId: string) => Promise<boolean>;
  assignUnitToTrainer: (unitId: string, trainerId: string) => Promise<void>;
  addRemark: (newRemarkData: Omit<Remark, 'id'>) => Promise<void>;
  updateClassName: (classId: string, newName: string) => Promise<boolean>;
  addTrainerSchedule: (newScheduleData: Omit<TrainerSchedule, 'id' | 'submittedAt'>) => Promise<void>;
  addTraineeAttendance: (records: TraineeAttendanceRecord[]) => Promise<void>;
}

export const DataContext = createContext<DataContextType>(null!);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [classes, setClasses] = useState<Class[]>(storage.get('classes', CLASSES));
  const [trainees, setTrainees] = useState<Trainee[]>(storage.get('trainees', TRAINEES));
  const [trainers, setTrainers] = useState<Trainer[]>(storage.get('trainers', TRAINERS));
  const [units, setUnits] = useState<Unit[]>(storage.get('units', UNITS));
  const [unitAssignments, setUnitAssignments] = useState<UnitAssignment[]>(storage.get('unitAssignments', UNIT_ASSIGNMENTS));
  const [remarks, setRemarks] = useState<Remark[]>(storage.get('remarks', DEMO_REMARKS));
  const [trainerSchedules, setTrainerSchedules] = useState<TrainerSchedule[]>(storage.get('trainerSchedules', [...PREVIOUS_TRAINER_SCHEDULES, ...DEMO_TRAINER_SCHEDULES]));
  const [traineeAttendanceRecords, setTraineeAttendanceRecords] = useState<TraineeAttendanceRecord[]>(storage.get('traineeAttendanceRecords', [...PREVIOUS_TRAINEE_RECORDS, ...DEMO_TRAINEE_RECORDS]));
  const [logo, setLogo] = useState<string | null>(storage.get('logo', null));

  // Persistence effects
  useEffect(() => { storage.set('classes', classes); }, [classes]);
  useEffect(() => { storage.set('trainees', trainees); }, [trainees]);
  useEffect(() => { storage.set('trainers', trainers); }, [trainers]);
  useEffect(() => { storage.set('units', units); }, [units]);
  useEffect(() => { storage.set('unitAssignments', unitAssignments); }, [unitAssignments]);
  useEffect(() => { storage.set('remarks', remarks); }, [remarks]);
  useEffect(() => { storage.set('trainerSchedules', trainerSchedules); }, [trainerSchedules]);
  useEffect(() => { storage.set('traineeAttendanceRecords', traineeAttendanceRecords); }, [traineeAttendanceRecords]);
  useEffect(() => { storage.set('logo', logo); }, [logo]);

  // Sync data from Firestore (Keep as background sync if possible, but don't block)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      // We could add firestore sync logic here later if wanted, 
      // but for "WITHOUT FIREBASE" demo, we stick to local.
    });
    return () => unsubscribeAuth();
  }, []);

  const addTrainer = async (id: string, name: string, department: string) => {
    const newTrainer: Trainer = { id, name, department, ePortfolioLink: '' };
    setTrainers(prev => [...prev, newTrainer]);
    // Optional Firebase sync
    setDoc(doc(db, 'trainers', id), newTrainer).catch(() => {});
  };
  
  const updateTrainer = async (id: string, updatedData: Partial<Omit<Trainer, 'id'>>) => {
    setTrainers(prev => prev.map(t => t.id === id ? { ...t, ...updatedData } : t));
    updateDoc(doc(db, 'trainers', id), updatedData).catch(() => {});
  };

  const deleteTrainer = async (id: string) => {
    setTrainers(prev => prev.filter(t => t.id !== id));
    deleteDoc(doc(db, 'trainers', id)).catch(() => {});
  };

  const addTrainee = async (name: string, admissionNumber: string, classId: string): Promise<boolean> => {
    if (trainees.some(t => t.admissionNumber === admissionNumber)) return false;
    const id = `trainee-${Date.now()}`;
    const newTrainee: Trainee = { id, name, admissionNumber, classId };
    setTrainees(prev => [...prev, newTrainee]);
    setDoc(doc(db, 'trainees', id), newTrainee).catch(() => {});
    return true;
  };

  const addClass = async (name: string, department: string): Promise<boolean> => {
    if (classes.some(c => c.name.toLowerCase() === name.toLowerCase() && c.department === department)) return false;
    const id = `class-${Date.now()}`;
    const newClass: Class = { id, name, department };
    setClasses(prev => [...prev, newClass]);
    setDoc(doc(db, 'classes', id), newClass).catch(() => {});
    return true;
  };

  const addUnit = async (name: string, classId: string): Promise<boolean> => {
    if (units.some(u => u.name.toLowerCase() === name.toLowerCase() && u.classId === classId)) return false;
    const id = `unit-${Date.now()}`;
    const newUnit: Unit = { id, name, classId };
    setUnits(prev => [...prev, newUnit]);
    setDoc(doc(db, 'units', id), newUnit).catch(() => {});
    return true;
  };

  const assignUnitToTrainer = async (unitId: string, trainerId: string) => {
    const assignmentId = `assignment-${unitId}`;
    if (!trainerId) {
      setUnitAssignments(prev => prev.filter(a => a.unitId !== unitId));
      deleteDoc(doc(db, 'unitAssignments', assignmentId)).catch(() => {});
    } else {
      const newAssignment = { unitId, trainerId };
      setUnitAssignments(prev => {
        const other = prev.filter(a => a.unitId !== unitId);
        return [...other, newAssignment];
      });
      setDoc(doc(db, 'unitAssignments', assignmentId), newAssignment).catch(() => {});
    }
  };

  const addRemark = async (newRemarkData: Omit<Remark, 'id'>) => {
    const id = `remark-${newRemarkData.classId}-${newRemarkData.week}-${newRemarkData.type}`;
    const newRemark = { ...newRemarkData, id };
    setRemarks(prev => {
      const other = prev.filter(r => r.id !== id);
      return [...other, newRemark];
    });
    setDoc(doc(db, 'remarks', id), newRemark).catch(() => {});
  };

  const updateClassName = async (classId: string, newName: string): Promise<boolean> => {
    if (!newName.trim()) return false;
    setClasses(prev => prev.map(c => c.id === classId ? { ...c, name: newName } : c));
    updateDoc(doc(db, 'classes', classId), { name: newName }).catch(() => {});
    return true;
  };
  
  const addTrainerSchedule = async (newScheduleData: Omit<TrainerSchedule, 'id' | 'submittedAt'>) => {
    const id = `schedule-${Date.now()}`;
    const newSchedule: TrainerSchedule = {
      ...newScheduleData,
      id,
      submittedAt: new Date().toISOString(),
    };
    setTrainerSchedules(prev => [...prev, newSchedule]);
    setDoc(doc(db, 'trainerSchedules', id), newSchedule).catch(() => {});
  };

  const addTraineeAttendance = async (records: TraineeAttendanceRecord[]) => {
    setTraineeAttendanceRecords(prev => [...prev, ...records]);
    for (const record of records) {
      const id = `record-${record.traineeId}-${record.date}-${record.time}`;
      setDoc(doc(db, 'traineeAttendanceRecords', id), record).catch(() => {});
    }
  };


  const value = {
    classes,
    trainees,
    trainers,
    units,
    unitAssignments,
    remarks,
    trainerSchedules,
    traineeAttendanceRecords,
    logo,
    setLogo,
    addTrainer,
    updateTrainer,
    deleteTrainer,
    addTrainee,
    addClass,
    addUnit,
    assignUnitToTrainer,
    addRemark,
    updateClassName,
    addTrainerSchedule,
    addTraineeAttendance,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
