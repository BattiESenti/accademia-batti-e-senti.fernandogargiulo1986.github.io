import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Caricamento...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function RequireAdmin() {
  const { profile } = useAuth();
  if (profile?.ruolo !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
