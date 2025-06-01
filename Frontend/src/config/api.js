import axios from 'axios';

const API_CONFIG = {
  // Cambia esta URL cuando ngrok genere una nueva
  BACKEND_URL: 'https://e6f9-179-60-65-35.ngrok-free.app',
  FRONTEND_URL: 'https://192.168.2.106:5173'
};

axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

export default API_CONFIG;