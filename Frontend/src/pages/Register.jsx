import { Link } from 'react-router-dom';

export default function Register() {
  return (
        <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 class="text-2xl font-bold text-center mb-6">Registro</h2>
        <form>
        <div class="mb-4">
            <label class="block text-gray-700">Nombre completo</label>
            <input type="text" class="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tu nombre"/>
        </div>
        <div class="mb-4">
            <label class="block text-gray-700">Correo electrónico</label>
            <input type="email" class="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="tucorreo@ejemplo.com"/>
        </div>
        <div class="mb-4">
            <label class="block text-gray-700">Contraseña</label>
            <input type="password" class="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••"/>
        </div>
        <div class="mb-6">
            <label class="block text-gray-700">Confirmar contraseña</label>
            <input type="password" class="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••"/>
        </div>
        <button type="submit" class="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition">Registrarse</button>
        <p class="text-sm text-center mt-4 text-gray-600">
            ¿Ya tienes cuenta?
            <a href="login.html" class="text-blue-500 hover:underline">Inicia sesión</a>
        </p>
        </form>
    </div>
    </div>
  );
}
