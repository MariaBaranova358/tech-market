const express = require('express');
const path = require('path');
const session = require('express-session')
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt')
const pool = require('./db');
require('dotenv').config();



console.log('DB =', process.env.DB_NAME, '| USER =', process.env.DB_USER);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret123',
  resave: false,
  saveUninitialized: false,
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Главная
app.get('/', (req, res) => {
  res.render('index', { title: 'Главная' });
});

// Каталог — берём товары из БД
// Каталог — сортировка, фильтр по категории
app.get('/catalog', async (req, res) => {
  const { sort = 'new', category = '' } = req.query;

  let orderBy = 'p.created_at DESC';           // по новизне (по умолчанию)
  if (sort === 'year')  orderBy = 'p.year DESC';
  if (sort === 'name')  orderBy = 'p.name ASC';
  if (sort === 'price') orderBy = 'p.price ASC';

  let sql = `
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.stock > 0
  `;
  const params = [];

  if (category) {
    sql += ' AND p.category_id = $1';
    params.push(category);
  }

  sql += ' ORDER BY ' + orderBy;

  const products = await pool.query(sql, params);
  const categories = await pool.query('SELECT * FROM categories ORDER BY id');

  res.render('catalog', {
    title: 'Каталог',
    products: products.rows,
    categories: categories.rows,
    sort,
    category,
  });
});

// Страница товара
app.get('/product/:id', async (req, res) => {
  const r = await pool.query('SELECT * FROM products WHERE id = $1 AND stock > 0', [req.params.id]);
  if (!r.rows.length) return res.redirect('/catalog');

  res.render('product', { title: r.rows[0].name, product: r.rows[0] });
});

// Контакты
app.get('/contacts', (req, res) => {
  res.render('contacts', { title: 'Контакты' });
});

app.get('/register', (req, res) => {
  res.render('register', { title: 'Регистрация', errors: {}, old: {} });
});

app.get('/login', (req, res) => {
  res.render('login', { title: 'Вход', error: null });
});

app.post('/register',
  body('name').matches(/^[А-Яа-яЁё\s-]+$/).withMessage('Только кириллица, пробел и тире'),
  body('surname').matches(/^[А-Яа-яЁё\s-]+$/).withMessage('Только кириллица, пробел и тире'),
  body('patronymic').optional({ checkFalsy: true }).matches(/^[А-Яа-яЁё\s-]+$/).withMessage('Только кириллица'),
  body('login').matches(/^[A-Za-z0-9-]+$/).withMessage('Только латиница, цифры и тире'),
  body('email').isEmail().withMessage('Некорректный email'),
  body('password').isLength({ min: 6 }).withMessage('Минимум 6 символов'),
  body('password_repeat').custom((v, { req }) => v === req.body.password).withMessage('Пароли не совпадают'),
  body('rules').equals('on').withMessage('Нужно согласие с правилами'),

  async (req, res) => {
    const errors = validationResult(req);
    const errObj = {};
    errors.array().forEach(e => { if (!errObj[e.path]) errObj[e.path] = e.msg; });

    // проверка уникальности
    const u = await pool.query('SELECT id FROM users WHERE login=$1 OR email=$2', [req.body.login, req.body.email]);
    if (u.rows.length) errObj.login = 'Логин или email уже занят';

    if (Object.keys(errObj).length) {
      return res.render('register', { title: 'Регистрация', errors: errObj, old: req.body });
    }

    const hash = await bcrypt.hash(req.body.password, 10);
    await pool.query(
      'INSERT INTO users (name, surname, patronymic, login, email, password) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.body.name, req.body.surname, req.body.patronymic || null, req.body.login, req.body.email, hash]
    );
    res.redirect('/login');
  }
);

app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const r = await pool.query('SELECT * FROM users WHERE login=$1', [login]);
  const user = r.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.render('login', { title: 'Вход', error: 'Неверный логин или пароль' });
  }

  req.session.user = { id: user.id, login: user.login, role: user.role, name: user.name };
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});