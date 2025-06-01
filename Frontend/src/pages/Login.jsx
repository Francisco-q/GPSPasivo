import axios from 'axios';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import fondologin from '../assets/fondologin.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/login', {
        email,
        password,
      });

      console.log('Respuesta de login:', response.data);

      // Guardar token y datos del usuario en localStorage
      if (!response.data.token) {
        throw new Error('No se recibió un token en la respuesta del servidor');
      }
      localStorage.setItem('token', response.data.token);
      localStorage.setItem(
        'user',
        JSON.stringify({
          email: response.data.email,
          nombre: response.data.nombre,
          user_id: response.data.user_id,
        })
      );

      // Configurar el token en axios para solicitudes futuras
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

      // Esperar un momento para asegurar la consistencia de Firestore
      await new Promise((resolve) => setTimeout(resolve, 1000));

      navigate('/dashboard');
    } catch (err) {
      console.error('Error en login:', err);
      setError(err.response?.data?.error || 'Error al iniciar sesión. Por favor, verifica tus credenciales.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ 
      backgroundImage: `url(${fondologin})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <div className="bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-lg w-full max-w-md border border-emerald-200">
        <h2 className="text-2xl font-bold text-center mb-6 text-emerald-800">Iniciar Sesión</h2>
        {error && <p className="text-red-500 text-sm mb-4 text-center bg-red-50 p-3 rounded-lg border border-red-200">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-emerald-800 font-medium mb-2">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white/95 transition-all duration-200"
              placeholder="tucorreo@ejemplo.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-emerald-800 font-medium mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white/95 transition-all duration-200"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
          >
            Entrar
          </button>

          <p className="text-sm text-center mt-4 text-emerald-900">
            ¿No tienes cuenta?
            <Link to="/register" className="text-emerald-700 hover:text-emerald-800 hover:underline ml-1 font-semibold transition-colors duration-200">
              Regístrate
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}