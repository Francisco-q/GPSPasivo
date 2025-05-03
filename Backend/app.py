from flask import Flask, request, jsonify
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import qrcode
import base64
from io import BytesIO

app = Flask(__name__)

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

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json()
    user_id = data.get('user_id')
    nombre = data.get('nombre')
    email = data.get('email')

    if not all([user_id, nombre, email]):
        return jsonify({"error": "Faltan campos requeridos"}), 400

    db = firestore.client()
    user_ref = db.collection('users').document(user_id)
    user_ref.set({
        'nombre': nombre,
        'email': email
    })

    return jsonify({"message": "Usuario registrado correctamente"}), 201

if __name__ == '__main__':
    app.run(debug=True)