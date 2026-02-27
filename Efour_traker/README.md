# EFOUR TRACKER

Employee Work Monitoring Web Application.

## Features
- Real-time login/logout tracking
- Admin Dashboard (Employee Management, Attendance Overview)
- Employee Dashboard (Attendance History)
- Modern Teal-themed Interface

## Local Setup

### 1. Prerequisites
- Node.js installed
- MongoDB URI (Atlas or Local)

### 2. Installation
Install root dependencies:
```bash
npm install
```

Install backend dependencies:
```bash
npm run backend-install
```

### 3. Database Reset (Fresh Data)
Clear all existing data and seed a fresh admin account:
```bash
npm run db-reset
```
**Admin Credentials:**
- **ID:** `ADMIN001`
- **Password:** `efour123`

### 4. Running the Application
**Backend:**
```bash
npm start
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## Environment Variables
Create a `.env` file in the `backend` folder:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Your secret key for auth
- `PORT`: 5000 (default)
