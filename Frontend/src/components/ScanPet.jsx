import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  CircularProgress,
  Alert,
  Container,
} from '@mui/material';
import axios from 'axios';

export default function ScanPet() {
  const { petId } = useParams();
  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPet = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/pets/${petId}`);
        setPet(res.data);
      } catch (err) {
        setError('No se pudo encontrar la mascota.');
      } finally {
        setLoading(false);
      }
    };
    fetchPet();
  }, [petId]);

  if (loading) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Avatar
          src={pet.photo || '/placeholder.svg'}
          alt={pet.name}
          sx={{ width: 96, height: 96, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}
        />
        <Typography variant="h4" color="primary" gutterBottom>
          {pet.name}
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          ID: {pet.id}
        </Typography>
        {/* Agrega más información si tu API la entrega */}
      </Paper>
    </Container>
  );
}