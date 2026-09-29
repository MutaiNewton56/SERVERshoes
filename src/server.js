import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './db.js';
import { loginAdmin, verifyAdminToken } from './adminAuth.js';
import adminRoutes from './adminRoutes.js';

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'shoe-store-api' });
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: 'Email and password are required.',
      });
    }

    const token = await loginAdmin(
      email.trim(),
      password
    );

    if (!token) {
      return res.status(401).json({
        message: 'Invalid admin credentials.',
      });
    }

    res.json({
      message: 'Admin login successful.',
      token,
    });
  } catch (error) {
    console.error('Admin login error:', error);

    res.status(500).json({
      message: 'Unable to log in right now.',
    });
  }
});

function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Admin authentication required.',
      });
    }

    const token = authHeader.slice(7);
    const admin = verifyAdminToken(token);

    if (admin.role !== 'admin') {
      return res.status(403).json({
        message: 'Admin access required.',
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired admin token.',
    });
  }
}

app.use('/api/admin', requireAdmin, adminRoutes);
app.get('/api/admin/test', requireAdmin, (req, res) => {
  res.json({
    ok: true,
    message: 'Admin authentication is working.',
    admin: req.admin.email,
  });
});
app.get('/api/products', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        price,
        image,
        sizes,
        stock
      FROM products
      WHERE stock > 0
      ORDER BY id
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Products error:', error);

    res.status(500).json({
      message: 'Unable to load products.',
    });
  }
});

/**
 * Save contact messages
 */
app.post('/api/messages', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }

    if (!email?.trim()) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    if (!message?.trim()) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const result = await pool.query(
      `
      INSERT INTO messages (name, email, message)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
      `,
      [name.trim(), email.trim(), message.trim()]
    );

    res.status(201).json({
      message: 'Thanks! Your message was received.',
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at,
    });
  } catch (error) {
    console.error('Message error:', error);

    res.status(500).json({
      message: 'Unable to save your message right now.',
    });
  }
});

/**
 * Create an order
 */
app.post('/api/orders', async (req, res) => {
  const { customer, items } = req.body;

  if (!customer?.name?.trim()) {
    return res.status(400).json({ message: 'Customer name is required.' });
  }

  if (!customer?.phone?.trim()) {
    return res.status(400).json({ message: 'Phone number is required.' });
  }

  if (!customer?.address?.trim()) {
    return res.status(400).json({ message: 'Address is required.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must contain at least one item.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let total = 0;
    const orderItems = [];

    /*
     * Check every product against the database.
     * We do NOT trust the price sent by the frontend.
     */
    for (const item of items) {
      const productId = Number(item.productId);
      const size = Number(item.size);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(productId) || productId <= 0) {
        throw new Error('Invalid product ID.');
      }

      if (!Number.isInteger(size)) {
        throw new Error('Invalid shoe size.');
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Invalid quantity.');
      }

      const productResult = await client.query(
        `
        SELECT id, name, price, sizes, stock
        FROM products
        WHERE id = $1
        FOR UPDATE
        `,
        [productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Product ${productId} was not found.`);
      }

      const product = productResult.rows[0];

      if (!product.sizes.includes(size)) {
        throw new Error(
          `${product.name} is not available in size ${size}.`
        );
      }

      if (product.stock < quantity) {
        throw new Error(
          `${product.name} does not have enough stock.`
        );
      }

      const price = Number(product.price);
      const lineTotal = price * quantity;

      total += lineTotal;

      orderItems.push({
        productId,
        size,
        quantity,
        price,
      });
    }

    /*
     * Create the order.
     */
    const orderResult = await client.query(
      `
      INSERT INTO orders
        (customer_name, email, phone, address, total)
      VALUES
        ($1, $2, $3, $4, $5)
      RETURNING id, total, status, created_at
      `,
      [
        customer.name.trim(),
        customer.email?.trim() || null,
        customer.phone.trim(),
        customer.address.trim(),
        total,
      ]
    );

    const order = orderResult.rows[0];

    /*
     * Save each item and reduce stock.
     */
    for (const item of orderItems) {
      await client.query(
        `
        INSERT INTO order_items
          (order_id, product_id, size, quantity, price)
        VALUES
          ($1, $2, $3, $4, $5)
        `,
        [
          order.id,
          item.productId,
          item.size,
          item.quantity,
          item.price,
        ]
      );

      await client.query(
        `
        UPDATE products
        SET stock = stock - $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [item.quantity, item.productId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Order placed successfully.',
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
        createdAt: order.created_at,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Order error:', error);

    res.status(400).json({
      message: error.message || 'Unable to place order.',
    });
  } finally {
    client.release();
  }
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
