const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcryptjs");

dotenv.config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files from public folder
app.use(express.static(path.join(__dirname, "public")));

// MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.log("MySQL Connection Failed:", err);
        return;
    }

    console.log("MySQL Database Connected");
});

// ===============================
// TEST API
// ===============================

app.get("/api/test", (req, res) => {
    res.json({
        message: "API is working successfully!"
    });
});

// ===============================
// GET ALL PRODUCTS
// ===============================

app.get("/api/products", (req, res) => {

    const sql = "SELECT * FROM products";

    db.query(sql, (err, results) => {

        if (err) {
            console.log(err);

            return res.status(500).json({
                message: "Failed to fetch products"
            });
        }

        res.json(results);
    });
});

// ===============================
// USER REGISTRATION
// ===============================

app.post("/api/register", async (req, res) => {

    try {

        const { name, email, password } = req.body;

        // Check empty fields
        if (!name || !email || !password) {

            return res.status(400).json({
                message: "All fields are required"
            });
        }

        // Check if email already exists
        const checkUser = "SELECT * FROM users WHERE email = ?";

        db.query(checkUser, [email], async (err, results) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    message: "Database error"
                });
            }

            if (results.length > 0) {

                return res.status(400).json({
                    message: "Email already registered"
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert user
            const sql = `
                INSERT INTO users
                (name, email, password)
                VALUES (?, ?, ?)
            `;

            db.query(
                sql,
                [name, email, hashedPassword],
                (err, result) => {

                    if (err) {

                        console.log(err);

                        return res.status(500).json({
                            message: "Registration failed"
                        });
                    }

                    res.status(201).json({

                        message: "Registration successful",

                        userId: result.insertId
                    });
                }
            );
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Something went wrong"
        });
    }
});

// ===============================
// USER LOGIN
// ===============================

app.post("/api/login", (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {

        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], async (err, results) => {

        if (err) {

            console.log(err);

            return res.status(500).json({
                message: "Database error"
            });
        }

        // User not found
        if (results.length === 0) {

            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = results[0];

        // Compare password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {

            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Login successful
        res.json({

            message: "Login successful",

            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    });
});

// ===============================
// PLACE ORDER
// ===============================

app.post("/api/orders", (req, res) => {

    const { userId, items, totalAmount } = req.body;

    // Validate order
    if (!userId || !items || items.length === 0) {

        return res.status(400).json({
            message: "Invalid order details"
        });
    }

    // Insert order
    const orderSql = `
        INSERT INTO orders
        (user_id, total_amount, status)
        VALUES (?, ?, ?)
    `;

    db.query(
        orderSql,
        [userId, totalAmount, "Pending"],
        (err, result) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    message: "Failed to create order"
                });
            }

            const orderId = result.insertId;

            // Prepare order items
            const values = items.map(item => [

                orderId,
                item.id,
                item.quantity,
                item.price

            ]);

            // Insert order items
            const itemSql = `
                INSERT INTO order_items
                (order_id, product_id, quantity, price)
                VALUES ?
            `;

            db.query(
                itemSql,
                [values],
                (err) => {

                    if (err) {

                        console.log(err);

                        return res.status(500).json({
                            message: "Failed to save order items"
                        });
                    }

                    res.status(201).json({

                        message: "Order placed successfully",

                        orderId: orderId
                    });
                }
            );
        }
    );
});

// ===============================
// GET USER ORDER HISTORY
// ===============================

app.get("/api/orders/:userId", (req, res) => {

    const userId = req.params.userId;

    const sql = `
        SELECT
            orders.id AS order_id,
            orders.total_amount,
            orders.status,
            orders.created_at,
            order_items.product_id,
            order_items.quantity,
            order_items.price,
            products.name AS product_name
        FROM orders
        JOIN order_items
            ON orders.id = order_items.order_id
        JOIN products
            ON order_items.product_id = products.id
        WHERE orders.user_id = ?
        ORDER BY orders.created_at DESC
    `;

    db.query(sql, [userId], (err, results) => {

        if (err) {

            console.log(err);

            return res.status(500).json({
                message: "Failed to fetch orders"
            });
        }

        res.json(results);
    });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});