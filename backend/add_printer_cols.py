"""
Script one-shot: agrega printer_ip y printer_port a la tabla configuraciones.
Seguro de correr múltiples veces (ignora si la columna ya existe).
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "restaurante.db")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Ver columnas actuales
cur.execute("PRAGMA table_info(configuraciones)")
cols = {row[1] for row in cur.fetchall()}
print("Columnas actuales:", cols)

added = []
if "printer_ip" not in cols:
    cur.execute("ALTER TABLE configuraciones ADD COLUMN printer_ip TEXT")
    added.append("printer_ip")

if "printer_port" not in cols:
    cur.execute("ALTER TABLE configuraciones ADD COLUMN printer_port TEXT DEFAULT '9100'")
    added.append("printer_port")

conn.commit()
conn.close()

if added:
    print(f"✓ Columnas agregadas: {', '.join(added)}")
else:
    print("✓ Las columnas ya existían, nada que hacer.")
