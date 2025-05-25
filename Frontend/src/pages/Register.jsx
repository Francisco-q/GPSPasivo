import axios from 'axios';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import fondologin from '../assets/fondologin.png';


export default function Register() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/register', {
        nombre,
        email,
        password
      });

      if (response.status === 201) {
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar usuario');
    }
  };  return (
    <div className="min-h-screen flex items-center justify-center" style={{ 
      backgroundImage: `url(${fondologin})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg w-full max-w-md border border-green-200">
        <h2 className="text-2xl font-bold text-center mb-6 text-green-800">Registro</h2>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700">Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"

          <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-green-800">Nombre completo</label>
            <input 
              type="text" 
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-3 border border-green-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white/90" 

              placeholder="Tu nombre"
              required
            />
          </div>

          <div className="mb-4">

            <label className="block text-gray-700">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"

            <label className="block text-green-800">Correo electrónico</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-green-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white/90" 

              placeholder="tucorreo@ejemplo.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"

            <label className="block text-green-800">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-green-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white/90" 

              placeholder="••••••••"
              required
            />
          </div>

          <div className="mb-6">

            <label className="block text-gray-700">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"

            <label className="block text-green-800">Confirmar contraseña</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border border-green-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white/90" 

              placeholder="••••••••"
              required
            />
          </div>


          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition"
          >
            Registrarse
          </button>

          <p className="text-sm text-center mt-4 text-gray-600">

            <button 
            type="submit" 
            className="w-full bg-green-700 text-white py-3 rounded-xl hover:bg-green-800 transition shadow-md"
          >
            Registrarse
          </button>
          
          <p className="text-sm text-center mt-4 text-green-900">

            ¿Ya tienes cuenta?
            <Link to="/login" className="text-green-700 hover:underline ml-1 font-semibold">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
}