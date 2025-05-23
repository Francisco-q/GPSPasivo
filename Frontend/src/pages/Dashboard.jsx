import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';

// Corregir íconos predeterminados de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [pets, setPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newPetName, setNewPetName] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Verificar autenticación al cargar el componente
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      console.log('Token almacenado:', token); // Depuración
      console.log('Usuario almacenado:', storedUser);

      if (!token || !storedUser) {
        setError('Sesión no encontrada. Por favor, inicia sesión nuevamente.');
        navigate('/login');
        return;
      }

      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      } catch (error) {
        console.error('Error al parsear datos del usuario:', error);
        setError('Error al cargar los datos del usuario.');
        navigate('/login');
      }
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  // Obtener mascotas del usuario
  useEffect(() => {
    const fetchPets = async () => {
      if (!user) return;
      try {
        const token = localStorage.getItem('token');
        console.log('Enviando solicitud GET /pets con token:', token); // Depuración
        const response = await axios.get(`http://localhost:5000/users/${user.user_id}/pets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Respuesta de GET /pets:', response.data); // Depuración
        setPets(response.data);
        if (response.data.length > 0) {
          setSelectedPet(response.data[0].id);
        }
      } catch (error) {
        console.error('Error al obtener mascotas:', error);
        if (error.response?.status === 401) {
          setError('Sesión inválida. Por favor, inicia sesión nuevamente.');
          navigate('/login');
        } else {
          setError(error.response?.data?.error || 'No se pudieron cargar las mascotas. Por favor, intenta de nuevo.');
        }
      }
    };

    if (!loading) {
      fetchPets();
    }
  }, [loading, user, navigate]);

  // Obtener ubicaciones del backend
  useEffect(() => {
    const fetchLocations = async () => {
      if (!user) return;
      try {
        const token = localStorage.getItem('token');
        console.log('Enviando solicitud GET /locations con token:', token); // Depuración
        const response = await axios.get(`http://localhost:5000/users/${user.user_id}/locations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Respuesta de GET /locations:', response.data); // Depuración
        setLocations(response.data);
      } catch (error) {
        console.error('Error al obtener ubicaciones:', error);
        if (error.response?.status === 401) {
          setError('Sesión inválida. Por favor, inicia sesión nuevamente.');
          navigate('/login');
        } else {
          setError(error.response?.data?.error || 'No se pudieron cargar las ubicaciones. Por favor, intenta de nuevo.');
        }
      }
    };

    if (!loading) {
      fetchLocations();
    }
  }, [loading, user, navigate]);

  // Manejar cierre de sesión
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Componente para manejar clics en el mapa
  function AddLocation() {
    useMapEvents({
      click(e) {
        if (addingLocation && selectedPet) {
          const { lat, lng } = e.latlng;
          const token = localStorage.getItem('token');
          console.log('Enviando solicitud POST /scan con token:', token); // Depuración
          axios.post(
            `http://localhost:5000/scan/${selectedPet}`,
            { latitude: lat, longitude: lng },
            { headers: { Authorization: `Bearer ${token}` } }
          )
            .then((response) => {
              console.log('Respuesta de POST /scan:', response.data); // Depuración
              setLocations((prev) => [
                ...prev,
                {
                  pet_id: selectedPet,
                  pet_name: pets.find((p) => p.id === selectedPet)?.name || 'Desconocido',
                  latitude: lat,
                  longitude: lng,
                  created_at: new Date().toISOString(),
                },
              ]);
              setAddingLocation(false);
            })
            .catch((error) => {
              console.error('Error al agregar ubicación:', error);
              if (error.response?.status === 401) {
                setError('Sesión inválida. Por favor, inicia sesión nuevamente.');
                navigate('/login');
              } else {
                setError(error.response?.data?.error || 'No se pudo agregar la ubicación. Por favor, intenta de nuevo.');
              }
              setAddingLocation(false);
            });
        }
      },
    });
    return null;
  }

  // Manejar agregar nueva mascota
  const handleAddPet = async () => {
    if (!newPetName) {
      setError('El nombre de la mascota es requerido.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      console.log('Enviando solicitud POST /pets con token:', token); // Depuración
      const response = await axios.post(
        `http://localhost:5000/users/${user.user_id}/pets`,
        { name: newPetName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Respuesta de POST /pets:', response.data); // Depuración
      const newPet = response.data;
      setPets((prev) => [...prev, { id: newPet.id, name: newPet.name }]);
      setNewPetName('');
      setModalOpen(false);
    } catch (error) {
      console.error('Error al agregar mascota:', error);
      if (error.response?.status === 401) {
        setError('Sesión inválida. Por favor, inicia sesión nuevamente.');
        navigate('/login');
      } else {
        setError(error.response?.data?.error || 'No se pudo agregar la mascota. Por favor, intenta de nuevo.');
      }
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
    <>
      <div className="min-h-screen bg-gray-100 relative z-10">
        {/* Barra superior */}
        <div className="bg-white shadow relative z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <h1 className="text-2xl font-bold">GPS Pasivo</h1>
              <div className="flex items-center">
                <span className="mr-4">Hola, {user?.nombre || user?.email}</span>
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

        {/* Contenido principal */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Panel de Control</h2>
            <p className="mb-4">
              Bienvenido al sistema de GPS Pasivo. Desde aquí podrás gestionar tus mascotas y ver sus ubicaciones.
            </p>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                {error}
              </div>
            )}

            <div className="mt-6 space-y-6">
              {/* Sección Mis Mascotas */}
              <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition relative z-10">
                <h3 className="text-lg font-medium">Mis Mascotas</h3>
                <p className="text-gray-600">Gestiona los perfiles de tus mascotas y sus códigos QR.</p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                >
                  Agregar Mascota
                </button>
              </div>

              {/* Sección Ubicaciones con Mapa */}
              <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition relative z-10">
                <h3 className="text-lg font-medium">Ubicaciones</h3>
                <p className="text-gray-600">Visualiza en el mapa dónde se han escaneado los códigos QR.</p>

                {/* Controles para agregar escaneo */}
                <div className="mt-4 flex items-center space-x-4 relative z-20">
                  <select
                    value={selectedPet || ''}
                    onChange={(e) => setSelectedPet(e.target.value)}
                    className="border rounded px-2 py-1"
                  >
                    <option value="">Selecciona una mascota</option>
                    {pets.map((pet) => (
                      <option key={pet.id} value={pet.id}>
                        {pet.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setAddingLocation(true)}
                    disabled={!selectedPet || addingLocation}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition disabled:bg-gray-400"
                  >
                    {addingLocation ? 'Haz clic en el mapa' : 'Agregar Escaneo'}
                  </button>
                </div>

                {/* Mapa */}
                <div className="mt-4 h-96 relative z-10">
                  <MapContainer
                    center={[-35.4075, -71.6369]}  // Coordenadas del Campus Los Niches
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <AddLocation />
                    {locations.map((loc) => (
                      <Marker key={`${loc.pet_id}-${loc.created_at}`} position={[loc.latitude, loc.longitude]}>
                        <Popup>
                          <div>
                            <strong>{loc.pet_name}</strong>
                            <p>Escaneado: {new Date(loc.created_at).toLocaleString()}</p>
                            <p>Lat: {loc.latitude.toFixed(4)}, Lng: {loc.longitude.toFixed(4)}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para agregar mascota */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg relative z-50 max-w-sm w-full">
            <h3 className="text-lg font-medium mb-4">Agregar Nueva Mascota</h3>
            <input
              type="text"
              value={newPetName}
              onChange={(e) => setNewPetName(e.target.value)}
              placeholder="Nombre de la mascota"
              className="border rounded px-2 py-1 mb-4 w-full"
            />
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setModalOpen(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddPet}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}