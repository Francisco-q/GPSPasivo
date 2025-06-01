from flask import Flask, request, jsonify, send_from_directory
import firebase_admin
from firebase_admin import credentials, firestore, auth
from datetime import datetime
import qrcode
import base64
from io import BytesIO
from flask_cors import CORS
import os
import uuid
from dotenv import find_dotenv, load_dotenv
from pathlib import Path
import time
import requests

# Cargar variables de entorno desde el archivo .env
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(env_path)

app = Flask(__name__)
# Configurar CORS más específicamente para manejar ngrok y localhost
CORS(app, 
     origins=[
         "https://192.168.2.106:5173", 
         "http://localhost:5173", 
         "https://localhost:5173",
         os.environ.get('FRONTEND_URL', 'https://192.168.2.106:5173')
     ],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
     supports_credentials=True)

# Configurar carpeta para almacenar imágenes
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Inicializar Firebase (sin storageBucket)
try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
except Exception as e:
    print(f"Error al inicializar Firebase: {str(e)}")
    raise

# Obtener instancia de Firestore
db = firestore.client()

def get_base_url():
    """Obtiene la URL base del servidor (ngrok o localhost)"""
    # Primero intenta obtener la URL de ngrok desde las variables de entorno
    ngrok_url = os.environ.get('NGROK_URL')
    if ngrok_url:
        return ngrok_url
    
    # Si no está en el .env, intenta obtenerla de la API de ngrok
    try:
        response = requests.get('http://localhost:4040/api/tunnels', timeout=2)
        tunnels = response.json()
        
        for tunnel in tunnels['tunnels']:
            if tunnel['proto'] == 'https':
                url = tunnel['public_url']
                print(f"URL de ngrok detectada automáticamente: {url}")
                return url
    except Exception as e:
        print(f"No se pudo obtener URL de ngrok automáticamente: {e}")
    
    # Fallback a localhost
    return "http://localhost:5000"

# Servir imágenes desde la carpeta uploads
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Decorador de autenticación
def auth_required(f):
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or 'Bearer ' not in auth_header:
            print("Error de autenticación: Encabezado de autorización faltante o inválido")
            return jsonify({'error': 'Authorization header missing or invalid'}), 401

        id_token = auth_header.split('Bearer ')[1]
        print(f"Token recibido: {id_token[:20]}...")
        try:
            decoded_token = auth.verify_id_token(id_token)
            request.uid = decoded_token['uid']
            print(f"Token verificado correctamente para UID: {request.uid}")
            
            # Verificar que el usuario existe en Firestore con reintentos
            user_doc = None
            for attempt in range(3):
                try:
                    user_doc = db.collection('users').document(request.uid).get()
                    if user_doc.exists:
                        break
                    print(f"Intento {attempt + 1}: Documento de usuario no encontrado para UID: {request.uid}")
                    if attempt < 2:
                        time.sleep(1)
                    else:
                        print(f"Error: Documento de usuario no encontrado para UID: {request.uid}")
                        return jsonify({'error': 'User document not found'}), 404
                except Exception as e:
                    print(f"Error al verificar documento de usuario: {str(e)}")
                    if attempt < 2:
                        time.sleep(1)
                    else:
                        return jsonify({'error': 'Database connection error'}), 500
                        
        except auth.InvalidIdTokenError as e:
            print(f"Error de autenticación: Token inválido - {str(e)}")
            return jsonify({'error': 'Invalid token'}), 401
        except auth.ExpiredIdTokenError as e:
            print(f"Error de autenticación: Token expirado - {str(e)}")
            return jsonify({'error': 'Expired token'}), 401
        except Exception as e:
            print(f"Error de autenticación: {str(e)}")
            return jsonify({'error': f'Token verification failed: {str(e)}'}), 401
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# Rutas
@app.route('/')
def hello_world():
    return 'Hello, Firebase conectado con Flask!'

@app.route('/test-firestore')
def test_firestore():
    test_ref = db.collection("test").document("demo")
    test_ref.set({
        "mensaje": "Firestore está conectado correctamente."
    })
    doc = test_ref.get()
    return jsonify(doc.to_dict())

@app.route('/users/<user_id>/pets', methods=['POST'])
@auth_required
def add_pet(user_id):
    if user_id != request.uid:
        print(f"Error: UID no coincide. user_id: {user_id}, request.uid: {request.uid}")
        return jsonify({"error": "No autorizado"}), 403

    data = request.get_json()
    pet_name = data.get('name')
    photo_data = data.get('photo')

    if not pet_name:
        return jsonify({"error": "Falta el nombre de la mascota"}), 400

    pets_ref = db.collection('users').document(user_id).collection('pets')
    new_pet_ref = pets_ref.document()
    pet_id = new_pet_ref.id

    # Manejar la subida de la foto si existe
    photo_url = None
    if photo_data:
        try:
            # Extraer el tipo de contenido y los datos base64
            header, encoded = photo_data.split(",", 1)
            content_type = header.split(";")[0].split(":")[1]
            if content_type not in ['image/png', 'image/jpeg', 'image/gif']:
                return jsonify({"error": "Solo se permiten imágenes PNG, JPEG o GIF"}), 400
            image_data = base64.b64decode(encoded)
            file_extension = content_type.split('/')[1]
            # Generar un nombre de archivo único
            filename = f"{pet_id}_{uuid.uuid4()}.{file_extension}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            # Guardar la imagen en el sistema de archivos
            with open(file_path, 'wb') as f:
                f.write(image_data)
            # Construir la URL para la imagen usando la URL base correcta de ngrok
            base_url = get_base_url()
            photo_url = f"{base_url}/uploads/{filename}"
            print(f"Imagen guardada en: {photo_url}")
        except Exception as e:
            print(f"Error al guardar la imagen: {str(e)}")
            return jsonify({"error": "Error al guardar la imagen"}), 500

    # Generar el código QR con la URL correcta del frontend
    frontend_url = os.environ.get('FRONTEND_URL', 'https://192.168.2.106:5173')
    qr_content = f"{frontend_url}/scan/{pet_id}"
    qr = qrcode.make(qr_content)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    # Preparar los datos de la mascota
    pet_data = {
        'name': pet_name,
        'photo': photo_url if photo_url else None,
        'qr_code': qr_base64,
        'created_at': firestore.SERVER_TIMESTAMP
    }

    # Guardar los datos de la mascota en Firestore con reintentos y verificación
    for attempt in range(3):
        try:
            print(f"Intento {attempt + 1} de guardar mascota: {pet_name}")
            new_pet_ref.set(pet_data)
            
            # Verificar que se guardó correctamente
            time.sleep(0.5)  # Pequeña pausa para que Firestore procese
            saved_pet = new_pet_ref.get()
            if saved_pet.exists:
                saved_data = saved_pet.to_dict()
                print(f"Mascota guardada correctamente: {pet_id} - {saved_data.get('name')}")
                break
            else:
                raise Exception("La mascota no se guardó en Firestore")
                
        except Exception as e:
            print(f"Intento {attempt + 1} fallido al guardar mascota: {str(e)}")
            if attempt < 2:
                time.sleep(1)
            else:
                print(f"Error crítico: No se pudo guardar la mascota después de 3 intentos")
                return jsonify({"error": "No se pudo guardar la mascota"}), 500

    # Respuesta exitosa
    response_data = {
        "id": pet_id,
        "name": pet_name,
        "photo": photo_url if photo_url else None,
        "qr_content": qr_content,
        "qr_code_base64": qr_base64[:50] + "..."
    }
    
    print(f"Respuesta enviada: {response_data}")
    return jsonify(response_data), 201

@app.route('/users/<user_id>/pets', methods=['GET'])
@auth_required
def get_pets(user_id):
    if user_id != request.uid:
        print(f"Error: UID no coincide. user_id: {user_id}, request.uid: {request.uid}")
        return jsonify({'error': 'No autorizado'}), 403

    for attempt in range(3):
        try:
            print(f"Intento {attempt + 1} de obtener mascotas para user_id: {user_id}")
            pets_ref = db.collection('users').document(user_id).collection('pets')
            pets_stream = pets_ref.stream()
            pets = []
            
            for pet in pets_stream:
                pet_data = pet.to_dict()
                print(f"Mascota encontrada en Firestore: {pet.id} - {pet_data.get('name', 'Sin nombre')}")
                pet_info = {
                    "id": pet.id,
                    "name": pet_data.get('name', 'Desconocido'),
                    "photo": pet_data.get('photo', None)
                }
                pets.append(pet_info)
            
            print(f"Total de mascotas encontradas: {len(pets)}")
            print(f"Lista completa: {[p['name'] for p in pets]}")
            return jsonify(pets), 200
            
        except Exception as e:
            print(f"Intento {attempt + 1} fallido al obtener mascotas: {str(e)}")
            if attempt < 2:
                time.sleep(1)
            else:
                return jsonify({'error': 'Error al obtener mascotas'}), 500

@app.route('/scan/<pet_id>', methods=['POST'])
def scan_qr(pet_id):
    data = request.get_json()
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    message = data.get('message', '')

    if latitude is None or longitude is None:
        return jsonify({'error': 'latitude y longitude son requeridos'}), 400

    try:
        # Guardar la ubicación
        location_data = {
            'latitude': latitude,
            'longitude': longitude,
            'message': message,
            'created_at': datetime.utcnow()
        }
        
        db.collection('locations').document(pet_id).collection('ubicaciones').add(location_data)
        print(f"Ubicación guardada para mascota {pet_id}: ({latitude}, {longitude})")

        # Buscar el dueño de la mascota
        users_ref = db.collection('users').stream()
        owner_email = None
        for user in users_ref:
            pet_ref = db.collection('users').document(user.id).collection('pets').document(pet_id).get()
            if pet_ref.exists:
                owner_data = db.collection('users').document(user.id).get().to_dict()
                owner_email = owner_data.get('email') if owner_data else None
                break

        print(f"[NOTIFICACIÓN] Escaneo de {pet_id} en ({latitude}, {longitude}) para {owner_email}")
        if message:
            print(f"[MENSAJE] {message}")

        return jsonify({'message': 'Ubicación registrada correctamente'}), 200
        
    except Exception as e:
        print(f"Error al registrar ubicación: {str(e)}")
        return jsonify({'error': 'Error al registrar la ubicación'}), 500

@app.route('/users/<user_id>/locations', methods=['GET'])
@auth_required
def get_locations(user_id):
    if user_id != request.uid:
        print(f"Error: UID no coincide. user_id: {user_id}, request.uid: {request.uid}")
        return jsonify({'error': 'No autorizado'}), 403

    try:
        pets_ref = db.collection('users').document(user_id).collection('pets').stream()
        locations = []

        for pet in pets_ref:
            pet_id = pet.id
            pet_name = pet.to_dict().get('name', 'Desconocido')
            locations_ref = db.collection('locations').document(pet_id).collection('ubicaciones').order_by('created_at', direction=firestore.Query.DESCENDING).stream()
            
            for loc in locations_ref:
                loc_data = loc.to_dict()
                locations.append({
                    'pet_id': pet_id,
                    'pet_name': pet_name,
                    'latitude': loc_data['latitude'],
                    'longitude': loc_data['longitude'],
                    'message': loc_data.get('message', ''),
                    'created_at': loc_data['created_at'].isoformat() if loc_data.get('created_at') else None
                })

        return jsonify(locations), 200
        
    except Exception as e:
        print(f"Error al obtener ubicaciones: {str(e)}")
        return jsonify({'error': 'Error al obtener ubicaciones'}), 500

@app.route('/pets/<pet_id>', methods=['GET'])
def get_pet(pet_id):
    try:
        # Buscar la mascota en todas las colecciones de usuarios
        users_ref = db.collection('users').stream()
        for user in users_ref:
            pet_ref = db.collection('users').document(user.id).collection('pets').document(pet_id).get()
            if pet_ref.exists:
                pet_data = pet_ref.to_dict()
                pet_data['id'] = pet_id
                return jsonify(pet_data), 200
        
        return jsonify({'error': 'Mascota no encontrada'}), 404
        
    except Exception as e:
        print(f"Error al buscar mascota: {str(e)}")
        return jsonify({'error': 'Error al buscar la mascota'}), 500

@app.route('/register', methods=['POST'])
def signup():
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type debe ser application/json"}), 415

        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        nombre = data.get('nombre', '')

        if not email:
            return jsonify({"error": "Falta el campo: email"}), 400
        if not password:
            return jsonify({"error": "Falta el campo: password"}), 400

        user = auth.create_user(
            email=email,
            password=password,
            display_name=nombre
        )

        user_ref = db.collection('users').document(user.uid)
        for attempt in range(3):
            try:
                user_ref.set({
                    'email': email,
                    'nombre': nombre,
                    'created_at': firestore.SERVER_TIMESTAMP
                })
                time.sleep(0.5)  # Pausa para que Firestore procese
                if user_ref.get().exists:
                    print(f"Documento creado para UID: {user.uid}")
                    break
                else:
                    raise Exception("Documento no creado")
            except Exception as e:
                print(f"Intento {attempt + 1} fallido al crear documento de usuario: {str(e)}")
                if attempt < 2:
                    time.sleep(1)
                else:
                    auth.delete_user(user.uid)
                    return jsonify({"error": "No se pudo crear el documento del usuario"}), 500

        FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY')
        if not FIREBASE_API_KEY:
            print("Error: FIREBASE_API_KEY no está configurada")
            return jsonify({"error": "Configuración del servidor incompleta"}), 500

        url = f'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}'
        response = requests.post(url, json={
            'email': email,
            'password': password,
            'returnSecureToken': True
        })

        response_data = response.json()
        if response.status_code != 200:
            error_msg = response_data.get('error', {}).get('message', 'Error desconocido')
            print(f"Error al iniciar sesión automáticamente: {error_msg}")
            auth.delete_user(user.uid)
            return jsonify({"error": "No se pudo iniciar sesión tras el registro"}), 500

        return jsonify({
            "message": "Usuario registrado exitosamente",
            "uid": user.uid,
            "user_id": response_data['localId'],
            "email": email,
            "nombre": nombre,
            "token": response_data['idToken']
        }), 201

    except auth.EmailAlreadyExistsError:
        return jsonify({"error": "El correo ya está registrado"}), 409
    except auth.InvalidPasswordError:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
    except auth.InvalidEmailError:
        return jsonify({"error": "El formato de correo electrónico es inválido"}), 400
    except Exception as auth_error:
        print(f"Error al crear usuario en Firebase: {str(auth_error)}")
        return jsonify({"error": f"Error de Firebase: {str(auth_error)}"}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type debe ser application/json"}), 415

        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email:
            return jsonify({"error": "Falta el campo: email"}), 400
        if not password:
            return jsonify({"error": "Falta el campo: password"}), 400

        FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY')
        if not FIREBASE_API_KEY:
            print("Error: FIREBASE_API_KEY no está configurada")
            return jsonify({"error": "Configuración del servidor incompleta"}), 500

        url = f'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}'
        response = requests.post(url, json={
            'email': email,
            'password': password,
            'returnSecureToken': True
        })

        response_data = response.json()

        if response.status_code != 200:
            error_msg = response_data.get('error', {}).get('message', 'Error desconocido')
            print(f"Error en login: {error_msg}")
            if error_msg == 'INVALID_LOGIN_CREDENTIALS':
                return jsonify({"error": "Credenciales inválidas"}), 401
            elif error_msg == 'USER_DISABLED':
                return jsonify({"error": "Usuario deshabilitado"}), 403
            else:
                return jsonify({"error": error_msg}), response.status_code

        user_id = response_data['localId']
        user_doc = db.collection('users').document(user_id).get()

        if not user_doc.exists:
            print(f"Creando documento para usuario: {user_id}")
            for attempt in range(3):
                try:
                    db.collection('users').document(user_id).set({
                        'email': email,
                        'nombre': response_data.get('displayName', ''),
                        'created_at': firestore.SERVER_TIMESTAMP
                    })
                    time.sleep(0.5)  # Pausa para que Firestore procese
                    if db.collection('users').document(user_id).get().exists:
                        break
                    else:
                        raise Exception("Documento no creado")
                except Exception as e:
                    print(f"Intento {attempt + 1} fallido al crear documento de usuario: {str(e)}")
                    if attempt < 2:
                        time.sleep(1)
                    else:
                        return jsonify({"error": "No se pudo crear el documento del usuario"}), 500

        print(f"Login exitoso para user_id: {user_id}")
        return jsonify({
            "message": "Login exitoso",
            "user_id": user_id,
            "email": email,
            "nombre": user_doc.to_dict().get('nombre', '') if user_doc.exists else response_data.get('displayName', ''),
            "token": response_data['idToken']
        }), 200

    except Exception as e:
        print(f"Error en login: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500

# Ruta para obtener la URL actual del servidor (útil para debugging)
@app.route('/api/server-info', methods=['GET'])
def get_server_info():
    base_url = get_base_url()
    return jsonify({
        "base_url": base_url,
        "frontend_url": os.environ.get('FRONTEND_URL', 'https://192.168.2.106:5173'),
        "environment": "development" if app.debug else "production"
    })

if __name__ == '__main__':
    print(f"Servidor iniciando...")
    print(f"URL base detectada: {get_base_url()}")
    print(f"Frontend URL: {os.environ.get('FRONTEND_URL', 'https://192.168.2.106:5173')}")
    app.run(debug=True, host='0.0.0.0', port=5000)