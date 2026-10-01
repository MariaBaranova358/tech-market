const express = require('express');
const path = require('path');
const pool = require('./db');
require('dotenv').config();

console.log('DB =', process.env.DB_NAME, '| USER =', process.env.DB_USER);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));

// Главная
app.get('/', (req, res) => {
  res.render('index', { title: 'Главная' });
});

// Каталог — берём товары из БД
app.get('/catalog', async (req, res) => {
  const result = await pool.query('SELECT * FROM products WHERE stock > 0 ORDER BY created_at DESC');
  res.render('catalog', { title: 'Каталог', products: result.rows });
});

// Контакты
app.get('/contacts', (req, res) => {
  res.render('contacts', { title: 'Контакты' });
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});