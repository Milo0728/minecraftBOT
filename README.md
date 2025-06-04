# Proyecto Gestión Académica con Bot de WhatsApp 🤖

Este proyecto integra un panel de administración en Flask con un bot de WhatsApp automatizado usando NLP (Procesamiento de Lenguaje Natural). Los usuarios pueden consultar información, y el bot responde usando similitud de texto.

## 📦 Estructura del Proyecto

```
proyectoGestion/
├── frontend/           # Panel web hecho en Flask
├── whatsapp-bot/       # Bot automatizado de WhatsApp
└── README.md
```

## 🚀 ¿Cómo iniciar el proyecto?

### 1. Clona el repositorio

```bash
git clone https://github.com/tuusuario/proyectoGestion.git
cd proyectoGestion
```

### 2. Instala dependencias

#### Backend (Flask)

```bash
cd frontend
python -m venv .venv
# En Linux/macOS
source .venv/bin/activate
# En Windows
.venv\Scripts\activate

pip install -r requirements.txt
```

#### Bot de WhatsApp (Node.js)

```bash
cd ../whatsapp-bot
npm install
```

### 3. Ejecuta la aplicación

#### Iniciar el backend

```bash
cd ../frontend
python main.py
```

#### Iniciar el bot de WhatsApp

```bash
cd ../whatsapp-bot
node index.js
```

### 4. Accede al panel

Abre tu navegador y entra a:

```
http://localhost:5000/dashboard
```
