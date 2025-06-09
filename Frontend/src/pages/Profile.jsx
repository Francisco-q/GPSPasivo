import axios from 'axios';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import fondologin from '../assets/fondologin.png';
import Notifications from '../components/Notifications';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  Paper,
  Alert,
  TextField,
  Stack,
  CircularProgress,
  ThemeProvider,
  createTheme,
  CssBaseline,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';
import KeyIcon from '@mui/icons-material/Key';
import API_CONFIG from '../config/api';

// Paleta personalizada basada en #059669 (igual que en Dashboard)
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

export default function Profile() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

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
        setEmail(userData.email);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Obtener datos actualizados del usuario
        axios.get(`${API_CONFIG.BACKEND_URL}/users/${userData.user_id}/profile`)
          .then(response => {
            setPhone(response.data.phone || '');
            setLoading(false);
          })
          .catch(err => {
            console.error('Error al obtener perfil:', err);
            setLoading(false);
          });
      } catch (error) {
        setError('Error al cargar los datos del usuario.');
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate]);
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const response = await axios.put(`${API_CONFIG.BACKEND_URL}/users/${user.user_id}/profile`, {
        email,
        phone
      });
      
      // Actualizar el usuario en localStorage
      const updatedUser = {
        ...user,
        email
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      setSuccess('Perfil actualizado correctamente');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el perfil');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }

    try {
      await axios.put(`${API_CONFIG.BACKEND_URL}/users/${user.user_id}/password`, {
        currentPassword,
        newPassword
      });
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Contraseña actualizada correctamente');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar la contraseña');
    }
  };
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
      <CssBaseline />      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            GPS Pasivo - Mi Perfil
          </Typography>
          <Notifications />
          <Button
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
            variant="outlined"
            sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: '#fff' } }}
          >
            Volver al Dashboard
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
          <Paper elevation={3} sx={{ flex: 1, p: 4 }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom color="primary" sx={{ display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ mr: 1 }} /> Información Personal
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Actualiza tu información de contacto
            </Typography>
            
            <form onSubmit={handleUpdateProfile}>
              <Stack spacing={3} mt={3}>
                <TextField
                  label="Correo Electrónico"
                  variant="outlined"
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                />
                
                <TextField
                  label="Número de Teléfono"
                  variant="outlined"
                  fullWidth
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56912345678"
                  type="tel"
                />
                
                <Button 
                  type="submit" 
                  variant="contained" 
                  color="primary"
                  startIcon={<SaveIcon />}
                  size="large"
                >
                  Guardar Cambios
                </Button>
              </Stack>
            </form>
          </Paper>
          
          <Paper elevation={3} sx={{ flex: 1, p: 4 }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom color="secondary" sx={{ display: 'flex', alignItems: 'center' }}>
              <KeyIcon sx={{ mr: 1 }} /> Cambiar Contraseña
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Actualiza tu contraseña para mantener segura tu cuenta
            </Typography>
            
            <form onSubmit={handleChangePassword}>
              <Stack spacing={3} mt={3}>
                <TextField
                  label="Contraseña Actual"
                  variant="outlined"
                  fullWidth
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  type="password"
                />
                
                <TextField
                  label="Nueva Contraseña"
                  variant="outlined"
                  fullWidth
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  type="password"
                />
                
                <TextField
                  label="Confirmar Nueva Contraseña"
                  variant="outlined"
                  fullWidth
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  type="password"
                  error={newPassword !== confirmPassword && confirmPassword !== ''}
                  helperText={newPassword !== confirmPassword && confirmPassword !== '' ? 'Las contraseñas no coinciden' : ''}
                />
                
                <Button 
                  type="submit" 
                  variant="contained" 
                  color="secondary"
                  startIcon={<KeyIcon />}
                  size="large"
                >
                  Actualizar Contraseña
                </Button>
              </Stack>
            </form>
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
