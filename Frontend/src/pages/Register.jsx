import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/firebase-config'; 
import axios from 'axios';
import { useState } from 'react';

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

    try {      // Registrar en backend Flask directamente
      // El backend se encargará de crear el usuario en Firebase Authentication
      await axios.post('http://localhost:5000/signup', {
        nombre,
        email,
        password
      });

      navigate('/login');
        } catch (err) {
      console.error('Error detallado:', err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error); // Mostrar error del backend
      } else if (err.code === 'auth/email-already-in-use') {
        setError('El correo ya está registrado');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres');
      } else if (err.code === 'auth/invalid-email') {
        setError('El formato de correo electrónico es inválido');
      } else {
        setError('Error al registrar el usuario: ' + (err.message || ''));
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Registro</h2>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700">Nombre completo</label>
            <input 
              type="text" 
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" 
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
            ¿Ya tienes cuenta?
            <Link to="/login" className="text-blue-500 hover:underline ml-1">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
}