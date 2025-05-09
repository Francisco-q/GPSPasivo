import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/firebase-config';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Si no hay usuario autenticado, redirigir al login
        navigate('/');
      }
      setLoading(false);
    });

    // Limpiar el observer al desmontar
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold">GPS Pasivo</h1>
            <div className="flex items-center">
              <span className="mr-4">Hola, {user?.displayName || user?.email}</span>
              <button 
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Panel de Control</h2>
          <p className="mb-4">Bienvenido al sistema de GPS Pasivo. Desde aquí podrás gestionar tus mascotas y ver sus ubicaciones.</p>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
              <h3 className="text-lg font-medium">Mis Mascotas</h3>
              <p className="text-gray-600">Gestiona los perfiles de tus mascotas y sus códigos QR.</p>
              <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                Administrar
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
              <h3 className="text-lg font-medium">Ubicaciones</h3>
              <p className="text-gray-600">Visualiza en el mapa dónde se han escaneado los códigos QR.</p>
              <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                Ver Mapa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}