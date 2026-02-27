const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
const Task = require('./models/Task');

dotenv.config();

async function migrate() {
    console.log('Starting data migration from MySQL to MongoDB...');

    let mysqlConn;
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas');

        // Connect to MySQL
        mysqlConn = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'nikhilmaddali($)123',
            database: 'work_monitoring_db'
        });
        console.log('✅ Connected to local MySQL');

        // 1. Migrate Employees
        console.log('Migrating Employees...');
        const [mysqlEmployees] = await mysqlConn.execute('SELECT * FROM employees');
        for (const emp of mysqlEmployees) {
            const existing = await Employee.findOne({ emp_no: emp.emp_no });
            if (!existing) {
                // Use a temporary workaround for pre-save hook that hashes password again
                // We want to keep the already hashed password from MySQL
                const newEmp = new Employee({
                    emp_no: emp.emp_no,
                    name: emp.name,
                    email: emp.email,
                    password: emp.password, // Already hashed
                    role: emp.role,
                    status: emp.status,
                    created_at: emp.created_at
                });

                // Disable password hashing middleware for this migration save
                // Actually, Mongoose pre-save 'isModified' check should handle it if we set it directly
                // But to be safe, we can use insertMany or updateOne with upsert
                await Employee.updateOne(
                    { emp_no: emp.emp_no },
                    { $setOnInsert: newEmp },
                    { upsert: true }
                );
            }
        }
        console.log(`✅ Migrated ${mysqlEmployees.length} employees`);

        // 2. Migrate Attendance
        console.log('Migrating Attendance...');
        const [mysqlAttendance] = await mysqlConn.execute('SELECT * FROM attendance');
        for (const att of mysqlAttendance) {
            await Attendance.updateOne(
                { emp_no: att.emp_no, date: att.date.toISOString().split('T')[0], login_time: att.login_time },
                {
                    $setOnInsert: {
                        emp_no: att.emp_no,
                        login_time: att.login_time,
                        logout_time: att.logout_time,
                        date: att.date.toISOString().split('T')[0]
                    }
                },
                { upsert: true }
            );
        }
        console.log(`✅ Migrated ${mysqlAttendance.length} attendance records`);

        // 3. Migrate Tasks
        console.log('Migrating Tasks...');
        const [mysqlTasks] = await mysqlConn.execute('SELECT * FROM tasks');
        for (const task of mysqlTasks) {
            const formatDate = (d) => d ? d.toISOString().split('T')[0] : null;

            await Task.updateOne(
                { emp_no: task.emp_no, title: task.title, createdAt: task.created_at },
                {
                    $setOnInsert: {
                        emp_no: task.emp_no,
                        assigned_date: formatDate(task.assigned_date) || formatDate(task.created_at),
                        due_date: formatDate(task.due_date) || formatDate(task.created_at),
                        completed_date: formatDate(task.completed_date),
                        title: task.title,
                        description: task.description,
                        completion_percentage: task.completion_percentage,
                        status: task.status,
                        task_type: task.task_type || 'daily',
                        reason: task.reason,
                        createdAt: task.created_at,
                        updatedAt: task.updated_at
                    }
                },
                { upsert: true, timestamps: false }
            );
        }
        console.log(`✅ Migrated ${mysqlTasks.length} tasks`);

        console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        if (mysqlConn) await mysqlConn.end();
        await mongoose.connection.close();
        process.exit();
    }
}

migrate();
