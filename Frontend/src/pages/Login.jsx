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
  };  return (
    <div className="min-h-screen flex items-center justify-center" style={{ 
      backgroundImage: `url(${fondologin})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg w-full max-w-md border border-blue-200">
        <h2 className="text-2xl font-bold text-center mb-6 text-blue-800">Iniciar Sesión</h2>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        <form onSubmit={handleSubmit}>          <div className="mb-4">
            <label className="block text-blue-800">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/90"
              placeholder="tucorreo@ejemplo.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-blue-800">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/90"
              placeholder="••••••••"
              required
            />
          </div>          <button
            type="submit"
            className="w-full bg-blue-700 text-white py-3 rounded-xl hover:bg-blue-800 transition shadow-md"
          >
            Entrar
          </button>

          <p className="text-sm text-center mt-4 text-blue-900">
            ¿No tienes cuenta?
            <Link to="/register" className="text-blue-700 hover:underline ml-1 font-semibold">Regístrate</Link>
          </p>
        </form>
      </div>
    </div>
  );
}