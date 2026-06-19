const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let dbPath = path.join(__dirname, 'diarioph.db');

// Si estamos en Vercel, copiamos la base de datos semilla a /tmp para evitar errores de escritura en sistema de archivos de solo lectura
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  const tmpPath = path.join('/tmp', 'diarioph.db');
  const fs = require('fs');
  try {
    if (!fs.existsSync(tmpPath)) {
      console.log('Copiando base de datos semilla a /tmp...');
      fs.copyFileSync(dbPath, tmpPath);
    }
    dbPath = tmpPath;
  } catch (err) {
    console.error('Error al copiar base de datos a /tmp:', err.message);
  }
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al abrir la base de datos SQLite:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite:', dbPath);
  }
});

// Inicializar tablas
db.serialize(() => {
  // 1. Tabla de Categorías (con soporte para diseños personalizados en el home)
  db.run(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      diseno_home TEXT DEFAULT 'grid', -- 'grid', 'carousel', 'list', 'featured', 'mosaic'
      limite_home INTEGER DEFAULT 3
    )
  `);

  // Migraciones automáticas en caso de que la tabla de categorías ya existiera sin las columnas nuevas
  db.run("ALTER TABLE categorias ADD COLUMN diseno_home TEXT DEFAULT 'grid'", (err) => {
    // Silenciar error si la columna ya existe
  });
  db.run("ALTER TABLE categorias ADD COLUMN limite_home INTEGER DEFAULT 3", (err) => {
    // Silenciar error si la columna ya existe
  });

  // 2. Tabla de Noticias
  db.run(`
    CREATE TABLE IF NOT EXISTS noticias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      contenido TEXT NOT NULL,
      copete TEXT,
      autor TEXT DEFAULT 'Redacción Pehuenia Online',
      fecha TEXT NOT NULL,
      categoria_id INTEGER NOT NULL,
      imagen_url TEXT,
      visitas INTEGER DEFAULT 0,
      estado TEXT DEFAULT 'borrador', -- 'publicado' o 'borrador'
      url_original TEXT,
      FOREIGN KEY(categoria_id) REFERENCES categorias(id)
    )
  `);

  // 3. Tabla de Campañas de Importación (WPeMatico-style)
  db.run(`
    CREATE TABLE IF NOT EXISTS campanas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      url_feed TEXT NOT NULL,
      categoria_id INTEGER NOT NULL,
      frecuencia_minutos INTEGER DEFAULT 60,
      limite_por_ejecucion INTEGER DEFAULT 5,
      estado TEXT DEFAULT 'activa', -- 'activa' o 'pausada'
      auto_reformular INTEGER DEFAULT 0, -- 0=No, 1=Sí
      auto_publicar INTEGER DEFAULT 0, -- 0=Borrador (Revisión manual), 1=Publicado Directo
      ultima_ejecucion TEXT,
      FOREIGN KEY(categoria_id) REFERENCES categorias(id)
    )
  `);

  // 4. Tabla de Configuraciones
  db.run(`
    CREATE TABLE IF NOT EXISTS configuraciones (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `);

  // 5. Tabla de Reproductores de Audio (Radio streams)
  db.run(`
    CREATE TABLE IF NOT EXISTS reproductores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      url_stream TEXT NOT NULL,
      activo INTEGER DEFAULT 1
    )
  `);

  // 6. Tabla de Publicidades (Banners & Popups)
  db.run(`
    CREATE TABLE IF NOT EXISTS publicidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL, -- 'banner_1200x200', 'banner_1200x100', 'banner_700x200', 'banner_700x100', 'banner_300x300', 'popup'
      formato TEXT NOT NULL, -- 'imagen', 'gif', 'video'
      url_archivo TEXT NOT NULL,
      url_destino TEXT,
      activo INTEGER DEFAULT 1
    )
  `);

  // Insertar categorías por defecto
  const categoriasSemilla = [
    { nombre: 'Locales y Provinciales', slug: 'provinciales', diseno: 'mosaic', limite: 3 },
    { nombre: 'Nacionales', slug: 'nacionales', diseno: 'grid', limite: 3 },
    { nombre: 'Internacionales', slug: 'internacionales', diseno: 'list', limite: 4 },
    { nombre: 'Deportes', slug: 'deportes', diseno: 'carousel', limite: 6 },
    { nombre: 'Policiales', slug: 'policiales', diseno: 'list', limite: 4 },
    { nombre: 'Economía', slug: 'economia', diseno: 'grid', limite: 3 },
    { nombre: 'Política', slug: 'politica', diseno: 'grid', limite: 3 },
    { nombre: 'Entretenimiento y Curiosidades', slug: 'entretenimiento-y-curiosidades', diseno: 'grid', limite: 3 },
    { nombre: 'Tecnología', slug: 'tecnologia', diseno: 'featured', limite: 3 },
    { nombre: 'Mascotas', slug: 'mascotas', diseno: 'grid', limite: 3 },
    { nombre: 'Guías de Servicios y Reservas', slug: 'guias-de-servicios-y-reservas', diseno: 'grid', limite: 3 },
    { nombre: 'Quiénes Somos', slug: 'quienes-somos', diseno: 'grid', limite: 1 },
    { nombre: 'Contacto', slug: 'contacto', diseno: 'grid', limite: 1 }
  ];

  const stmtCat = db.prepare('INSERT OR IGNORE INTO categorias (nombre, slug, diseno_home, limite_home) VALUES (?, ?, ?, ?)');
  categoriasSemilla.forEach((cat) => {
    stmtCat.run(cat.nombre, cat.slug, cat.diseno, cat.limite);
  });
  stmtCat.finalize();

  // Insertar campañas por defecto (WPeMatico feeds del usuario)
  db.get('SELECT COUNT(*) as count FROM campanas', (err, row) => {
    if (!err && row.count === 0) {
      db.all('SELECT id, slug FROM categorias', (err, rows) => {
        if (!err) {
          const catMap = {};
          rows.forEach(r => { catMap[r.slug] = r.id; });

          const campanasSemilla = [
            {
              nombre: 'Campaña Política',
              url_feed: 'https://estudiosmax.com.ar/sistema/category/politica/feed/',
              categoria_slug: 'politica',
              frecuencia: 60,
              limite: 5
            },
            {
              nombre: 'Campaña Nacionales',
              url_feed: 'https://estudiosmax.com.ar/sistema/category/nacionales/feed/',
              categoria_slug: 'nacionales',
              frecuencia: 60,
              limite: 5
            },
            {
              nombre: 'Campaña Deportes',
              url_feed: 'https://estudiosmax.com.ar/sistema/category/deportes/feed/',
              categoria_slug: 'deportes',
              frecuencia: 60,
              limite: 5
            },
            {
              nombre: 'Campaña Policiales',
              url_feed: 'https://estudiosmax.com.ar/sistema/category/policiales/feed/',
              categoria_slug: 'policiales',
              frecuencia: 60,
              limite: 5
            },
            {
              nombre: 'Campaña Tecnología',
              url_feed: 'https://estudiosmax.com.ar/sistema/category/tecnologia/feed/',
              categoria_slug: 'tecnologia',
              frecuencia: 120,
              limite: 5
            }
          ];

          const stmtCamp = db.prepare(`
            INSERT INTO campanas (nombre, url_feed, categoria_id, frecuencia_minutos, limite_por_ejecucion, estado, auto_reformular, auto_publicar)
            VALUES (?, ?, ?, ?, ?, 'activa', 1, 0)
          `);

          campanasSemilla.forEach((camp) => {
            const catId = catMap[camp.categoria_slug];
            if (catId) {
              stmtCamp.run(camp.nombre, camp.url_feed, catId, camp.frecuencia, camp.limite);
            }
          });
          stmtCamp.finalize();
          console.log('Campañas semilla insertadas correctamente.');
        }
      });
    }
  });

  // Insertar reproductores por defecto
  db.get('SELECT COUNT(*) as count FROM reproductores', (err, row) => {
    if (!err && row.count === 0) {
      const stmtRep = db.prepare('INSERT INTO reproductores (nombre, url_stream, activo) VALUES (?, ?, ?)');
      stmtRep.run('FM Pehuenia Radio 95.1', 'https://stream.server.com/radio.mp3', 1);
      stmtRep.run('FM Moquehue Radio 92.7', 'https://stream.server.com/radio2.mp3', 1);
      stmtRep.finalize();
      console.log('Reproductores semilla insertados.');
    }
  });

  // Insertar algunas configuraciones semilla
  const configSemilla = [
    { clave: 'gemini_api_key', valor: '' },
    { clave: 'clima_ciudad', valor: 'Villa Pehuenia, Neuquén, Argentina' },
    { clave: 'clima_lat', valor: '-38.8789' },
    { clave: 'clima_lon', valor: '-71.1803' },
    { clave: 'nombre_diario', valor: 'PEHUENIA ONLINE' },
    { clave: 'analytics_id', valor: '' }
  ];

  const stmtConf = db.prepare('INSERT OR IGNORE INTO configuraciones (clave, valor) VALUES (?, ?)');
  configSemilla.forEach((conf) => {
    stmtConf.run(conf.clave, conf.valor);
  });
  stmtConf.finalize();

  // Sembrar publicidades de prueba
  db.get('SELECT COUNT(*) as count FROM publicidades', (err, row) => {
    if (!err && row.count === 0) {
      const stmtPub = db.prepare('INSERT INTO publicidades (nombre, tipo, formato, url_archivo, url_destino, activo) VALUES (?, ?, ?, ?, ?, ?)');
      
      // 1. Banner Superior Grande 1200x200
      stmtPub.run(
        'Publicidad Inmobiliaria Cordillera (1200x200)',
        'banner_1200x200',
        'imagen',
        'https://images.unsplash.com/photo-1542744094-3a31f103e35f?q=80&w=1200&h=200&fit=crop',
        'https://wa.me/5492942000000',
        1
      );

      // 2. Banner Superior Fino 1200x100
      stmtPub.run(
        'Publicidad Rent A Car Moquehue (1200x100)',
        'banner_1200x100',
        'imagen',
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1200&h=100&fit=crop',
        'https://pehueniaonline.com.ar',
        1
      );

      // 3. Banner Intermedio de Noticias 700x100
      stmtPub.run(
        'Gomería El Cruce (700x100)',
        'banner_700x100',
        'imagen',
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?q=80&w=700&h=100&fit=crop',
        'https://wa.me/5492942000000',
        1
      );

      // 4. Banner Sidebar 300x300
      stmtPub.run(
        'Cabañas Pehuenia 300x300',
        'banner_300x300',
        'imagen',
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=300&h=300&fit=crop',
        'https://pehueniaonline.com.ar',
        1
      );

      // 5. Popup de Bienvenida
      stmtPub.run(
        'Popup Promoción Invierno (Popup)',
        'popup',
        'imagen',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&h=600&fit=crop',
        'https://wa.me/5492942000000',
        1
      );

      stmtPub.finalize();
      console.log('Publicidades semilla insertadas.');
    }
  });
});

module.exports = db;
