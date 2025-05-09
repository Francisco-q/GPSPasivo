import { Link } from 'react-router-dom';

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">Iniciar Sesión</h2>
        <form>
          <div className="mb-4">
            <label className="block text-gray-700">Correo electrónico</label>
            <input type="email" className="w-full p-3 border rounded-xl" />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700">Contraseña</label>
            <input type="password" className="w-full p-3 border rounded-xl" />
          </div>
          <button className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700">Entrar</button>
          <p className="text-center text-sm mt-4">
            ¿No tienes cuenta? <Link to="/register" className="text-blue-500 hover:underline">Regístrate</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
