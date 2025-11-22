import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface ClosingPeriod {
  _id: string;
  startDate: string;
  endDate: string;
  notes?: string;
  month?: number;
  year?: number;
  status?: 'active' | 'inactive';
}

interface ClosingContextType {
  closingPeriods: ClosingPeriod[];
  isDateClosed: (dateString: string) => boolean;
  fetchClosingPeriods: () => Promise<void>;
}

const ClosingContext = createContext<ClosingContextType | undefined>(undefined);

export const ClosingProvider = ({ children }: { children: ReactNode }) => {
  const [closingPeriods, setClosingPeriods] = useState<ClosingPeriod[]>([]);

  const fetchClosingPeriods = async () => {
    try {
      const response = await api.closingPeriods();
      setClosingPeriods(response || []);
    } catch (error) {
      // toast.error('Gagal memuat daftar periode closing.');
      console.error('Error fetching closing periods:', error);
    }
  };

  useEffect(() => {
    fetchClosingPeriods();
  }, []);

  const isDateClosed = (dateString: string): boolean => {
    if (!dateString) return false;
    const d = new Date(dateString);
    return closingPeriods.some(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      return d >= start && d <= end;
    });
  };

  return (
    <ClosingContext.Provider value={{ closingPeriods, isDateClosed, fetchClosingPeriods }}>
      {children}
    </ClosingContext.Provider>
  );
};

export const useClosing = () => {
  const context = useContext(ClosingContext);
  if (context === undefined) {
    throw new Error('useClosing must be used within a ClosingProvider');
  }
  return context;
};