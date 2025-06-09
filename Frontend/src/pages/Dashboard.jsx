import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import API_CONFIG from '../config/api';
import Notifications from '../components/Notifications';

// MUI imports
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import QrCodeIcon from '@mui/icons-material/QrCode';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  createTheme,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Paleta personalizada basada en #059669
const theme = createTheme({
  palette: {
    primary: {
      main: '#059669',
      contrastText: '#fff',
    },
    secondary: {
      main: '#10b981',
      contrastText: '#fff',
    },
    success: {
      main: '#059669',
      contrastText: '#fff',
    },
    error: {
      main: '#dc2626',
      contrastText: '#fff',
    },
    background: {
      default: '#f6fefb',
      paper: '#ffffff',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(90deg, #059669 0%, #10b981 100%)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [pets, setPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);  const [newPetName, setNewPetName] = useState('');
  const [newPetPhoto, setNewPetPhoto] = useState('');
  const [error, setError] = useState(null);
  const [leafletMap, setLeafletMap] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [toastOpen, setToastOpen] = useState(false);

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
        const response = await fetchWithRetry(
          `${API_CONFIG.BACKEND_URL}/users/${user.user_id}/pets`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log("red")
        
        // Verificar que la respuesta sea un array
        const petsData = Array.isArray(response.data) ? response.data : [];
        setPets(petsData);
        
        if (petsData.length > 0) {
          setSelectedPet(petsData[0].id);
        }
      } catch (error) {
        console.error('Error fetching pets:', error);
        // Asegurar que pets sea un array en caso de error
        setPets([]);
        
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
        const response = await fetchWithRetry(
          `${API_CONFIG.BACKEND_URL}/users/${user.user_id}/locations`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        // Verificar que la respuesta sea un array
        const locationsData = Array.isArray(response.data) ? response.data : [];
        setLocations(locationsData);
      } catch (error) {
        console.error('Error fetching locations:', error);
        // Asegurar que locations sea un array en caso de error
        setLocations([]);
        
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
    }  }, [loading, user, navigate]);

  // Función para obtener el contador de notificaciones sin leer
  const fetchNotificationCount = async () => {
    if (!user || !user.user_id) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_CONFIG.BACKEND_URL}/users/${user.user_id}/notifications/count`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      const count = response.data.unread_count || 0;
      setNotificationCount(count);
      
      // Mostrar el Toast solo si hay notificaciones sin leer
      if (count > 0) {
        setToastOpen(true);
      }
    } catch (err) {
      console.error('Error al obtener contador de notificaciones:', err);
    }
  };

  // Cargar contador de notificaciones cuando el usuario esté disponible
  useEffect(() => {
    if (user) {
      fetchNotificationCount();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
          axios
            .post(
              `${API_CONFIG.BACKEND_URL}/scan/${selectedPet}`,
              { latitude: lat, longitude: lng },
              { headers: { Authorization: `Bearer ${token}` } }
            )
            .then((response) => {
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
      console.log("Guardando mascota:", newPetName);
      
      const response = await axios.post(
        `${API_CONFIG.BACKEND_URL}/users/${user.user_id}/pets`,
        {
          name: newPetName,
          photo: newPetPhoto || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log("Mascota guardada, respuesta:", response.data);
      
      const newPet = response.data;
      
      // Agregar la nueva mascota al estado local
      setPets((prev) => [
        ...prev,
        {
          id: newPet.id,
          name: newPet.name,
          photo: newPet.photo || null,
        },
      ]);
      
      // Limpiar el formulario
      setNewPetName('');
      setNewPetPhoto('');
      setModalOpen(false);
      
      // IMPORTANTE: Hacer refetch desde el servidor para verificar que se guardó
      setTimeout(async () => {
        try {
          console.log("Haciendo refetch de mascotas...");
          const refetchResponse = await axios.get(
            `${API_CONFIG.BACKEND_URL}/users/${user.user_id}/pets`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log("Refetch completado:", refetchResponse.data);
          setPets(refetchResponse.data);
        } catch (refetchError) {
          console.error("Error en refetch:", refetchError);
        }
      }, 1000); // Esperar 1 segundo para que Firestore sincronice
      
    } catch (error) {
      console.error("Error al guardar mascota:", error);
      if (error.response?.status === 401) {
        setError('Sesión inválida. Por favor, inicia sesión nuevamente.');
        navigate('/login');
      } else {
        setError(error.response?.data?.error || 'No se pudo agregar la mascota. Por favor, intenta de nuevo.');
      }
    }
  };

  const handlePetClick = (petId) => {
    setSelectedPet(petId);
  };

  const filteredLocations = useMemo(() => {
    if (!selectedPet) return locations;
    return locations.filter((loc) => loc.pet_id === selectedPet);
  }, [locations, selectedPet]);

  const lastLocation = useMemo(() => {
    if (filteredLocations.length == 0) return null;
    return filteredLocations.reduce((latest, loc) => (new Date(loc.created_at) > new Date(latest.created_at) ? loc : latest));
  }, [filteredLocations]);

  useEffect(() => {
    if (leafletMap && lastLocation) {
      leafletMap.flyTo([lastLocation.latitude, lastLocation.longitude], 17);
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
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="background.default">
          <CircularProgress size={48} color="primary" />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={1}>        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            GPS Pasivo
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            Hola, {user?.nombre || user?.email}
          </Typography>
          <Notifications />
          <Button
            color="inherit"
            startIcon={<PersonIcon />}
            onClick={() => navigate('/profile')}
            variant="outlined"
            sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: '#fff' }, mr: 2 }}
          >
            Mi Perfil
          </Button>
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            variant="outlined"
            sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: '#fff' } }}
          >
            Cerrar Sesión
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom color="primary">
            Panel de Control
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Bienvenido al sistema de GPS Pasivo. Desde aquí podrás gestionar tus mascotas y ver sus ubicaciones.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} mt={4}>
            <Paper elevation={1} sx={{ flex: 1, p: 3, bgcolor: 'background.default' }}>
              <Typography variant="h6" gutterBottom color="primary">
                Mis Mascotas
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Gestiona los perfiles de tus mascotas y sus códigos QR.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ mt: 2 }}
                onClick={() => setModalOpen(true)}
                color="primary"
              >
                Agregar Mascota
              </Button>
              <Box mt={3}>
                <Stack direction="column" spacing={2}>
                  {pets.map((pet) => (
                    <Button
                      key={pet.id}
                      variant={selectedPet === pet.id ? "contained" : "outlined"}
                      color="primary"
                      onClick={() => handlePetClick(pet.id)}
                      sx={{
                        mb: 1,
                        textTransform: 'none',
                        justifyContent: 'flex-start',
                        borderRadius: 2,
                        bgcolor: selectedPet === pet.id ? 'primary.main' : 'background.paper',
                      }}
                    >
                      <Box display="flex" alignItems="center">
                        <Avatar
                          src={pet.photo || "/placeholder.svg"}
                          alt={pet.name}
                          sx={{ width: 48, height: 48, mr: 1, bgcolor: 'secondary.main' }}
                        />
                        <Typography variant="body1">{pet.name}</Typography>
                      </Box>
                    </Button>
                  ))}
                </Stack>
              </Box>
            </Paper>
            <Paper elevation={1} sx={{ flex: 2, p: 3, bgcolor: 'background.default' }}>
              <Typography variant="h6" gutterBottom color="primary">
                Ubicaciones
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Visualiza en el mapa dónde se han escaneado los códigos QR.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mt={2}>
                {selectedPet && (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: '#e0f7f1', px: 2, py: 1, borderRadius: 2 }}>
                    <Avatar
                      src={pets.find((p) => p.id === selectedPet)?.photo || "/placeholder.svg"}
                      alt="Pet"
                      sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}
                    />
                    <Typography variant="body2" color="primary">
                      {pets.find((p) => p.id === selectedPet)?.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({filteredLocations.length} ubicaciones)
                    </Typography>
                  </Stack>
                )}
                {selectedPet && (
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Ver código QR">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<QrCodeIcon />}
                        onClick={() => setQrModalOpen(true)}
                        sx={{ color: 'white', background: '#059669' }}
                      >
                        Mostrar QR
                      </Button>
                    </Tooltip>
                  </Stack>
                )}
              </Stack>
              <Box mt={3} height={384} borderRadius={2} overflow="hidden" sx={{ border: '1px solid #e0e0e0' }}>
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
                  {filteredLocations.map((loc) => (
                    <Marker
                      key={`${loc.pet_id}-${loc.created_at}`}
                      position={[loc.latitude, loc.longitude]}
                      icon={lastLocation && lastLocation.created_at === loc.created_at ? lastIcon : normalIcon}
                    >
                      <Popup>
                        <Box textAlign="center">
                          {pets.find((p) => p.id === loc.pet_id)?.photo && (
                            <Box mb={1}>
                              <Avatar
                                src={pets.find((p) => p.id === loc.pet_id)?.photo || "/placeholder.svg"}
                                alt={loc.pet_name}
                                sx={{ width: 64, height: 64, mx: "auto", mb: 1, border: "2px solid #059669" }}
                              />
                            </Box>
                          )}
                          <Typography fontWeight="bold">{loc.pet_name}</Typography>
                          {lastLocation && lastLocation.created_at === loc.created_at && (
                            <Typography color="error" fontSize={14} fontWeight="medium">
                              Última ubicación registrada
                            </Typography>
                          )}
                          <Typography fontSize={13} color="text.secondary">
                            Escaneado: {new Date(loc.created_at).toLocaleString()}
                          </Typography>
                          <Typography fontSize={12} color="text.disabled">
                            Lat: {loc.latitude.toFixed(4)}, Lng: {loc.longitude.toFixed(4)}
                          </Typography>
                        </Box>
                      </Popup>
                    </Marker>
                  ))}
                  {/* Mensaje cuando no hay ubicaciones para la mascota seleccionada */}
                  {selectedPet && filteredLocations.length === 0 && (
                    <Box
                      position="absolute"
                      top="50%"
                      left="50%"
                      sx={{ 
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                        bgcolor: 'rgba(255, 255, 255, 0.9)',
                        p: 2,
                        borderRadius: 2,
                        boxShadow: 2
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        No hay ubicaciones registradas para {pets.find((p) => p.id === selectedPet)?.name}
                      </Typography>
                    </Box>
                  )}
                </MapContainer>
              </Box>
            </Paper>
          </Stack>
        </Paper>
      </Container>
      {/* Modal para agregar mascota */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Agregar Nueva Mascota</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar
                src={newPetPhoto || "/placeholder.svg"}
                alt="Preview"
                sx={{ width: 64, height: 64, bgcolor: '#e0f7f1', border: '2px solid #059669' }}
              />
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="photo-upload"
                type="file"
                onChange={handlePhotoUpload}
              />
              <label htmlFor="photo-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<PhotoCamera />}
                  size="small"
                  color="primary"
                >
                  {newPetPhoto ? "Cambiar foto" : "Subir foto"}
                </Button>
              </label>
              {newPetPhoto && (
                <Button
                  variant="text"
                  color="error"
                  size="small"
                  onClick={() => setNewPetPhoto("")}
                >
                  Quitar
                </Button>
              )}
            </Box>
            <TextField
              label="Nombre de la mascota"
              value={newPetName}
              onChange={(e) => setNewPetName(e.target.value)}
              fullWidth
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleAddPet} variant="contained" color="primary">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
      {/* Modal para QR */}
      <Dialog open={qrModalOpen && !!selectedPet} onClose={() => setQrModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Código QR para {pets.find((pet) => pet.id === selectedPet)?.name || "Mascota"}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" justifyContent="center" my={2} ref={qrRef}>
            <QRCode value={`${API_CONFIG.FRONTEND_URL}/scan/${selectedPet}`} size={200} level="H" includeMargin={true} />
          </Box>
          <Typography variant="body2" color="text.secondary" align="center" mb={2}>
            Escanea este código QR para registrar la ubicación de tu mascota.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={downloadQRCode}
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
          >
            Descargar QR
          </Button>
          <Button onClick={() => setQrModalOpen(false)} color="inherit">
            Cerrar
          </Button>        </DialogActions>
      </Dialog>
      
      {/* Toast de notificaciones */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={6000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setToastOpen(false)} 
          severity="info" 
          variant="filled"
          sx={{ width: '100%', cursor: 'pointer' }}
          onClick={() => {
            navigate('/notifications');
            setToastOpen(false);
          }}
        >
          Tienes {notificationCount} {notificationCount === 1 ? 'notificación' : 'notificaciones'} sin leer
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}