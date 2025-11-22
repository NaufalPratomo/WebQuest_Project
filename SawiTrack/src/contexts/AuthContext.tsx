import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User } from '@/lib/api';
import { setToken, getToken, setUser as storeUser, getUser as loadUser } from '@/lib/authStore';

type UserWithId = User & { id: string };

interface AuthContextType {
  user: UserWithId | null;
  // return the user on success, or null on failure
  login: (email: string, password: string) => Promise<UserWithId | null>;
  logout: () => void;
  isAuthenticated: boolean;
  hydrated: boolean; // indicates auth state has been read from storage
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// No more mock users; use backend API

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserWithId | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Attempt hydration via cookie-based session first
    api.me()
      .then((u) => {
        const mapped = { ...u, id: u._id } as UserWithId;
        setUser(mapped);
        storeUser(mapped); // keep in-memory copy for logger
      })
      .catch(() => {
        // fallback: if we previously stored token manually try again? For now just unauth.
        setToken(null);
        setUser(null);
        storeUser(null);
      })
      .finally(() => setHydrated(true));
  }, []);

  const login = async (email: string, password: string): Promise<UserWithId | null> => {
    const { token, user } = await api.login({ email, password });
    // Token now stored as httpOnly cookie; we keep a copy in memory if needed for Authorization fallback
    const mapped = { ...user, id: user._id } as UserWithId;
    setToken(token);
    storeUser(mapped);
    setUser(mapped);
    return mapped;
  };

  const logout = () => {
    setUser(null);
    setToken(null); // in-memory only; cookie cleared by backend endpoint (optional future)
    storeUser(null);
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