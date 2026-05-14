import React, { createContext, useState, ReactNode, useContext, useEffect } from 'react';
import { User, Role, Trainer } from '../types';
import { USERS } from '../constants';
import { DataContext } from './DataContext';
import { storage } from '../lib/storage';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, collection, doc, setDoc, getDoc } from '../firebase';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: (username: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<void>;
  loginAs: (userId: string) => void;
  logout: () => void;
  addUser: (newUser: Omit<User, 'id'>) => Promise<boolean>;
  updateUser: (userId: string, updatedData: Partial<Omit<User, 'id' | 'username'>>) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<void>;
  isAuthReady: boolean;
}

export const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(storage.get('currentUser', null));
  const [users, setUsers] = useState<User[]>(storage.get('users', USERS));
  const [isAuthReady, setIsAuthReady] = useState(false);
  const { addTrainer, updateTrainer, deleteTrainer } = useContext(DataContext);

  // Persistence
  useEffect(() => {
    storage.set('users', users);
  }, [users]);

  useEffect(() => {
    storage.set('currentUser', currentUser);
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !currentUser) {
        // Only auto-login from Firebase if no local user is active
        const existingLocalUser = users.find(u => u.username === firebaseUser.email);
        if (existingLocalUser) {
          setCurrentUser(existingLocalUser);
        }
      }
      setIsAuthReady(true);
    });

    // We consider it ready immediately for local purposes
    setIsAuthReady(true);
    return () => unsubscribe();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google Login (Demo fallback):", error);
    }
  };

  const loginAs = (userId: string): void => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {}
    setCurrentUser(null);
  };

  const addUser = async (newUser: Omit<User, 'id'>): Promise<boolean> => {
    if (users.some(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
      return false;
    }
    
    const newId = `user-${Date.now()}`;
    const userWithId: User = { ...newUser, id: newId };
    
    setUsers(prev => [...prev, userWithId]);
    
    if (userWithId.role === Role.Trainer && userWithId.department) {
      addTrainer(newId, userWithId.name, userWithId.department);
    }
    
    return true;
  };

  const updateUser = async (userId: string, updatedData: Partial<Omit<User, 'id' | 'username'>>): Promise<boolean> => {
    const oldUser = users.find(u => u.id === userId);
    if (!oldUser) return false;
    
    const newUser = { ...oldUser, ...updatedData };
    setUsers(prev => prev.map(u => u.id === userId ? newUser : u));

    if (currentUser?.id === userId) {
      setCurrentUser(newUser);
    }

    if (newUser.role === Role.Trainer) {
      const trainerUpdates: Partial<Omit<Trainer, 'id'>> = {};
      if (newUser.name !== oldUser.name) trainerUpdates.name = newUser.name;
      if (newUser.department !== oldUser.department) trainerUpdates.department = newUser.department;
      if (newUser.ePortfolioLink !== oldUser.ePortfolioLink) trainerUpdates.ePortfolioLink = newUser.ePortfolioLink;

      if (Object.keys(trainerUpdates).length > 0) {
        updateTrainer(userId, trainerUpdates);
      }
    }
    
    return true;
  };
  
  const deleteUser = async (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;
    
    if (userToDelete.role === Role.Trainer) {
      deleteTrainer(userId);
    }

    setUsers(prev => prev.filter(u => u.id !== userId));
    if (currentUser?.id === userId) logout();
  };

  const value = {
    currentUser,
    users,
    login,
    loginWithGoogle,
    loginAs,
    logout,
    addUser,
    updateUser,
    deleteUser,
    isAuthReady,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
