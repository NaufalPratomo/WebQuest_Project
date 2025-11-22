import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api'; // Assuming you have an api utility

interface ClosedMonth {
  year: number;
  month: number; // 1-indexed month
}

interface ClosingContextType {
  closedMonths: ClosedMonth[];
  isMonthClosed: (dateString: string) => boolean;
  fetchClosedMonths: () => Promise<void>;
}

const ClosingContext = createContext<ClosingContextType | undefined>(undefined);

export const ClosingProvider = ({ children }: { children: ReactNode }) => {
  const [closedMonths, setClosedMonths] = useState<ClosedMonth[]>([]);

  const fetchClosedMonths = async () => {
    try {
      const response = await api.closedMonths(); // Adjust API endpoint as needed
      setClosedMonths(response || []);
    } catch (error) {
      toast.error('Gagal memuat daftar bulan yang ditutup.');
      console.error('Error fetching closed months:', error);
    }
  };

  useEffect(() => {
    fetchClosedMonths();
  }, []);

  const isMonthClosed = (dateString: string): boolean => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() is 0-indexed

    return closedMonths.some(cm => cm.year === year && cm.month === month);
  };

  return (
    <ClosingContext.Provider value={{ closedMonths, isMonthClosed, fetchClosedMonths }}>
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