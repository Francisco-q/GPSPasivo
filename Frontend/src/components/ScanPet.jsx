import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  Button,
  Switch,
  TextField,
  FormControlLabel,
  Container,
  Stack,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Snackbar,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function ScanPet() {
  const { petId } = useParams();
  const navigate = useNavigate();
  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const fetchPet = async () => {
      try {
        const res = await axios.get(`http://192.168.2.106:5000/pets/${petId}`);
        setPet(res.data);
      } catch (err) {
        setError('No se pudo encontrar la mascota.');
      } finally {
        setLoading(false);
      }
    };
    fetchPet();
  }, [petId]);

  const handleReset = () => {
    setMessage('');
    setIsAnonymous(true);
    navigate('/');
  };

  const handleSendLocation = () => {
    if (!navigator.geolocation) {
      setError('La geolocalización no está soportada en este navegador.');
      return;
    }

    setSending(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Enviar solicitud POST al servidor
          await axios.post(
            `http://192.168.2.106:5000/scan/${petId}`,
            {
              latitude,
              longitude,
              message,
              isAnonymous,
            }
          );
          setSuccess(true);
          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
        } catch (err) {
          setError('No se pudo registrar la ubicación. Por favor, intenta de nuevo.');
          console.error('Error al enviar ubicación:', err);
        } finally {
          setSending(false);
        }
      },
      (geoError) => {
        let errorMessage = 'Error al obtener la ubicación.';
        if (geoError.code === geoError.PERMISSION_DENIED) {
          errorMessage = 'Permiso de geolocalización denegado. Por favor, habilita los permisos en la configuración de tu dispositivo.';
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          errorMessage = 'La ubicación no está disponible. Asegúrate de que el GPS esté activado.';
        } else if (geoError.code === geoError.TIMEOUT) {
          errorMessage = 'Tiempo de espera agotado al obtener la ubicación. Intenta de nuevo.';
        }
        setError(errorMessage);
        console.error('Error de geolocalización:', geoError.message);
        setSending(false);
      },
      {
        enableHighAccuracy: true, // Priorizar precisión
        timeout: 10000, // Tiempo máximo de espera: 10 segundos
        maximumAge: 0, // No usar ubicaciones en caché
      }
    );
  };

  if (loading) {
    return (
      <Box minHeight="80vh" display="flex" alignItems="center" justifyContent="center">
        <CircularProgress color="success" />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 6 }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="error" variant="h6">{error}</Typography>
          <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate('/')}>
            Volver al inicio
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 2, sm: 6 }, px: { xs: 0.5, sm: 2 } }}>
      <Box mb={2}>
        <Button href="/" size="small" sx={{ color: 'primary.main', textTransform: 'none' }}>
          ← Volver al inicio
        </Button>
      </Box>
      <Typography variant={isXs ? "h5" : "h4"} fontWeight="bold" mb={2} textAlign="center">
        Escanear código QR
      </Typography>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Typography variant={isXs ? "subtitle1" : "h6"} mb={2} textAlign="center">
          Escanear con cámara
        </Typography>
        <Box
          sx={{
            aspectRatio: '16/9',
            bgcolor: 'grey.100',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
            position: 'relative',
            overflow: 'hidden',
            minHeight: { xs: 160, sm: 200 },
          }}
        >
          <Stack alignItems="center" width="100%">
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: 'success.light',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main' }} />
            </Box>
            <Typography color="success.main" fontWeight="medium" mb={1}>
              ¡Código QR escaneado con éxito!
            </Typography>
            <Box
              sx={{
                mt: 1,
                textAlign: 'left',
                bgcolor: 'background.paper',
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'grey.200',
                width: '100%',
                maxWidth: 320,
                mx: 'auto',
              }}
            >
              <Typography fontWeight="medium">Mascota encontrada:</Typography>
              <Typography variant="body2" color="text.secondary">
                {pet.name} ({pet.breed || 'Sin raza'})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dueño: {pet.owner || 'Desconocido'}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack spacing={2} mb={2}>
          <TextField
            label="Mensaje para el dueño (opcional)"
            multiline
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            fullWidth
            size={isXs ? "small" : "medium"}
          />
          <FormControlLabel
            control={
              <Switch
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                color="success"
                size={isXs ? "small" : "medium"}
              />
            }
            label="Mantener mi identidad anónima"
            sx={{ ml: 0 }}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={1}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={handleReset}
            fullWidth
            size={isXs ? "small" : "medium"}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            fullWidth
            size={isXs ? "small" : "medium"}
            onClick={handleSendLocation}
            disabled={sending}
          >
            {sending ? "Enviando..." : "Enviar ubicación"}
          </Button>
        </Stack>
      </Paper>
      <Snackbar open={success} autoHideDuration={2000}>
        <Alert severity="success" sx={{ width: '100%' }}>
          ¡Ubicación enviada correctamente!
        </Alert>
      </Snackbar>
      <Snackbar open={!!error && !loading} autoHideDuration={4000} onClose={() => setError('')}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
}