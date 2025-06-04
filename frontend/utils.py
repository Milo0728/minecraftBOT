import json
import os

def cargar_json(path):
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print(f"[ERROR] Archivo JSON dañado: {path}. Se reemplazará por [].")
            guardar_json(path, [])
            return []
    return []


def guardar_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
