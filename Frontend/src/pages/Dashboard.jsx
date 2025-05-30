import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';

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
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [newPetName, setNewPetName] = useState('');
  const [newPetPhoto, setNewPetPhoto] = useState('');
  const [error, setError] = useState(null);
  const [leafletMap, setLeafletMap] = useState(null);

  const navigate = useNavigate();
  const qrRef = useRef(null);

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("La imagen debe ser menor a 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewPetPhoto(e.target?.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadQRCode = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = svg.width.baseVal.value;
    canvas.height = svg.height.baseVal.value;
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const petName = pets.find((pet) => pet.id === selectedPet)?.name || 'mascota';
      const link = document.createElement("a");
      link.download = `qr-${petName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(data)))}`;
  };

  const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios(url, options);
        return response;
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 404) {
          if (i < retries - 1) {
            console.log(`Intento ${i + 1} fallido: ${err.response?.status}. Reintentando...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }
        throw err;
      }
    }
  };

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      console.log('Token almacenado:', token ? token.slice(0, 20) + '...' : 'No token');
      console.log('Usuario almacenado:', storedUser);
      if (!token || !storedUser) {
        setError('Sesión no encontrada. Por favor, inicia sesión nuevamente.');
        navigate('/login');
        return;
      }
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Error al parsear datos del usuario:', error);
        setError('Error al cargar los datos del usuario.');
        navigate('/login');
      }
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const fetchPets = async () => {
      if (!user) return;
      try {
        const token = localStorage.getItem('token');
        console.log('Enviando solicitud GET /pets con token:', token.slice(0, 20) + '...');
        const response = await fetchWithRetry(
          `http://localhost:5000/users/${user.user_id}/pets`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log('Respuesta de GET /pets:', response.data);
        setPets(response.data);
        if (response.data.length > 0) {
          setSelectedPet(response.data[0].id);
        }
      } catch (error) {
        console.error('Error al obtener mascotas:', error);
        if (error.response?.status === 401) {
          setError('Sesión inválida. Por favor, inicia sesión nuevamente.');
          navigate('/login');
        } else if (error.response?.status === 404) {
          setError('Usuario no encontrado. Reintentando...');
        } else {
          setError(error.response?.data?.error || 'No se pudieron cargar las mascotas. Por favor, intenta de nuevo.');
        }
      }
    };
    if (!loading) {
      fetchPets();
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const fetchLocations = async () => {
      if (!user) return;
      try {
        const token = localStorage.getItem('token');
        console.log('Enviando solicitud GET /locations con token:', token.slice(0, 20) + '...');
        const response = await fetchWithRetry(
          `http://localhost:5000/users/${user.user_id}/locations`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log('Respuesta de GET /locations:', response.data);
        setLocations(response.data);
      } catch (error) {
        console.error('Error al obtener ubicaciones:', error);
        if (error.response?.status === 401) {
          setError('Sesión inválida. Por favor, inicia sesión nuevamente.');
          navigate('/login');
        } else if (error.response?.status === 404) {
          setError('Usuario no encontrado. Reintentando...');
        } else {
          setError(error.response?.data?.error || 'No se pudieron cargar las ubicaciones. Por favor, intenta de nuevo.');
        }
      }
    };
    if (!loading) {
      fetchLocations();
    }
  }, [loading, user, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  function AddLocation() {
    useMapEvents({
      click(e) {
        if (addingLocation && selectedPet) {
          const { lat, lng } = e.latlng;
          const token = localStorage.getItem('token');
          console.log('Enviando solicitud POST /scan con token:', token.slice(0, 20) + '...');
          axios
            .post(
              `http://localhost:5000/scan/${selectedPet}`,
              { latitude: lat, longitude: lng },
              { headers: { Authorization: `Bearer ${token}` } }
            )
            .then((response) => {
              console.log('Respuesta de POST /scan:', response.data);
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

  const handleAddPet = async () => {
    if (!newPetName) {
      setError('El nombre de la mascota es requerido.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      console.log('Enviando solicitud POST /pets con token:', token.slice(0, 20) + '...');
      const response = await axios.post(
        `http://localhost:5000/users/${user.user_id}/pets`,
        {
          name: newPetName,
          photo: newPetPhoto || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('Respuesta de POST /pets:', response.data);
      const newPet = response.data;
      setPets((prev) => [
        ...prev,
        {
          id: newPet.id,
          name: newPet.name,
          photo: newPet.photo || null,  // Usar la URL del backend
        },
      ]);
      setNewPetName('');
      setNewPetPhoto('');
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

  const lastLocation = useMemo(() => {
    if (locations.length === 0) return null;
    return locations.reduce((latest, loc) => (new Date(loc.created_at) > new Date(latest.created_at) ? loc : latest));
  }, [locations]);

  useEffect(() => {
    if (leafletMap && lastLocation) {
      leafletMap.flyTo([lastLocation.latitude, lastLocation.longitude], 15);
    }
  }, [leafletMap, lastLocation]);

  const normalIcon = new L.Icon({
    iconUrl: '/bluemark.png',
    shadowUrl: '/shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
  const lastIcon = new L.Icon({
    iconUrl: '/redmark.png',
    shadowUrl: '/shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

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
              <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition relative z-10">
                <h3 className="text-lg font-medium">Ubicaciones</h3>
                <p className="text-gray-600">Visualiza en el mapa dónde se han escaneado los códigos QR.</p>
                <div className="mt-4 flex items-center space-x-4 relative z-20">
                  <select
                    value={selectedPet || ""}
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
                  {selectedPet && (
                    <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100">
                        {pets.find((p) => p.id === selectedPet)?.photo ? (
                          <img
                            src={pets.find((p) => p.id === selectedPet)?.photo || "/placeholder.svg"}
                            alt="Pet"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-200 to-purple-200"></div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-blue-800">
                        {pets.find((p) => p.id === selectedPet)?.name}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => setAddingLocation(true)}
                    disabled={!selectedPet || addingLocation}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition disabled:bg-gray-400"
                  >
                    {addingLocation ? "Haz clic en el mapa" : "Agregar Escaneo"}
                  </button>
                  {addingLocation && (
                    <button
                      onClick={() => setAddingLocation(false)}
                      className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={() => setQrModalOpen(true)}
                    disabled={!selectedPet}
                    className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition disabled:bg-gray-400"
                  >
                    Ver QR
                  </button>
                </div>
                <div className="mt-4 h-96 relative z-10">
                  <MapContainer
                    center={[-35.4075, -71.6369]}
                    zoom={15}
                    style={{ height: "100%", width: "100%" }}
                    whenReady={({ target }) => setLeafletMap(target)}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <AddLocation />
                    {locations.map((loc) => (
                      <Marker
                        key={`${loc.pet_id}-${loc.created_at}`}
                        position={[loc.latitude, loc.longitude]}
                        icon={lastLocation && lastLocation.created_at === loc.created_at ? lastIcon : normalIcon}
                      >
                        <Popup>
                          <div className="text-center">
                            {pets.find((p) => p.id === loc.pet_id)?.photo && (
                              <div className="mb-2">
                                <img
                                  src={pets.find((p) => p.id === loc.pet_id)?.photo || "/placeholder.svg"}
                                  alt={loc.pet_name}
                                  className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-blue-200"
                                />
                              </div>
                            )}
                            <strong>{loc.pet_name}</strong>
                            {lastLocation && lastLocation.created_at === loc.created_at && (
                              <p className="text-red-600 text-sm font-medium">Última ubicación registrada</p>
                            )}
                            <p className="text-sm text-gray-600">
                              Escaneado: {new Date(loc.created_at).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              Lat: {loc.latitude.toFixed(4)}, Lng: {loc.longitude.toFixed(4)}
                            </p>
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
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded shadow-lg relative z-50 max-w-sm w-full">
            <h3 className="text-lg font-medium mb-4">Agregar Nueva Mascota</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Foto de la mascota (opcional)</label>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                  {newPetPhoto ? (
                    <img src={newPetPhoto || "/placeholder.svg"} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="cursor-pointer bg-blue-50 text-blue-600 px-3 py-2 rounded text-sm hover:bg-blue-100 transition"
                  >
                    {newPetPhoto ? "Cambiar foto" : "Subir foto"}
                  </label>
                  {newPetPhoto && (
                    <button
                      type="button"
                      onClick={() => setNewPetPhoto("")}
                      className="ml-2 text-red-600 text-sm hover:text-red-800"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
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
      {qrModalOpen && selectedPet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded shadow-lg relative z-50 max-w-sm w-full">
            <h3 className="text-lg font-medium mb-4">
              Código QR para {pets.find((pet) => pet.id === selectedPet)?.name || "Mascota"}
            </h3>
            <div className="flex justify-center my-4" ref={qrRef}>
              <QRCode value={`http://localhost:5000/scan/${selectedPet}`} size={200} level="H" includeMargin={true} />
            </div>
            <p className="text-sm text-gray-600 text-center mb-4">
              Escanea este código QR para registrar la ubicación de tu mascota.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={downloadQRCode}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
              >
                Descargar QR
              </button>
              <button
                onClick={() => setQrModalOpen(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}