# RestaurantePOS

Multi-tenant POS system for restaurants built with FastAPI and React.

## Screenshots

> Coming soon — live demo available upon request.

## Features

-Order management (dine-in and takeaway)
-Kitchen display system with real-time updates
-Cashier dashboard with daily reports
-Sales analytics and popular dishes tracking
-Multi-role access (admin, cashier, waiter, cook)
-Multi-tenant architecture — one instance, multiple restaurants

## Architecture

- Multi-tenant SaaS: each restaurant is isolated by `tenant_id`
- RESTful API with role-based access control (RBAC)
- Polling-based real-time updates (kitchen ↔ cashier ↔ waiter)
- Database migrations with Alembic

## Tech Stack

**Backend**
- FastAPI + SQLAlchemy + Alembic
- PostgreSQL (SQLite for development)
- JWT authentication
- Multi-tenant via `tenant_id`

**Frontend**
- React 18 + Vite
- TailwindCSS (dark theme)
- Recharts for analytics

## Getting Started

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env   # Configure your environment variables
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

```
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///./restaurante.db
FRONTEND_ORIGIN=http://localhost:5173
```

## Author

David Tintinapon — [GitHub](https://github.com/davidtintinapon) · [Email](mailto:davidtintinapon.dev@gmail.com)