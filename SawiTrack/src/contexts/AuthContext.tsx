import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, Employee } from '@/lib/api';

type Role = 'manager' | 'foreman' | 'employee';

type User = Employee & { _id: string; id: string };

interface AuthContextType {
  user: User | null;
  // return the user on success, or null on failure
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  isAuthenticated: boolean;
  hydrated: boolean; // indicates auth state has been read from storage
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// No more mock users; use backend API

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Try to hydrate from token -> fetch /auth/me
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (!token && savedUser) {
      // legacy path: if user exists but no token, just use it
      try {
        const parsed = JSON.parse(savedUser);
        // normalize to include both _id and id
        const normalized = parsed.id ? parsed : { ...parsed, id: parsed._id };
        setUser(normalized);
      } catch {
        setUser(null);
      }
      setHydrated(true);
      return;
    }
    if (!token) {
      setHydrated(true);
      return;
    }
    api.me()
      .then((u) => {
        const eu = u as Employee;
        const mapped = { ...eu, id: eu._id } as User;
        setUser(mapped);
        localStorage.setItem('user', JSON.stringify(mapped));
      })
      .catch(() => {
        // token invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => setHydrated(true));
  }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
  const { token, user } = await api.login({ email, password });
  const eu = user as Employee;
  const mapped = { ...eu, id: eu._id } as User;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(mapped));
    setUser(mapped);
    return mapped;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        hydrated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};