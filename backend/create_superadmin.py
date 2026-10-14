"""
Script para crear el superadmin inicial del sistema.
Ejecutar UNA SOLA VEZ después de instalar.

Uso:
    python create_superadmin.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password
from app.models import Usuario, Tenant


def main():
    print("=== Crear Superadmin ===")
    nombre   = input("Nombre: ").strip() or "Super Admin"
    email    = input("Email: ").strip()
    password = input("Contraseña: ").strip()

    if not email or not password:
        print("❌ Email y contraseña son obligatorios")
        sys.exit(1)

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existe = db.query(Usuario).filter(Usuario.email == email).first()
        if existe:
            print(f"❌ Ya existe un usuario con el email {email}")
            sys.exit(1)

        tenant = db.query(Tenant).filter(Tenant.slug == "sistema").first()
        if not tenant:
            tenant = Tenant(
                nombre="Sistema",
                slug="sistema",
                plan="pro",
                activo=True,
            )
            db.add(tenant)
            db.flush()

        superadmin = Usuario(
            tenant_id=tenant.id,
            nombre=nombre,
            email=email,
            password_hash=hash_password(password),
            rol="superadmin",
        )
        db.add(superadmin)
        db.commit()
        print(f"\n✅ Superadmin creado: {email}")
        print("   Ya puedes iniciar sesión en el sistema.")

    finally:
        db.close()


if __name__ == "__main__":
    main()