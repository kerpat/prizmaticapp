/*
 * Express server for Bike App integration with SQLite.
 *
 * This server exposes a small REST API used by the frontend code in
 * site/registration.html, admin.js and other scripts. It provides
 * persistence via a SQLite database stored alongside this file and
 * supports uploading passport and registration photos during
 * registration. All endpoints return JSON responses and are
 * designed to be as simple as possible while still enabling
 * essential CRUD operations.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
// fetch is globally available in Node 22. We avoid requiring
// 'node-fetch' because it is not installed. If you run this
// server in older Node versions, ensure that a global fetch is
// available or install node-fetch.

const app = express();
const PORT = process.env.PORT || 3000;

// Create upload directory if it doesn't exist. Uploaded images will
// be stored here and the file names saved in the database. The
// directory is relative to this script.
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Load the Gemini API key from an environment variable if provided or
// fallback to a hardcoded value. If you have a valid API key, set
// process.env.GEMINI_API_KEY before starting the server. This key
// enables us to call the Gemini API to extract text from passport
// photos. You should keep your key secret and never commit it to
// public repositories.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAUay_xvRT_gcMYs3-7i8Pcli680Or5Zwk';

/**
 * Build a Gemini API request and send it to extract personal data from
 * passport images. The Gemini model accepts a prompt (in Russian) and
 * a series of image parts encoded as base64. Depending on the
 * country, we send a different prompt. See the Python example in
 * telegram_bot.py for the original logic.
 *
 * @param {string[]} imagePaths Absolute filesystem paths of the images to process.
 * @param {string} country The country code or name provided by the user (e.g. 'РФ', 'Россия').
 * @returns {Promise<object|null>} Parsed JSON with recognized fields, or null on error.
 */
/**
 * Process a set of passport images through the Gemini API. The model is
 * instructed via a Russian prompt to extract structured data. Depending
 * on the country and migrant status, the prompt includes different
 * fields. After parsing the JSON response, certain values are
 * normalised: passport numbers gain spaces after two and four digits,
 * and subdivision codes gain a dash after the third digit.
 *
 * @param {string[]} imagePaths Absolute paths to images on disk.
 * @param {string|undefined} country The country specified by the user (e.g. 'РФ', 'Узбекистан').
 * @param {boolean|undefined} isMigrant Whether the user is marked as a migrant. Only relevant for foreign passports.
 * @returns {Promise<object|null>} The extracted and normalised data or null on failure.
 */
async function processPassportImages(imagePaths, country, isMigrant) {
  try {
    // Encode images as base64 parts with appropriate MIME types.
    const parts = [];
    for (const p of imagePaths) {
      const buffer = await fs.promises.readFile(p);
      const ext = path.extname(p).toLowerCase();
      let mime = 'image/jpeg';
      if (ext === '.png') mime = 'image/png';
      if (ext === '.webp') mime = 'image/webp';
      const data = buffer.toString('base64');
      parts.push({ inlineData: { mimeType: mime, data } });
    }
    // Determine whether this is a Russian passport. If country is empty or
    // starts with 'РФ'/'рос', treat as Russian. Otherwise treat as foreign.
    const isRF = !country || /^(\s*РФ|\s*рос)/i.test(country.trim());
    // Build the prompt with appropriate keys. When not a migrant, omit
    // the patent number from the foreign passport prompt. For Russian
    // passports request extra fields including issuing authority and
    // subdivision code.
    let prompt;
    if (isRF) {
      prompt = `Проанализируй эти изображения: основной разворот паспорта РФ, страница с пропиской и при наличии — селфи с паспортом.\n` +
               `Извлеки все данные и верни их в виде ОДНОГО плоского JSON объекта.\n` +
               `Ключи: "Фамилия", "Имя", "Отчество", "Дата рождения", "Номер паспорта", "Кем выдан", "Дата выдачи", "Код подразделения", "Адрес регистрации".\n` +
               `Для поля "Номер паспорта" используй формат "XX XX XXXXXX" — две группы по 2 цифры серии и затем 6 цифр номера, разделённые пробелами.\n` +
               `Для поля "Код подразделения" используй формат "XXX-XXX" — три цифры, дефис, затем три цифры.\n` +
               `Если поле не найдено, значение должно быть пустой строкой.\n` +
               `Ответ должен быть только чистым JSON.`;
    } else {
      // Foreign passport prompt. Include patent number only for migrants.
      const baseKeys = [`"ФИО"`, `"Гражданство"`, `"Дата рождения"`, `"Номер паспорта"`, `"Адрес регистрации в РФ"`];
      if (isMigrant) {
        baseKeys.push(`"Номер патента"`);
      }
      prompt = `Проанализируй эти изображения: паспорт иностранного гражданина, регистрация в РФ, и при наличии — селфи с паспортом или патент.\n` +
               `Извлеки все данные и верни их в виде ОДНОГО плоского JSON объекта.\n` +
               `Ключи: ${baseKeys.join(', ')}.\n` +
               `Если поле не найдено, значение должно быть пустой строкой.\n` +
               `Ответ должен быть только чистым JSON.`;
    }
    // Compose the Gemini request body.
    const contents = [{ role: 'user', parts: [{ text: prompt }, ...parts] }];
    const safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ];
    const body = { contents, safetySettings };
    const endpoint = `https://generativeai.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.error('Gemini API returned HTTP', resp.status);
      return null;
    }
    const result = await resp.json();
    const candidates = result.candidates;
    if (!candidates || !candidates.length) {
      console.error('Gemini response missing candidates');
      return null;
    }
    const text = candidates[0]?.content?.parts?.[0]?.text || '';
    let cleaned = text.trim().replace(/`/g, '');
    if (/^json/i.test(cleaned)) {
      cleaned = cleaned.replace(/^json/i, '').trim();
    }
    let recognized;
    try {
      recognized = JSON.parse(cleaned);
    } catch (e) {
      // try to extract last brace block
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { recognized = JSON.parse(match[0]); } catch {}
      }
    }
    if (!recognized || typeof recognized !== 'object') {
      throw new Error('Invalid recognition data');
    }
    // Normalise specific fields
    const normalised = { ...recognized };
    // Normalise passport number format (both Russian and foreign). Expect digits only.
    if (normalised['Номер паспорта']) {
      const raw = String(normalised['Номер паспорта']).replace(/[^0-9]/g, '');
      // For Russian: 10 digits, group 2+2+6; for foreigners we keep as is but insert spaces similarly if 9 or 10 digits.
      if (raw.length >= 8) {
        const series = raw.slice(0, 4);
        const number = raw.slice(4);
        // format series as 2+2 and join with spaces
        const seriesFormatted = series ? series.match(/.{1,2}/g)?.join(' ') : '';
        normalised['Номер паспорта'] = seriesFormatted ? `${seriesFormatted} ${number}`.trim() : raw;
      }
    }
    // Normalise subdivision code (Russian only)
    if (normalised['Код подразделения']) {
      const raw = String(normalised['Код подразделения']).replace(/[^0-9]/g, '');
      if (raw.length >= 6) {
        normalised['Код подразделения'] = `${raw.slice(0, 3)}-${raw.slice(3, 6)}`;
      }
    }
    return normalised;
  } catch (err) {
    console.error('Error processing passport images:', err);
    return null;
  }
}

// Configure multer for file uploads. We restrict to image files and
// preserve the original extension. Each file will have a unique
// timestamped prefix to avoid collisions.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const time = Date.now();
    cb(null, `${baseName}-${time}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // limit files to 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  },
});

// Enable CORS for all routes. This is safe here because both the
// frontend and backend run on the same machine during development.
app.use(cors());
app.use(bodyParser.json());

// Serve uploaded images statically under /uploads
app.use('/uploads', express.static(uploadsDir));

// === ИЗМЕНЕНИЕ ЗДЕСЬ ===
// Раздавать статические файлы (HTML, CSS, JS) из папки 'site'
app.use(express.static(path.join(__dirname, 'site')));
// ======================

// Initialise SQLite database. If the database file does not exist
// yet it will be created automatically. The migrations below
// create the necessary tables.
const dbFile = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbFile);

// Run migrations to ensure tables exist. SQLite runs each
// statement in sequence. If a table already exists nothing happens.
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    city TEXT,
    passport_photo TEXT,
    registration_photo TEXT,
    is_migrant INTEGER DEFAULT 0,
    extra JSON,
    created_at TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tariffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    price_rub INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    deposit_rub INTEGER DEFAULT 0,
    slug TEXT,
    is_active INTEGER DEFAULT 1,
    sort INTEGER DEFAULT 0,
    -- Список доступных сроков продления в формате JSON (массив объектов {days, cost})
    extensions TEXT
  )`);

  // В случае уже существующей базы добавляем колонку extensions, если она отсутствует.
  db.run('ALTER TABLE tariffs ADD COLUMN extensions TEXT', (err) => {
    // Ничего не делаем, если колонка уже существует
  });
  db.run(`CREATE TABLE IF NOT EXISTS rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    tariff_id INTEGER,
    bike_id TEXT,
    start_at TEXT NOT NULL,
    end_at TEXT,
    status TEXT DEFAULT 'active',
    FOREIGN KEY(client_id) REFERENCES clients(id),
    FOREIGN KEY(tariff_id) REFERENCES tariffs(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    method TEXT,
    status TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(client_id) REFERENCES clients(id)
  )`);
});

// Seed default tariffs if the table is empty. We query and insert
// synchronously because this runs only once on startup.
db.get('SELECT COUNT(*) AS count FROM tariffs', (err, row) => {
  if (!err && row && row.count === 0) {
    const stmt = db.prepare('INSERT INTO tariffs (title, price_rub, duration_days, deposit_rub, slug, is_active, sort, extensions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const defaultTariffs = [
      { title: 'Бронза', price: 1000, days: 3, deposit: 0, slug: 'bronze', sort: 1 },
      { title: 'Серебро', price: 2000, days: 5, deposit: 0, slug: 'silver', sort: 2 },
      { title: 'Золото', price: 3750, days: 7, deposit: 0, slug: 'gold', sort: 3 },
    ];
    defaultTariffs.forEach(t => {
      stmt.run(t.title, t.price, t.days, t.deposit, t.slug, 1, t.sort, null);
    });
    stmt.finalize();
  }
});

// Helper to send error responses
function handleError(res, err) {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
}

// === Tariffs API ===
// List all tariffs. Optionally filter active only with ?active=1.
app.get('/api/tariffs', (req, res) => {
  const active = req.query.active;
  let sql = 'SELECT * FROM tariffs';
  const params = [];
  if (active === '1' || active === 'true') {
    sql += ' WHERE is_active = 1';
  }
  db.all(sql, params, (err, rows) => {
    if (err) return handleError(res, err);
    res.json(rows);
  });
});

// Create a tariff
app.post('/api/tariffs', (req, res) => {
  const {
    title,
    price_rub,
    duration_days,
    deposit_rub,
    slug,
    is_active,
    sort,
    extensions
  } = req.body;
  // extensions может быть массивом объектов или строкой JSON. Приводим к строке.
  let extStr = null;
  if (typeof extensions !== 'undefined') {
    if (typeof extensions === 'string') {
      extStr = extensions;
    } else {
      try {
        extStr = JSON.stringify(extensions);
      } catch (e) {
        extStr = null;
      }
    }
  }
  const stmt = db.prepare(
    'INSERT INTO tariffs (title, price_rub, duration_days, deposit_rub, slug, is_active, sort, extensions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run(
    title,
    price_rub,
    duration_days,
    deposit_rub || 0,
    slug || null,
    is_active ? 1 : 0,
    sort || 0,
    extStr,
    function (err) {
      if (err) return handleError(res, err);
      res.json({ id: this.lastID });
    }
  );
});

// Get a single tariff by ID
app.get('/api/tariffs/:id', (req, res) => {
  const { id } = req.params;
  // Ensure id is a number when possible
  const numericId = parseInt(id, 10);
  const queryId = isNaN(numericId) ? id : numericId;
  db.get('SELECT * FROM tariffs WHERE id = ?', [queryId], (err, row) => {
    if (err) return handleError(res, err);
    if (!row) {
      return res.status(404).json({ error: 'Tariff not found' });
    }
    res.json(row);
  });
});

// Update a tariff by ID
app.put('/api/tariffs/:id', (req, res) => {
  const { id } = req.params;
  const {
    title,
    price_rub,
    duration_days,
    deposit_rub,
    slug,
    is_active,
    sort,
    extensions
  } = req.body;
  let extStr = null;
  if (typeof extensions !== 'undefined') {
    if (typeof extensions === 'string') {
      extStr = extensions;
    } else {
      try {
        extStr = JSON.stringify(extensions);
      } catch (e) {
        extStr = null;
      }
    }
  }
  const stmt = db.prepare(
    'UPDATE tariffs SET title = ?, price_rub = ?, duration_days = ?, deposit_rub = ?, slug = ?, is_active = ?, sort = ?, extensions = ? WHERE id = ?'
  );
  stmt.run(
    title,
    price_rub,
    duration_days,
    deposit_rub || 0,
    slug || null,
    is_active ? 1 : 0,
    sort || 0,
    extStr,
    id,
    function (err) {
      if (err) return handleError(res, err);
      res.json({ updated: this.changes });
    }
  );
});

// Delete a tariff by ID
app.delete('/api/tariffs/:id', (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM tariffs WHERE id = ?');
  stmt.run(id, function(err) {
    if (err) return handleError(res, err);
    
    // Добавим проверку: если ничего не удалилось, значит тарифа с таким ID не было
    if (this.changes === 0) {
        return res.status(404).json({ error: 'Tariff not found' });
    }
    res.json({ deleted: this.changes });
  });
  stmt.finalize(); // Важно закрывать запрос
});

// === Registration API ===
// Handle user registration. Expects multipart/form-data with
// fields: name (required), phone, city, is_migrant, extra (JSON
// string), passport_photo, registration_photo. Uploaded files are
// stored under /uploads and file names are saved in the database.
app.post('/api/register', upload.fields([
  { name: 'passport_photo', maxCount: 1 },
  { name: 'registration_photo', maxCount: 1 },
]), (req, res) => {
  try {
    const { name, phone, city, is_migrant, extra } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    // Files saved by multer. The properties contain arrays even if only one file is uploaded.
    const passportFile = req.files['passport_photo'] ? req.files['passport_photo'][0] : null;
    const registrationFile = req.files['registration_photo'] ? req.files['registration_photo'][0] : null;
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO clients (name, phone, city, passport_photo, registration_photo, is_migrant, extra, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(
      name,
      phone || null,
      city || null,
      passportFile ? `/uploads/${passportFile.filename}` : null,
      registrationFile ? `/uploads/${registrationFile.filename}` : null,
      is_migrant === '1' || is_migrant === 'true' ? 1 : 0,
      extra || null,
      now,
      async function(err) {
        if (err) return handleError(res, err);
        const insertedId = this.lastID;
        res.json({ id: insertedId, created_at: now });
        // After responding to the client, asynchronously process the
        // uploaded passport photos with Gemini if both files exist.
        if (passportFile && registrationFile && GEMINI_API_KEY) {
          try {
            // Determine country from extra JSON if provided
            let country;
            if (extra) {
              try {
                const parsedExtra = JSON.parse(extra);
                country = parsedExtra.country;
              } catch (e) {
                // ignore JSON parse errors
              }
            }
            const passportPath = path.join(__dirname, 'uploads', passportFile.filename);
            const registrationPath = path.join(__dirname, 'uploads', registrationFile.filename);
            // Pass migrant status for better prompt selection
            const isMigFlag = is_migrant === '1' || is_migrant === 'true';
            const recognized = await processPassportImages([passportPath, registrationPath], country, isMigFlag);
            if (recognized) {
              // Merge recognized data into extra JSON and update the row
              let extraObj = {};
              if (extra) {
                try {
                  extraObj = JSON.parse(extra);
                } catch (e) {
                  // ignore
                }
              }
              extraObj.recognized_data = recognized;
              const extraStr = JSON.stringify(extraObj);
              db.run('UPDATE clients SET extra = ? WHERE id = ?', [extraStr, insertedId]);
            }
          } catch (e) {
            console.error('Error during Gemini processing:', e);
          }
        }
      }
    );
  } catch (err) {
    handleError(res, err);
  }
});

// === Passport Processing API ===
// This endpoint accepts up to 4 image files and an optional country field
// and returns recognized passport data using the Gemini API. It can be
// used independently of the registration endpoint. Files should be
// uploaded under the form field name "photos". Example: curl -F
// "photos=@/path/to/passport.jpg" -F "photos=@/path/to/propiska.jpg" -F
// "country=Узбекистан" http://localhost:3000/api/process-passport
app.post('/api/process-passport', upload.array('photos', 4), async (req, res) => {
  try {
    const { country, is_migrant } = req.body;
    const files = req.files || [];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }
    const imagePaths = files.map(f => path.join(__dirname, 'uploads', f.filename));
    const isMigFlag = is_migrant === '1' || is_migrant === 'true';
    const recognized = await processPassportImages(imagePaths, country, isMigFlag);
    if (!recognized) {
      return res.status(500).json({ error: 'Failed to recognize passport data' });
    }
    res.json({ data: recognized });
  } catch (err) {
    handleError(res, err);
  }
});

// === Clients API ===
// Retrieve all clients. An admin can search or export CSV.
app.get('/api/clients', (req, res) => {
  db.all('SELECT * FROM clients ORDER BY created_at DESC', (err, rows) => {
    if (err) return handleError(res, err);
    res.json(rows);
  });
});

// Update a client. Currently supports updating the `extra` field (JSON string)
// which may contain recognized passport data and custom fields. Expects
// JSON body { extra: '{...}' }. Returns number of updated rows.
app.put('/api/clients/:id', (req, res) => {
  const { id } = req.params;
  const { extra } = req.body;
  if (typeof extra !== 'string') {
    return res.status(400).json({ error: 'extra must be a JSON string' });
  }
  const stmt = db.prepare('UPDATE clients SET extra = ? WHERE id = ?');
  stmt.run(extra, id, function(err) {
    if (err) return handleError(res, err);
    res.json({ updated: this.changes });
  });
});

// === Rentals API ===
// List rentals
app.get('/api/rentals', (req, res) => {
  db.all('SELECT * FROM rentals ORDER BY start_at DESC', (err, rows) => {
    if (err) return handleError(res, err);
    res.json(rows);
  });
});

// Create a rental. Expects JSON with client_id, tariff_id, bike_id. The
// rental starts immediately and ends after the tariff duration. If
// tariff_id is null the rental is considered free-form (e.g. via QR).
app.post('/api/rentals', (req, res) => {
  const { client_id, tariff_id, bike_id } = req.body;
  if (!client_id || !bike_id) {
    return res.status(400).json({ error: 'client_id and bike_id are required' });
  }
  // Determine end date based on tariff duration
  const now = new Date();
  let endDate = null;
  if (tariff_id) {
    db.get('SELECT duration_days FROM tariffs WHERE id = ?', [tariff_id], (err, row) => {
      if (err) return handleError(res, err);
      const days = row ? row.duration_days : 0;
      endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      insertRental();
    });
  } else {
    insertRental();
  }
  function insertRental() {
    const stmt = db.prepare('INSERT INTO rentals (client_id, tariff_id, bike_id, start_at, end_at) VALUES (?, ?, ?, ?, ?)');
    stmt.run(
      client_id,
      tariff_id || null,
      bike_id,
      now.toISOString(),
      endDate ? endDate.toISOString() : null,
      function(err) {
        if (err) return handleError(res, err);
        res.json({ id: this.lastID });
      }
    );
  }
});

// Обновление аренды (например, продление). Ожидает JSON { ends_at, total_rub, status }
app.put('/api/rentals/:id', (req, res) => {
  const id = req.params.id;
  const { ends_at, total_rub, status } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: 'Bad id' });
  }
  const stmt = db.prepare('UPDATE rentals SET ends_at = ?, total_rub = ?, status = ? WHERE id = ?');
  stmt.run(ends_at || null, total_rub || 0, status || 'active', id, function (err) {
    if (err) return handleError(res, err);
    res.json({ updated: this.changes || 0 });
  });
});

// === Payments API ===
// List payments
app.get('/api/payments', (req, res) => {
  db.all('SELECT * FROM payments ORDER BY created_at DESC', (err, rows) => {
    if (err) return handleError(res, err);
    res.json(rows);
  });
});

// Create a payment. Expects JSON with client_id, amount, method, status.
app.post('/api/payments', (req, res) => {
  const { client_id, amount, method, status } = req.body;
  if (!client_id || !amount) {
    return res.status(400).json({ error: 'client_id and amount are required' });
  }
  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO payments (client_id, amount, method, status, created_at) VALUES (?, ?, ?, ?, ?)');
  stmt.run(client_id, amount, method || null, status || 'pending', now, function(err) {
    if (err) return handleError(res, err);
    res.json({ id: this.lastID });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});