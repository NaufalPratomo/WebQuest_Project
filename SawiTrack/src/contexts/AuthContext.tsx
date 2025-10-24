import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Role = 'manager' | 'foreman' | 'employee';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  division_id?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demonstration
const mockUsers: Record<string, { password: string; user: User }> = {
  'manager@sawit.com': {
    password: 'manager123',
    user: {
      id: '1',
      name: 'Manager Utama',
      email: 'manager@sawit.com',
      role: 'manager',
    },
  },
  'foreman@sawit.com': {
    password: 'foreman123',
    user: {
      id: '2',
      name: 'Mandor Kebun',
      email: 'foreman@sawit.com',
      role: 'foreman',
      division_id: 'div1',
    },
  },
  'employee@sawit.com': {
    password: 'employee123',
    user: {
      id: '3',
      name: 'Karyawan Kebun',
      email: 'employee@sawit.com',
      role: 'employee',
      division_id: 'div1',
    },
  },
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const userRecord = mockUsers[email];
    if (userRecord && userRecord.password === password) {
      setUser(userRecord.user);
      localStorage.setItem('user', JSON.stringify(userRecord.user));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};