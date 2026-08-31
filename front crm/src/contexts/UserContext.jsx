import React, { createContext, useContext, useState, useCallback } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const UserContext = createContext({
  user: null,
  setUser: () => {},
  refetchUser: () => {},
  loading: true
});

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('token');
    const cleanToken = rawToken ? rawToken.replace(/^"(.*)"$/, '$1').replace(/"/g, '').replace(/^Bearer\s+/i, '').trim() : '';
    return cleanToken ? { Authorization: `Bearer ${cleanToken}` } : {};
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const rawToken = localStorage.getItem('token');
      if (!rawToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      const savedUserStr = localStorage.getItem('user');
      let userId = localStorage.getItem('user_id');
      if (!userId && savedUserStr) {
        try {
          const parsed = JSON.parse(savedUserStr);
          userId = parsed._id || parsed.id;
        } catch (e) {}
      }

      if (!userId) {
        setUser(null);
        setLoading(false);
        return;
      }

      const userUrl = API_BASE.endsWith('/v1') ? `${API_BASE}/users/${userId}` : `${API_BASE}/v1/users/${userId}`;
      const res = await fetch(userUrl, {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        const freshUser = data?.data || data?.user;
        if (freshUser && typeof freshUser === 'object') {
          const savedUser = savedUserStr ? (() => { try { return JSON.parse(savedUserStr); } catch { return {}; } })() : {};
          const mergedUser = {
            ...savedUser,
            ...freshUser,
            permissions: Array.isArray(freshUser.permissions) ? freshUser.permissions : (savedUser.permissions || []),
            isSuperAdmin: Boolean(freshUser.isSuperAdmin || freshUser.is_super_admin || freshUser.role === 'superadmin' || freshUser.role_id === '0')
          };
          setUser(mergedUser);
          localStorage.setItem('user', JSON.stringify(mergedUser));
          window.dispatchEvent(new Event('storage'));
        }
      } else if (res.status === 401 || res.status === 403) {
        console.warn('🔑 Session expired or unauthorized (401/403). Clearing stale session.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_id');
        setUser(null);
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?timeout=true';
        }
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  return (
    <UserContext.Provider value={{ user, setUser, refetchUser: fetchCurrentUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
