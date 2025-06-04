import json
import os
import psutil
from flask import render_template, request, jsonify, redirect
from utils import cargar_json, guardar_json
from nlp_engine import analizar_mensaje

def register_routes(app):
    @app.route('/')
    def index():
        return redirect('/dashboard')

    @app.route('/start', methods=['GET'])
    def start():
        return jsonify({"message": "Mensajes de bienvenida simulados con éxito"}), 200

    @app.route('/chat', methods=['POST'])
    def chat():
        data = request.get_json()
        mensaje = data.get('mensaje')
        usuario = data.get('usuario')

        if not mensaje or not usuario:
            return jsonify({"error": "Faltan campos requeridos"}), 400

        respuesta = analizar_mensaje(mensaje, usuario)
        return jsonify({"respuesta": respuesta})

    @app.route('/simular', methods=['POST'])
    def simular():
        mensaje = request.form.get('mensaje_simulado')
        usuario = "simulacion_web"
        respuesta = analizar_mensaje(mensaje, usuario) if mensaje else ""
        no_entendidas = cargar_json('data/no_entendidas.json')
        corpus = cargar_json('data/corpus.json')
        return render_template('dashboard.html', corpus=corpus, no_entendidas=no_entendidas, respuesta_simulada=respuesta, mensaje_simulado=mensaje)

    @app.route('/dashboard')
    def dashboard():
        no_entendidas = cargar_json('data/no_entendidas.json')
        corpus = cargar_json('data/corpus.json')

        qr_path = os.path.join(app.static_folder, 'qr.svg')
        qr_exists = os.path.exists(qr_path)

        def is_bot_running():
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline') or []
                    if any("whatsapp-bot/index.js" in part for part in cmdline):
                        return True
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
            return False

        whatsapp_activo = is_bot_running()

        return render_template('dashboard.html',
            corpus=corpus,
            no_entendidas=no_entendidas,
            qr_exists=qr_exists,
            qr_enabled=False, 
            whatsapp_activo=whatsapp_activo
        )

    @app.route('/agregar/<pregunta>/<respuesta>')
    def agregar_pregunta(pregunta, respuesta):
        corpus = cargar_json('data/corpus.json')
        corpus.append({"pregunta": pregunta, "respuesta": respuesta})
        guardar_json('data/corpus.json', corpus)
        return redirect('/dashboard')

    @app.route('/eliminar_no_entendida/<int:index>')
    def eliminar_no_entendida(index):
        no_entendidas = cargar_json('data/no_entendidas.json')
        if 0 <= index < len(no_entendidas):
            no_entendidas.pop(index)
            guardar_json('data/no_entendidas.json', no_entendidas)
        return redirect('/dashboard')

    @app.route('/vaciar_no_entendidas')
    def vaciar_no_entendidas():
        guardar_json('data/no_entendidas.json', [])
        return redirect('/dashboard')

    @app.route('/usuarios')
    def listar_usuarios():
        def is_bot_running():
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline') or []
                    if any("whatsapp-bot" in part and "index.js" in part for part in cmdline):
                        return True
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
            return False

        whatsapp_activo = is_bot_running()

        return render_template('usuarios.html', whatsapp_activo=whatsapp_activo)

    @app.route('/agregar_usuario', methods=['POST'])
    def agregar_usuario():
        return redirect('/usuarios')  

    @app.route('/eliminar_usuario/<int:index>')
    def eliminar_usuario(index):
        return redirect('/usuarios')  

    @app.route('/api/whatsapp-status')
    def estado_whatsapp():
        try:
            estado = cargar_json('data/whatsapp_estado.json')
            return jsonify(estado)
        except:
            return jsonify({"activo": False})
        
    @app.route('/api/whatsapp-activar', methods=['POST'])
    def whatsapp_activar():
        guardar_json('data/whatsapp_estado.json', {"activo": True})
        return jsonify({"message": "Estado actualizado a activo"})

    @app.route('/api/whatsapp-desactivar', methods=['POST'])
    def whatsapp_desactivar():
        guardar_json('data/whatsapp_estado.json', {"activo": False})
        return jsonify({"message": "Estado actualizado a inactivo"})

    @app.route('/api/guardar_usuarios', methods=['POST'])
    def guardar_usuarios():
        try:
            usuarios = request.get_json()
            with open('data/usuarios.json', 'w', encoding='utf-8') as f:
                json.dump(usuarios, f, ensure_ascii=False, indent=4)
            return jsonify({"message": "Usuarios guardados correctamente"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
