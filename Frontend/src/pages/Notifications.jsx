import { useEffect, useState } from 'react';
import { 
  Alert,
  AppBar,
  Badge,
  Box, 
  Button, 
  Container,
  CssBaseline,
  createTheme,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  ThemeProvider,
  Toolbar,
  Typography,
  Tooltip,
  CircularProgress
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import API_CONFIG from '../config/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Tema personalizado (igual que Dashboard)
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

// Página de notificaciones
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Verificar autenticación
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (!token || !storedUser) {
        setError('Sesión no encontrada. Por favor, inicia sesión nuevamente.');
        navigate('/login');
        return;
      }      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        setError('Error al cargar los datos del usuario.');
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate]);
  // Función para obtener notificaciones
  const fetchNotifications = async () => {
    if (!user || !user.user_id) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_CONFIG.BACKEND_URL}/users/${user.user_id}/notifications`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
      setError(null);
    } catch (err) {
      console.error('Error al obtener notificaciones:', err);
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError('No se pudieron cargar las notificaciones');
      }
    } finally {
      setLoading(false);
    }
  };
  // Función para marcar una notificación como leída
  const markAsRead = async (notificationId) => {
    if (!user || !user.user_id) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_CONFIG.BACKEND_URL}/users/${user.user_id}/notifications/${notificationId}`,
        { leido: true },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      // Actualizar el estado local
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, leido: true } : n
        )
      );
      
      // Actualizar el contador
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error al marcar notificación como leída:', err);
    }
  };
  // Función para marcar todas las notificaciones como leídas
  const markAllAsRead = async () => {
    if (!user || !user.user_id) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_CONFIG.BACKEND_URL}/users/${user.user_id}/notifications/mark-all-read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      // Actualizar el estado local
      setNotifications(prev => 
        prev.map(n => ({ ...n, leido: true }))
      );
      
      // Actualizar el contador
      setUnreadCount(0);
    } catch (err) {
      console.error('Error al marcar todas las notificaciones como leídas:', err);
    }
  };

  // Formatear fecha de notificación
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
    } catch (err) {
      return dateString;
    }  };  // Cargar notificaciones al montar el componente
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowBackIcon />
          </IconButton>
          <NotificationsIcon sx={{ ml: 2, mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Notificaciones
          </Typography>
          <Badge badgeContent={unreadCount} color="error" sx={{ mr: 2 }}>
            <NotificationsIcon />
          </Badge>
          {unreadCount > 0 && (
            <Button 
              color="inherit"
              variant="outlined"
              size="small"
              startIcon={<MarkEmailReadIcon />}
              onClick={markAllAsRead}
              sx={{ 
                borderColor: 'white', 
                color: 'white', 
                '&:hover': { borderColor: '#fff' } 
              }}
            >
              Marcar todas como leídas
            </Button>
          )}
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ overflow: 'hidden' }}>
          <Box sx={{ p: 3, bgcolor: 'primary.main', color: 'white' }}>
            <Typography variant="h5" fontWeight="bold">
              Mis Notificaciones
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
              {notifications.length === 0 
                ? 'No tienes notificaciones' 
                : `${notifications.length} notificación${notifications.length !== 1 ? 'es' : ''} total${notifications.length !== 1 ? 'es' : ''}`
              }
              {unreadCount > 0 && ` • ${unreadCount} sin leer`}
            </Typography>          </Box>
          
          {error ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : loading ? (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ py: 8 }}>
              <NotificationsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Cargando notificaciones...
              </Typography>
            </Box>
          ) : notifications.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ py: 8 }}>
              <NotificationsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No tienes notificaciones
              </Typography>
              <Typography variant="body2" color="text.disabled">
                Las notificaciones aparecerán aquí cuando ocurran eventos importantes
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.map((notification, index) => (
                <Box key={notification.id}>                  <ListItem 
                    alignItems="flex-start"
                    sx={{
                      bgcolor: notification.leido ? 'transparent' : 'rgba(25, 118, 210, 0.04)',
                      px: 3,
                      py: 2,
                      '&:hover': {
                        bgcolor: notification.leido ? 'rgba(0, 0, 0, 0.02)' : 'rgba(25, 118, 210, 0.08)'
                      }
                    }}
                  >
                    <Box width="100%">
                      {/* Sección principal (título) */}
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography
                          variant="body1"
                          component="div"
                          fontWeight={notification.leido ? 'normal' : 'bold'}
                          sx={{ flex: 1, mr: 2 }}
                        >
                          {notification.message}
                        </Typography>
                        {!notification.leido && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              flexShrink: 0,
                              mt: 0.5
                            }}
                          />
                        )}
                      </Box>

                      {/* Sección secundaria (detalles) */}
                      <Box mt={1}>
                        <Typography variant="body2" component="div" color="text.secondary">
                          {formatDate(notification.created_at)}
                        </Typography>
                        
                        {notification.latitude && notification.longitude && (
                          <Typography variant="body2" component="div" color="text.secondary" sx={{ mt: 1 }}>
                            📍 Ubicación: {notification.location_info || `${notification.latitude.toFixed(6)}, ${notification.longitude.toFixed(6)}`}
                          </Typography>
                        )}
                        
                        {notification.user_message && (
                          <Typography 
                            variant="body2" 
                            component="div"
                            color="text.secondary" 
                            sx={{ 
                              mt: 1,
                              fontStyle: 'italic',
                              bgcolor: 'rgba(0, 0, 0, 0.02)',
                              p: 1,
                              borderRadius: 1,
                              borderLeft: 3,
                              borderLeftColor: 'primary.main'
                            }}
                          >
                            💬 "{notification.user_message}"
                          </Typography>
                        )}
                        
                        {!notification.leido && (
                          <Box sx={{ mt: 2 }}>
                            <Button 
                              variant="contained" 
                              size="small"
                              onClick={() => markAsRead(notification.id)}
                              sx={{ borderRadius: 2 }}
                            >
                              Marcar como leída
                            </Button>
                          </Box>
                        )}                      </Box>
                    </Box>
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </Paper>
      </Container>
    </ThemeProvider>
  );
}
