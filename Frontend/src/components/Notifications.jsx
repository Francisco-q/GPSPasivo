import { useEffect, useState } from 'react';
import { 
  Badge,
  IconButton,
  Tooltip
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_CONFIG from '../config/api';

// Componente de notificaciones (solo botón para navegar)
export default function Notifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Verificar usuario al montar
  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      try {
        const userData = JSON.parse(userString);
        setUser(userData);
      } catch (err) {
        console.error('Error al parsear datos de usuario:', err);
      }
    }
  }, []);

  // Función para actualizar solo el contador de notificaciones
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
      
      setUnreadCount(response.data.unread_count || 0);
    } catch (err) {
      console.error('Error al obtener contador de notificaciones:', err);
    }
  };  // Cargar contador de notificaciones al montar el componente
  useEffect(() => {
    if (user) {
      fetchNotificationCount();
      
      // Actualizar contador cada 60 segundos
      const interval = setInterval(fetchNotificationCount, 60000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  return (
    <Tooltip title="Ver notificaciones">
      <IconButton color="inherit" onClick={() => navigate('/notifications')}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
