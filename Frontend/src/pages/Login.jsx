import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/firebase-config'; 
import axios from 'axios';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Autenticar con Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();      // Verificar con backend Flask
      const response = await axios.post('http://localhost:5000/login', {
        idToken: token
      });

      // Guardar información del usuario en localStorage para mantener la sesión
      localStorage.setItem('user', JSON.stringify({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName || ''
      }));

      // Redirigir al dashboard
      navigate('/dashboard');
        } catch (err) {
      console.error('Error detallado:', err);
      if (err.code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos');
      } else if (err.code === 'auth/user-not-found') {
        setError('El usuario no existe');
      } else if (err.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta');
      } else if (err.code === 'auth/invalid-email') {
        setError('Formato de correo inválido');
      } else if (err.response && err.response.data && err.response.data.error) {
        // Error del backend
        setError('Error del servidor: ' + err.response.data.error);
      } else {
        setError('Error de conexión: ' + (err.message || 'Verifique su conexión'));
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Iniciar Sesión</h2>
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
        
        <form onSubmit={handleSubmit}>
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
          
          <div className="mb-6">
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
          
          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition"
          >
            Entrar
          </button>
          
          <p className="text-sm text-center mt-4 text-gray-600">
            ¿No tienes cuenta?
            <Link to="/register" className="text-blue-500 hover:underline ml-1">Regístrate</Link>
          </p>
        </form>
      </div>
    </div>
  );
}