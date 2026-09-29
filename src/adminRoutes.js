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

    res.status(500).json({
      message: 'Unable to delete product.',
    });
  }
});

export default router;
