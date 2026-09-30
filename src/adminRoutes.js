import express from 'express';
import pool from './db.js';

const router = express.Router();

// Get all products
router.get('/products', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        price,
        image,
        sizes,
        stock,
        created_at,
        updated_at
      FROM products
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Admin products error:', error);

    res.status(500).json({
      message: 'Unable to load products.',
    });
  }
});

// Add product
router.post('/products', async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      image,
      sizes,
      stock,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        message: 'Product name is required.',
      });
    }

    const productPrice = Number(price);
    const productStock = Number(stock);

    if (!Number.isFinite(productPrice) || productPrice < 0) {
      return res.status(400).json({
        message: 'Price must be a valid positive number.',
      });
    }

    if (!Number.isInteger(productStock) || productStock < 0) {
      return res.status(400).json({
        message: 'Stock must be a valid non-negative integer.',
      });
    }

    if (!Array.isArray(sizes) || sizes.length === 0) {
      return res.status(400).json({
        message: 'At least one shoe size is required.',
      });
    }

    const cleanSizes = sizes
      .map(Number)
      .filter(Number.isInteger);

    if (cleanSizes.length !== sizes.length) {
      return res.status(400).json({
        message: 'All shoe sizes must be valid numbers.',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO products
        (name, description, price, image, sizes, stock)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        name,
        description,
        price,
        image,
        sizes,
        stock,
        created_at,
        updated_at
      `,
      [
        name.trim(),
        description?.trim() || null,
        productPrice,
        image?.trim() || null,
        cleanSizes,
        productStock,
      ]
    );

    res.status(201).json({
      message: 'Product created successfully.',
      product: result.rows[0],
    });
  } catch (error) {
    console.error('Create product error:', error);

    res.status(500).json({
      message: 'Unable to create product.',
    });
  }
});

// Update product
router.put('/products/:id', async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        message: 'Invalid product ID.',
      });
    }

    const {
      name,
      description,
      price,
      image,
      sizes,
      stock,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        message: 'Product name is required.',
      });
    }

    const productPrice = Number(price);
    const productStock = Number(stock);

    if (!Number.isFinite(productPrice) || productPrice < 0) {
      return res.status(400).json({
        message: 'Price must be a valid positive number.',
      });
    }

    if (!Number.isInteger(productStock) || productStock < 0) {
      return res.status(400).json({
        message: 'Stock must be a valid non-negative integer.',
      });
    }

    if (!Array.isArray(sizes) || sizes.length === 0) {
      return res.status(400).json({
        message: 'At least one shoe size is required.',
      });
    }

    const cleanSizes = sizes
      .map(Number)
      .filter(Number.isInteger);

    if (cleanSizes.length !== sizes.length) {
      return res.status(400).json({
        message: 'All shoe sizes must be valid numbers.',
      });
    }

    const result = await pool.query(
      `
      UPDATE products
      SET
        name = $1,
        description = $2,
        price = $3,
        image = $4,
        sizes = $5,
        stock = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING
        id,
        name,
        description,
        price,
        image,
        sizes,
        stock,
        created_at,
        updated_at
      `,
      [
        name.trim(),
        description?.trim() || null,
        productPrice,
        image?.trim() || null,
        cleanSizes,
        productStock,
        productId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Product not found.',
      });
    }

    res.json({
      message: 'Product updated successfully.',
      product: result.rows[0],
    });
  } catch (error) {
    console.error('Update product error:', error);

    res.status(500).json({
      message: 'Unable to update product.',
    });
  }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        message: 'Invalid product ID.',
      });
    }

    const result = await pool.query(
      `
      DELETE FROM products
      WHERE id = $1
      RETURNING id, name
      `,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Product not found.',
      });
    }

    res.json({
      message: 'Product deleted successfully.',
      product: result.rows[0],
    });
    } catch (error) {
    console.error('Delete product error:', error);

    if (error.code === '23503') {
      return res.status(409).json({
        message:
          'This product cannot be deleted because it is included in existing orders. You can edit it or set its stock to 0 instead.',
      });
    }

    res.status(500).json({
      message: 'Unable to delete product.',
    });
  }
});

router.get('/orders', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.id,
        o.customer_name,
        o.email,
        o.phone,
        o.address,
        o.total,
        o.status,
        o.created_at,
        o.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_id', oi.product_id,
              'product_name', p.name,
              'size', oi.size,
              'quantity', oi.quantity,
              'price', oi.price
            )
            ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Admin orders error:', error);

    res.status(500).json({
      message: 'Unable to load orders.',
    });
  }
});

router.patch('/orders/:id/status', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      'pending',
      'confirmed',
      'shipped',
      'delivered',
      'cancelled',
    ];

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: 'Invalid order ID.',
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid order status.',
      });
    }

    const result = await pool.query(
      `
        UPDATE orders
        SET status = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          customer_name,
          email,
          phone,
          address,
          total,
          status,
          created_at,
          updated_at
      `,
      [status, orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Order not found.',
      });
    }

    res.json({
      message: 'Order status updated successfully.',
      order: result.rows[0],
    });
  } catch (error) {
    console.error('Update order status error:', error);

    res.status(500).json({
      message: 'Unable to update order status.',
    });
  }
});

export default router;
