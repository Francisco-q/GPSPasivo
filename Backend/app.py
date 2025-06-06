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
CORS(app)

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
            user_doc = None
            for attempt in range(3):
                user_doc = db.collection('users').document(request.uid).get()
                if user_doc.exists:
                    break
                print(f"Intento {attempt + 1}: Documento de usuario no encontrado para UID: {request.uid}")
                if attempt < 2:
                    time.sleep(1)
                else:
                    print(f"Error: Documento de usuario no encontrado para UID: {request.uid}")
                    return jsonify({'error': 'User document not found'}), 404
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
            # Construir la URL para la imagen
            photo_url = f"http://localhost:5000/uploads/{filename}"
        except Exception as e:
            print(f"Error al guardar la imagen: {str(e)}")
            return jsonify({"error": "Error al guardar la imagen"}), 500

    # Generar el código QR
    qr_content = f"https://miapp.com/scan/{pet_id}"
    qr = qrcode.make(qr_content)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    # Guardar los datos de la mascota en Firestore
    new_pet_ref.set({
        'name': pet_name,
        'photo': photo_url if photo_url else None,
        'qr_code': qr_base64,
        'created_at': firestore.SERVER_TIMESTAMP
    })

    return jsonify({
        "id": pet_id,
        "name": pet_name,
        "photo": photo_url if photo_url else None,
        "qr_content": qr_content,
        "qr_code_base64": qr_base64[:50] + "..."
    }), 201

@app.route('/users/<user_id>/pets', methods=['GET'])
@auth_required
def get_pets(user_id):
    if user_id != request.uid:
        print(f"Error: UID no coincide. user_id: {user_id}, request.uid: {request.uid}")
        return jsonify({'error': 'No autorizado'}), 403

    for attempt in range(3):
        try:
            pets_ref = db.collection('users').document(user_id).collection('pets').stream()
            pets = [{"id": pet.id, "name": pet.to_dict().get('name', 'Desconocido'), "photo": pet.to_dict().get('photo', None)} for pet in pets_ref]
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

    if latitude is None or longitude is None:
        return jsonify({'error': 'latitude y longitude son requeridos'}), 400

    db.collection('locations').document(pet_id).collection('ubicaciones').add({
        'latitude': latitude,
        'longitude': longitude,
        'created_at': datetime.utcnow()
    })

    users_ref = db.collection('users').stream()
    owner_email = None
    for user in users_ref:
        pet_ref = db.collection('users').document(user.id).collection('pets').document(pet_id).get()
        if pet_ref.exists:
            owner_email = db.collection('users').document(user.id).get().to_dict().get('email')
            break

    print(f"[NOTIFICACIÓN] Escaneo de {pet_id} en ({latitude}, {longitude}) para {owner_email}")

    return jsonify({'message': 'Ubicación registrada correctamente'}), 200

@app.route('/users/<user_id>/locations', methods=['GET'])
@auth_required
def get_locations(user_id):
    if user_id != request.uid:
        print(f"Error: UID no coincide. user_id: {user_id}, request.uid: {request.uid}")
        return jsonify({'error': 'No autorizado'}), 403

    pets_ref = db.collection('users').document(user_id).collection('pets').stream()
    locations = []

    for pet in pets_ref:
        pet_id = pet.id
        pet_name = pet.to_dict().get('name', 'Desconocido')
        locations_ref = db.collection('locations').document(pet_id).collection('ubicaciones').stream()
        for loc in locations_ref:
            loc_data = loc.to_dict()
            locations.append({
                'pet_id': pet_id,
                'pet_name': pet_name,
                'latitude': loc_data['latitude'],
                'longitude': loc_data['longitude'],
                'created_at': loc_data['created_at'].isoformat()
            })

    return jsonify(locations), 200

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

@app.route('/users/<user_id>/profile', methods=['GET'])
@auth_required
def get_profile(user_id):
    if user_id != request.uid:
        print(f"Error: UID no coincide. user_id: {user_id}, request.uid: {request.uid}")
        return jsonify({'error': 'No autorizado'}), 403

    try:
        user_doc = db.collection('users').document(user_id).get()
        if not user_doc.exists:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        user_data = user_doc.to_dict()
        return jsonify({
            'email': user_data.get('email', ''),
            'nombre': user_data.get('nombre', ''),
            'phone': user_data.get('phone', '')
        }), 200
    except Exception as e:
        print(f"Error al obtener perfil: {str(e)}")
        return jsonify({'error': 'Error al obtener perfil'}), 500

@app.route('/users/<user_id>/profile', methods=['PUT'])
@auth_required
def update_profile(user_id):
    if user_id != request.uid:
        print(f"Error: UID no coincide. user_id: {user_id}, request.uid: {request.uid}")
        return jsonify({'error': 'No autorizado'}), 403

    data = request.get_json()
    email = data.get('email')
    phone = data.get('phone', '')

    if not email:
        return jsonify({"error": "El campo email es obligatorio"}), 400

    try:
        # Verificar si el email ha cambiado
        user_doc = db.collection('users').document(user_id).get()
        if not user_doc.exists:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        current_email = user_doc.to_dict().get('email', '')
        
        # Si el email ha cambiado, actualizar en Firebase Auth
        if email != current_email:
            try:
                auth.update_user(user_id, email=email)
            except auth.EmailAlreadyExistsError:
                return jsonify({"error": "El correo ya está en uso por otra cuenta"}), 409
            except Exception as auth_error:
                print(f"Error al actualizar email en Auth: {str(auth_error)}")
                return jsonify({"error": f"Error al actualizar email: {str(auth_error)}"}), 500
        
        # Actualizar en Firestore
        db.collection('users').document(user_id).update({
            'email': email,
            'phone': phone,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        return jsonify({
            'message': 'Perfil actualizado correctamente',
            'email': email,
            'phone': phone
        }), 200
    
    except Exception as e:
        print(f"Error al actualizar perfil: {str(e)}")
        return jsonify({'error': 'Error al actualizar perfil'}), 500

@app.route('/users/<user_id>/password', methods=['PUT'])
@auth_required
def change_password(user_id):
    if user_id != request.uid:
        print(f"Error: UID no coincide. user_id: {user_id}, request.uid: {request.uid}")
        return jsonify({'error': 'No autorizado'}), 403

    data = request.get_json()
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')

    if not current_password or not new_password:
        return jsonify({"error": "Se requieren la contraseña actual y la nueva"}), 400

    try:
        # Verificar la contraseña actual
        FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY')
        if not FIREBASE_API_KEY:
            return jsonify({"error": "Configuración del servidor incompleta"}), 500

        # Obtener el email del usuario
        user_doc = db.collection('users').document(user_id).get()
        if not user_doc.exists:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        email = user_doc.to_dict().get('email')
        
        # Verificar las credenciales actuales
        url = f'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}'
        response = requests.post(url, json={
            'email': email,
            'password': current_password,
            'returnSecureToken': True
        })

        if response.status_code != 200:
            return jsonify({"error": "Contraseña actual incorrecta"}), 401

        # Actualizar la contraseña
        auth.update_user(user_id, password=new_password)
        
        return jsonify({
            'message': 'Contraseña actualizada correctamente'
        }), 200
    
    except auth.InvalidPasswordError:
        return jsonify({"error": "La nueva contraseña debe tener al menos 6 caracteres"}), 400
    except Exception as e:
        print(f"Error al cambiar contraseña: {str(e)}")
        return jsonify({'error': 'Error al cambiar contraseña'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)