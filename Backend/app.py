from flask import Flask, request, jsonify
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import qrcode
import base64
from io import BytesIO
from firebase_admin import auth
from flask_cors import CORS
import os
import requests
from dotenv import find_dotenv
from dotenv import load_dotenv
from pathlib import Path

# Cargar variables de entorno desde el archivo .env
env_path = Path(__file__).resolve().parent / '.env'
load_dotenv(env_path)

print("Variables cargadas del .env:")
print("API_KEY:", os.getenv('FIREBASE_API_KEY'))
print("AUTH_DOMAIN:", os.getenv('FIREBASE_AUTH_DOMAIN'))

app = Flask(__name__)
CORS(app)

# Inicializar Firebase con la clave privada
cred = credentials.Certificate("serviceAccountKey.json")  # Asegúrate que el nombre coincida
firebase_admin.initialize_app(cred)

# Obtener instancia de Firestore
db = firestore.client()

@app.route('/')
def hello_world():
    return 'Hello, Firebase conectado con Flask!'

@app.route('/test-firestore')
def test_firestore():
    # Escribir un documento de prueba
    test_ref = db.collection("test").document("demo")
    test_ref.set({
        "mensaje": "Firestore está conectado correctamente."
    })

    # Leerlo
    doc = test_ref.get()
    return jsonify(doc.to_dict())


@app.route('/users/<user_id>/pets', methods=['POST'])
def add_pet(user_id):
    data = request.get_json()
    pet_name = data.get('name')

    if not pet_name:
        return jsonify({"error": "Falta el nombre de la mascota"}), 400

    db = firestore.client()
    pets_ref = db.collection('users').document(user_id).collection('pets')
    new_pet_ref = pets_ref.document()
    pet_id = new_pet_ref.id

    # Contenido del QR: puede ser una URL o solo el ID
    qr_content = f"https://miapp.com/scan/{pet_id}"

    # Generar QR como imagen base64
    qr = qrcode.make(qr_content)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    # Guardar datos en Firestore
    new_pet_ref.set({
        'name': pet_name,
        'qr_code': qr_base64,
        'created_at': firestore.SERVER_TIMESTAMP
    })

    return jsonify({
        "message": "Mascota añadida exitosamente",
        "pet_id": pet_id,
        "qr_content": qr_content,
        "qr_code_base64": qr_base64[:50] + "..."  # para no mostrar todo
    }), 201

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


# Crear un nuevo usuario en Firebase Authentication
@app.route('/register', methods=['POST'])
def signup():
    try:
        # Asegurar que el contenido es JSON
        if not request.is_json:
            return jsonify({"error": "Content-Type debe ser application/json"}), 415

        data = request.get_json()
        print(f"Datos recibidos en /signup: {data}")  # Imprime los datos recibidos
        
        try:
            email = data['email']
        except KeyError:
            return jsonify({"error": "Falta el campo: email"}), 400
            
        try:
            password = data['password']
        except KeyError:
            return jsonify({"error": "Falta el campo: password"}), 400
            
        nombre = data.get('nombre', '')  # Usa 'nombre' como en tu JSON

        try:
          
            user = auth.create_user(
                email=email,
                password=password,
                display_name=nombre  # Esto guarda el nombre en Auth, no en Firestore
            )
            
            print(f"Usuario creado en Firebase Auth con UID: {user.uid}")

            db.collection('users').document(user.uid).set({
                'email': email,
                'nombre': nombre,
                'created_at': firestore.SERVER_TIMESTAMP
            })
            
            print(f"Usuario guardado en Firestore")

            return jsonify({
                "message": "Usuario registrado exitosamente",
                "uid": user.uid
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

    except Exception as e:
        print(f"Error general en /signup: {str(e)}")
        return jsonify({"error": f"Error interno: {str(e)}"}), 500
    

# Iniciar sesión con Firebase Authentication    
@app.route('/login', methods=['POST'])
def login():
    try:
        # Verificar que el contenido es JSON
        if not request.is_json:
            return jsonify({"error": "Content-Type debe ser application/json"}), 415

        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        # Validar campos requeridos
        if not email:
            return jsonify({"error": "Falta el campo: email"}), 400
        if not password:
            return jsonify({"error": "Falta el campo: password"}), 400

        # Autenticar con Firebase REST API
        FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY')
        url = f'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}'
        print("API KEY USADA:", os.environ.get('FIREBASE_API_KEY'))
        response = requests.post(url, json={
            'email': email,
            'password': password,
            'returnSecureToken': True
        })

        response_data = response.json()

        # Manejar errores de Firebase
        if response.status_code != 200:
            error_msg = response_data.get('error', {}).get('message', 'Error desconocido')
            
            if error_msg == 'INVALID_LOGIN_CREDENTIALS':
                return jsonify({"error": "Credenciales inválidas"}), 401
            elif error_msg == 'USER_DISABLED':
                return jsonify({"error": "Usuario deshabilitado"}), 403
            else:
                return jsonify({"error": error_msg}), response.status_code

        # Obtener datos adicionales de Firestore
        user_id = response_data['localId']
        user_doc = db.collection('users').document(user_id).get()
        
        return jsonify({
            "message": "Login exitoso",
            "user_id": user_id,
            "email": email,
            "nombre": user_doc.to_dict().get('nombre', '') if user_doc.exists else '',
            "id_token": response_data['idToken']
        }), 200

    except Exception as e:
        print(f"Error en login: {str(e)}")
        return jsonify({"error": "Error interno del servidor"}), 500
    
# autentificación de usuario
def auth_required(f):
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or 'Bearer ' not in auth_header:
            return jsonify({'error': 'Authorization header missing or invalid'}), 401
            
        id_token = auth_header.split('Bearer ')[1]
        
        try:
            decoded_token = auth.verify_id_token(id_token)
            request.uid = decoded_token['uid']
        except:
            return jsonify({'error': 'Invalid or expired token'}), 401
            
        return f(*args, **kwargs)
        
    wrapper.__name__ = f.__name__
    return wrapper


if __name__ == '__main__':
    app.run(debug=True)