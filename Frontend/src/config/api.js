import axios from 'axios';

const API_CONFIG = {
  // Cambia esta URL cuando ngrok genere una nueva
  BACKEND_URL: 'https://2963-181-42-33-9.ngrok-free.app',
  FRONTEND_URL:"https://192.168.134.148:5173"
};

axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

export default API_CONFIG;