// Importamos los módulos necesarios de Firebase 11.x
import { initializeApp } from "firebase/app";
// Importamos explícitamente el módulo de autenticación
import { getAuth } from "firebase/auth";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA4wIevNTvO3eaKw6EzbbekcGGRZme_Xbk",
  authDomain: "gps-pasivo.firebaseapp.com",
  projectId: "gps-pasivo",
  storageBucket: "gps-pasivo.appspot.com",
  messagingSenderId: "92665958127",
  appId: "1:92665958127:web:cd68cd8565bf35bcb3951a"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firebase Auth
const auth = getAuth(app);

export { auth };