-- Create Database
CREATE DATABASE IF NOT EXISTS work_monitoring_db;
USE work_monitoring_db;

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    emp_no VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'employee') DEFAULT 'employee',
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    emp_no VARCHAR(20) NOT NULL,
    login_time DATETIME NOT NULL,
    logout_time DATETIME DEFAULT NULL,
    date DATE NOT NULL,
    FOREIGN KEY (emp_no) REFERENCES employees(emp_no) ON DELETE CASCADE
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    emp_no VARCHAR(20) NOT NULL,
    assigned_date DATE NOT NULL,
    due_date DATE NOT NULL,
    completed_date DATE DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completion_percentage INT DEFAULT 0,
    status ENUM('pending', 'in_progress', 'completed', 'overdue') DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_no) REFERENCES employees(emp_no) ON DELETE CASCADE,
    INDEX idx_emp_status (emp_no, status),
    INDEX idx_due_date (due_date)
);
