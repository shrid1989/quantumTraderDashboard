// Authentication hook for QuantumTrader Dashboard
import { useContext, createContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

// Create auth context
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if token exists on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const userEmail = localStorage.getItem('user_email');
    if (token && userEmail) {
      setIsAuthenticated(true);
      setUser({ email: userEmail });
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await authAPI.login(email, password);
      const { access_token, user_email } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user_email', user_email);

      setIsAuthenticated(true);
      setUser({ email: user_email });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.detail || 'Login failed',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
