import axios from 'axios';

const API_CONFIG = {
  // Cambia esta URL cuando ngrok genere una nueva
  BACKEND_URL: 'https://ed55-179-60-67-152.ngrok-free.app',
  FRONTEND_URL:"https://192.168.1.6:5173"
};

axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

export default API_CONFIG;