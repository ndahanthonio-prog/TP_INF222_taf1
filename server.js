const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Blog API',
      version: '1.0.0',
      description: 'API for managing blog articles'
    },
    servers: [{ url: 'http://localhost:3000' }]
  },
  apis: ['./server.js']
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ---------- ROUTES ----------

/**
 * @swagger
 * /api/articles:
 *   post:
 *     summary: Create a new article
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content, author]
 *             properties:
 *               title: string
 *               content: string
 *               author: string
 *               category: string
 *               tags: string
 *     responses:
 *       201:
 *         description: Article created
 */
app.post('/api/articles', (req, res) => {
  const { title, content, author, category, tags } = req.body;
  if (!title || !content || !author) {
    return res.status(400).json({ error: 'Title, content, and author are required.' });
  }
  const sql = `INSERT INTO articles (title, content, author, category, tags) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [title, content, author, category, tags], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

/**
 * @swagger
 * /api/articles:
 *   get:
 *     summary: Get all articles (with optional filters)
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: author
 *         schema: { type: string }
 *       - in: query
 *         name: date
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of articles
 */
app.get('/api/articles', (req, res) => {
  let sql = 'SELECT * FROM articles WHERE 1=1';
  const params = [];
  if (req.query.category) {
    sql += ' AND category = ?';
    params.push(req.query.category);
  }
  if (req.query.author) {
    sql += ' AND author = ?';
    params.push(req.query.author);
  }
  if (req.query.date) {
    sql += ' AND date = ?';
    params.push(req.query.date);
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/**
 * @swagger
 * /api/articles/{id}:
 *   get:
 *     summary: Get one article by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Article object
 *       404:
 *         description: Not found
 */
app.get('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM articles WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Article not found' });
    res.json(row);
  });
});

/**
 * @swagger
 * /api/articles/{id}:
 *   put:
 *     summary: Update an article
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: string
 *               content: string
 *               category: string
 *               tags: string
 *     responses:
 *       200:
 *         description: Updated successfully
 *       404:
 *         description: Not found
 */
app.put('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  const { title, content, category, tags } = req.body;
  const fields = [];
  const values = [];
  if (title) { fields.push('title = ?'); values.push(title); }
  if (content) { fields.push('content = ?'); values.push(content); }
  if (category) { fields.push('category = ?'); values.push(category); }
  if (tags) { fields.push('tags = ?'); values.push(tags); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  const sql = `UPDATE articles SET ${fields.join(', ')} WHERE id = ?`;
  db.run(sql, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Article not found' });
    res.json({ message: 'Article updated' });
  });
});

/**
 * @swagger
 * /api/articles/{id}:
 *   delete:
 *     summary: Delete an article
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Not found
 */
app.delete('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM articles WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Article not found' });
    res.json({ message: 'Article deleted' });
  });
});

/**
 * @swagger
 * /api/articles/search:
 *   get:
 *     summary: Search articles by title or content
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matching articles
 */
app.get('/api/articles/search', (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query parameter is required' });
  const sql = `SELECT * FROM articles WHERE title LIKE ? OR content LIKE ?`;
  const like = `%${query}%`;
  db.all(sql, [like, like], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});