const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Parser = require('rss-parser');
const cheerio = require('cheerio');
const cron = require('node-cron');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const parser = new Parser();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Almacén de tareas cron activas para poder cancelarlas/reiniciarlas
const cronTasks = {};

// ==========================================
// MOTOR DE REFORMULACIÓN (INTEGRACIÓN IA)
// ==========================================

async function reformularNoticia(tituloOriginal, contenidoOriginal, apiKey = '') {
  const systemPrompt = `Eres un redactor de noticias profesional para el diario Pehuenia Online. Tu tarea es:
1. Cambiar el título por uno más atractivo, limpio y moderno (estilo periodístico impecable, aplicando principios de curiosidad-contraste, evitando clickbait genérico).
2. Reformular el desarrollo de la noticia para que sea más clara, fluida y con una redacción periodística elegante. El contenido devuelto en el campo "contenido" debe estar estructurado en párrafos envueltos en etiquetas HTML <p>...</p> para mantener el formato y separación adecuados.
3. EVITAR AI-isms (palabras cliché de IA como "pivotal", "robusto", "testamento a", "adentrarse", "apasionante", "comenzar un viaje", etc.). Usa un tono natural y humano.
4. IMPORTANTISIMO: No inventes NINGÚN dato, cifra, nombre de persona, fecha, locación o hecho. Debes ceñirte única y estrictamente a la información que aparece en la noticia original. Prohibido inventar o alucinar datos.

Devuelve la respuesta en formato JSON estructurado exactamente así:
{
  "titulo": "Nuevo título reformulado",
  "contenido": "Cuerpo de la noticia reformulado..."
}`;

  if (!apiKey) {
    // Si no hay API Key de Gemini configurada, realizamos una reformulación "mock" inteligente a nivel local
    console.log('Gemini API Key no configurada. Usando reformulador simulado local.');
    
    // Crear un título alternativo sutil
    let nuevoTitulo = tituloOriginal;
    if (!tituloOriginal.includes('(Actualizado)')) {
      nuevoTitulo = `${tituloOriginal} (Actualizado)`;
    }
    
    // Reformulación simulada local que conserva todo el desarrollo HTML completo
    let nuevoContenido = contenidoOriginal;
    try {
      const $ = cheerio.load(contenidoOriginal);
      const firstParagraph = $('p').first();
      
      if (firstParagraph.length) {
        const text = firstParagraph.html();
        if (!text.includes('Villa Pehuenia.')) {
          firstParagraph.html(`<strong>Villa Pehuenia.</strong> ${text}`);
        }
        nuevoContenido = $.html();
      } else {
        // Fallback si no hay párrafos p
        nuevoContenido = `<p><strong>Villa Pehuenia.</strong> </p>${contenidoOriginal}`;
      }
    } catch (e) {
      console.error('Error al inyectar localización en el mock local:', e);
      nuevoContenido = contenidoOriginal;
    }

    return {
      titulo: nuevoTitulo,
      contenido: nuevoContenido
    };
  }

  try {
    // Fetch directo a la API de Gemini (modelo gemini-2.5-flash o similar)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nNoticia Original:\nTítulo: ${tituloOriginal}\nContenido: ${contenidoOriginal}`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API de Gemini retornó estado: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    const result = JSON.parse(responseText.trim());
    return {
      titulo: result.titulo || tituloOriginal,
      contenido: result.contenido || contenidoOriginal
    };
  } catch (error) {
    console.error('Error al reformular con Gemini:', error);
    // En caso de error, devolvemos el original
    return {
      titulo: tituloOriginal,
      contenido: contenidoOriginal,
      error: error.message
    };
  }
}

// ==========================================
// SCRAPER Y PROCESADOR DE FEEDS (WPeMatico-style)
// ==========================================

async function procesarCampana(campanaId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT c.*, cat.nombre as categoria_nombre FROM campanas c JOIN categorias cat ON c.categoria_id = cat.id WHERE c.id = ?', [campanaId], async (err, campana) => {
      if (err || !campana) {
        console.error(`Campaña ${campanaId} no encontrada.`);
        return reject(err || new Error('Campaña no encontrada'));
      }

      if (campana.estado === 'pausada') {
        console.log(`La campaña "${campana.nombre}" está pausada.`);
        return resolve({ status: 'pausada' });
      }

      console.log(`Ejecutando campaña: "${campana.nombre}" (Feed: ${campana.url_feed})`);

      try {
        // Obtener la API key de Gemini para ver si podemos reformular
        const apiKeyRow = await new Promise((res) => {
          db.get("SELECT valor FROM configuraciones WHERE clave = 'gemini_api_key'", (err, row) => res(row));
        });
        const apiKey = apiKeyRow ? apiKeyRow.valor : '';

        // Parsear el feed RSS
        const feed = await parser.parseURL(campana.url_feed);
        let itemsAProcesar = feed.items.slice(0, campana.limite_por_ejecucion);
        let importados = 0;

        for (const item of itemsAProcesar) {
          // Verificar si ya existe por URL original
          const existe = await new Promise((res) => {
            db.get('SELECT id FROM noticias WHERE url_original = ? OR titulo = ?', [item.link, item.title], (err, row) => res(row));
          });

          if (existe) {
            continue; // Saltar si ya existe
          }

          // Obtener el contenido original completo de content:encoded o content
          let contenidoOriginal = item['content:encoded'] || item.content || item.contentSnippet || '';

          // Helper para validar si un enlace es una imagen (e ignorar audios .mp3 u otros adjuntos)
          const esImagenValida = (url, type) => {
            if (!url) return false;
            if (type && (type.startsWith('audio/') || type.startsWith('video/'))) return false;
            const ext = url.split('?')[0].split('.').pop().toLowerCase();
            return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext) || (type && type.startsWith('image/'));
          };

          // Extraer imagen destacada (del feed o del primer <img> del contenido)
          let imagenUrl = '';
          const checkMediaItem = (m) => {
            if (!m) return null;
            if (m.$ && m.$.url && esImagenValida(m.$.url, m.$.type || m.$.medium)) return m.$.url;
            if (m.url && esImagenValida(m.url, m.type || m.medium)) return m.url;
            return null;
          };

          if (item.enclosure && item.enclosure.url && esImagenValida(item.enclosure.url, item.enclosure.type)) {
            imagenUrl = item.enclosure.url;
          } else if (item.mediaContent && item.mediaContent.url && esImagenValida(item.mediaContent.url, item.mediaContent.type)) {
            imagenUrl = item.mediaContent.url;
          } else if (item['media:content']) {
            if (Array.isArray(item['media:content'])) {
              for (const m of item['media:content']) {
                const url = checkMediaItem(m);
                if (url) { imagenUrl = url; break; }
              }
            } else {
              imagenUrl = checkMediaItem(item['media:content']) || '';
            }
          }

          if (!imagenUrl && item['media:thumbnail']) {
            if (Array.isArray(item['media:thumbnail'])) {
              for (const m of item['media:thumbnail']) {
                const url = checkMediaItem(m);
                if (url) { imagenUrl = url; break; }
              }
            } else {
              imagenUrl = checkMediaItem(item['media:thumbnail']) || '';
            }
          }

          if (!imagenUrl && item.image && item.image.url) {
            imagenUrl = item.image.url;
          }

          if (!imagenUrl && contenidoOriginal) {
            // Intentar buscar la primera etiqueta <img> en el contenido con cheerio
            try {
              const $ = cheerio.load(contenidoOriginal);
              const firstImg = $('img').first();
              if (firstImg.length) {
                imagenUrl = firstImg.attr('src');
                // Remover la primera imagen para que no aparezca duplicada en la vista de detalle
                firstImg.remove();
                contenidoOriginal = $.html();
              }
            } catch (imgErr) {
              console.error('Error al extraer imagen con Cheerio:', imgErr);
            }
          }

          // Fallback robusto: si no se encontró imagen en el feed, raspar la web original buscando og:image
          if (!imagenUrl && item.link) {
            try {
              console.log(`Buscando og:image en la web original: ${item.link}`);
              const responsePage = await fetch(item.link, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(5000)
              });
              if (responsePage.ok) {
                const htmlPage = await responsePage.text();
                const $page = cheerio.load(htmlPage);
                const scrapedImg = $page('meta[property="og:image"]').attr('content') 
                  || $page('meta[name="twitter:image"]').attr('content')
                  || $page('.wp-post-image').first().attr('src')
                  || $page('article img').first().attr('src');
                
                if (scrapedImg && esImagenValida(scrapedImg)) {
                  imagenUrl = scrapedImg;
                  console.log(`Imagen destacada recuperada de og:image en web original: ${imagenUrl}`);
                }
              }
            } catch (scrapeErr) {
              console.error(`Error al raspar imagen destacada de la web original (${item.link}):`, scrapeErr.message);
            }
          }

          // Quitar scripts e iframes nocivos del contenido para mantenerlo limpio
          if (contenidoOriginal) {
            try {
              const $ = cheerio.load(contenidoOriginal);
              $('script').remove();
              $('iframe').remove();
              contenidoOriginal = $.html();
            } catch (cleanErr) {
              console.error('Error al limpiar marcado del contenido:', cleanErr);
            }
          }

          let tituloFinal = item.title;
          let contenidoFinal = contenidoOriginal;

          // Reformular con IA si está activado
          if (campana.auto_reformular === 1) {
            console.log(`Reformulando noticia: "${item.title}"`);
            const reformulado = await reformularNoticia(item.title, contenidoOriginal, apiKey);
            tituloFinal = reformulado.titulo;
            contenidoFinal = reformulado.contenido;
          }

          // Establecer estado
          const estadoNoticia = campana.auto_publicar === 1 ? 'publicado' : 'borrador';
          const fechaNoticia = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

          // Insertar en base de datos
          await new Promise((res, rej) => {
            db.run(`
              INSERT INTO noticias (titulo, contenido, fecha, categoria_id, imagen_url, estado, url_original)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [tituloFinal, contenidoFinal, fechaNoticia, campana.categoria_id, imagenUrl, estadoNoticia, item.link], (err) => {
              if (err) rej(err);
              else res();
            });
          });

          importados++;
        }

        // Actualizar la última fecha de ejecución de la campaña
        const ahora = new Date().toISOString();
        await new Promise((res) => {
          db.run('UPDATE campanas SET ultima_ejecucion = ? WHERE id = ?', [ahora, campana.id], () => res());
        });

        console.log(`Campaña "${campana.nombre}" finalizada. Importados: ${importados}`);
        resolve({ status: 'exito', importados });

      } catch (error) {
        console.error(`Error al procesar campaña "${campana.nombre}":`, error);
        reject(error);
      }
    });
  });
}

// Programador automático de cron de campañas
function inicializarCronCampanas() {
  // Cancelar tareas existentes
  Object.keys(cronTasks).forEach(key => {
    cronTasks[key].stop();
    delete cronTasks[key];
  });

  // Cargar campañas activas de la BD
  db.all("SELECT id, nombre, frecuencia_minutos FROM campanas WHERE estado = 'activa'", (err, rows) => {
    if (err) {
      console.error('Error al cargar campañas para el cron:', err);
      return;
    }

    rows.forEach((campana) => {
      // WPeMatico cron expression (ej: cada X minutos)
      const minutos = campana.frecuencia_minutos;
      let cronExpr = `*/${minutos} * * * *`;
      
      // Ajustar si minutos son mayores a 59
      if (minutos >= 60) {
        const horas = Math.floor(minutos / 60);
        cronExpr = `0 */${horas} * * *`;
      }

      console.log(`Programando campaña "${campana.nombre}" (ID: ${campana.id}) para ejecutarse: ${cronExpr}`);

      cronTasks[campana.id] = cron.schedule(cronExpr, () => {
        procesarCampana(campana.id).catch(err => {
          console.error(`Error en la ejecución automática de la campaña ${campana.id}:`, err);
        });
      });
    });
  });
}

// Inicializar el cron al levantar el servidor
inicializarCronCampanas();

// ==========================================
// ENDPOINTS DE API REST (FRONTEND Y ADMIN)
// ==========================================

// --- APIs Públicas ---

// Obtener todas las categorías
app.get('/api/categorias', (req, res) => {
  db.all('SELECT * FROM categorias', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Obtener últimas noticias (publicadas)
app.get('/api/noticias', (req, res) => {
  const { categoria, limite = 10, offset = 0 } = req.query;
  let query = "SELECT n.*, c.nombre as categoria_nombre, c.nombre as categoria_name FROM noticias n JOIN categorias c ON n.categoria_id = c.id WHERE n.estado = 'publicado'";
  const params = [];

  if (categoria) {
    query += " AND c.slug = ?";
    params.push(categoria);
  }

  query += " ORDER BY n.fecha DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limite), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Obtener una noticia por ID y registrar visita (lectura)
app.get('/api/noticias/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT n.*, c.nombre as categoria_nombre, c.nombre as categoria_name FROM noticias n JOIN categorias c ON n.categoria_id = c.id WHERE n.id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Noticia no encontrada' });

    // Incrementar visitas
    db.run('UPDATE noticias SET visitas = visitas + 1 WHERE id = ?', [id]);

    res.json(row);
  });
});

// Obtener reproductores de audio activos
app.get('/api/reproductores', (req, res) => {
  db.all('SELECT * FROM reproductores WHERE activo = 1', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Obtener configuraciones públicas
app.get('/api/configuraciones', (req, res) => {
  db.all('SELECT clave, valor FROM configuraciones WHERE clave != "gemini_api_key"', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const config = {};
    rows.forEach(r => { config[r.clave] = r.valor; });
    res.json(config);
  });
});

// --- APIs de Administración ---

// Obtener estadísticas del dashboard
app.get('/api/admin/estadisticas', (req, res) => {
  const stats = {};
  
  db.get("SELECT COUNT(*) as count FROM noticias WHERE DATE(fecha) = DATE('now')", (err, row) => {
    stats.noticiasHoy = row ? row.count : 0;
    
    db.get("SELECT COUNT(*) as count FROM noticias WHERE estado = 'borrador'", (err, row) => {
      stats.borradores = row ? row.count : 0;
      
      db.get("SELECT SUM(visitas) as total FROM noticias", (err, row) => {
        stats.lecturasTotales = row && row.total ? row.total : 0;
        res.json(stats);
      });
    });
  });
});

// Obtener todas las noticias (para el listado del admin, incluye borradores)
app.get('/api/admin/noticias', (req, res) => {
  db.all('SELECT n.*, c.nombre as categoria_nombre, c.nombre as categoria_name FROM noticias n JOIN categorias c ON n.categoria_id = c.id ORDER BY n.fecha DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Crear noticia
app.post('/api/admin/noticias', (req, res) => {
  const { titulo, contenido, copete, autor, categoria_id, imagen_url, estado } = req.body;
  const fecha = new Date().toISOString();
  db.run(`
    INSERT INTO noticias (titulo, contenido, copete, autor, fecha, categoria_id, imagen_url, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [titulo, contenido, copete, autor, fecha, categoria_id, imagen_url, estado], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Noticia creada con éxito' });
  });
});

// Editar noticia
app.put('/api/admin/noticias/:id', (req, res) => {
  const id = req.params.id;
  const { titulo, contenido, copete, autor, categoria_id, imagen_url, estado } = req.body;
  db.run(`
    UPDATE noticias
    SET titulo = ?, contenido = ?, copete = ?, autor = ?, categoria_id = ?, imagen_url = ?, estado = ?
    WHERE id = ?
  `, [titulo, contenido, copete, autor, categoria_id, imagen_url, estado, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Noticia actualizada con éxito' });
  });
});

// Eliminar noticia
app.delete('/api/admin/noticias/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM noticias WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Noticia eliminada con éxito' });
  });
});

// --- APIs del Content Importer (Campañas RSS) ---

// Obtener todas las campañas
app.get('/api/admin/campanas', (req, res) => {
  db.all('SELECT c.*, cat.nombre as categoria_nombre FROM campanas c JOIN categorias cat ON c.categoria_id = cat.id', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Crear campaña
app.post('/api/admin/campanas', (req, res) => {
  const { nombre, url_feed, categoria_id, frecuencia_minutos, limite_por_ejecucion, auto_reformular, auto_publicar } = req.body;
  db.run(`
    INSERT INTO campanas (nombre, url_feed, categoria_id, frecuencia_minutos, limite_por_ejecucion, estado, auto_reformular, auto_publicar)
    VALUES (?, ?, ?, ?, ?, 'activa', ?, ?)
  `, [nombre, url_feed, categoria_id, frecuencia_minutos, limite_por_ejecucion, auto_reformular, auto_publicar], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    inicializarCronCampanas(); // Recargar programaciones cron
    res.json({ id: this.lastID, message: 'Campaña creada con éxito' });
  });
});

// Editar campaña
app.put('/api/admin/campanas/:id', (req, res) => {
  const id = req.params.id;
  const { nombre, url_feed, categoria_id, frecuencia_minutos, limite_por_ejecucion, estado, auto_reformular, auto_publicar } = req.body;
  db.run(`
    UPDATE campanas
    SET nombre = ?, url_feed = ?, categoria_id = ?, frecuencia_minutos = ?, limite_por_ejecucion = ?, estado = ?, auto_reformular = ?, auto_publicar = ?
    WHERE id = ?
  `, [nombre, url_feed, categoria_id, frecuencia_minutos, limite_por_ejecucion, estado, auto_reformular, auto_publicar, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    inicializarCronCampanas(); // Recargar programaciones cron
    res.json({ message: 'Campaña actualizada con éxito' });
  });
});

// Eliminar campaña
app.delete('/api/admin/campanas/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM campanas WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    inicializarCronCampanas();
    res.json({ message: 'Campaña eliminada con éxito' });
  });
});

// Ejecutar campaña manualmente
app.post('/api/admin/campanas/:id/ejecutar', async (req, res) => {
  const id = req.params.id;
  try {
    const resultado = await procesarCampana(id);
    res.json({ message: 'Campaña ejecutada manualmente con éxito', resultado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de reformulación por IA manual (para revisar borradores o importar manualmente)
app.post('/api/admin/reformular', async (req, res) => {
  const { titulo, contenido } = req.body;
  
  // Obtener la clave API de la base de datos
  db.get("SELECT valor FROM configuraciones WHERE clave = 'gemini_api_key'", async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const apiKey = row ? row.valor : '';
    
    try {
      const reformulado = await reformularNoticia(titulo, contenido, apiKey);
      res.json(reformulado);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Obtener todas las configuraciones administrativas (incluyendo API key)
app.get('/api/admin/configuraciones', (req, res) => {
  db.all('SELECT * FROM configuraciones', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const config = {};
    rows.forEach(r => { config[r.clave] = r.valor; });
    res.json(config);
  });
});

// Guardar configuraciones
app.post('/api/admin/configuraciones', (req, res) => {
  const configs = req.body; // Objeto de clave-valor
  const stmt = db.prepare('INSERT OR REPLACE INTO configuraciones (clave, valor) VALUES (?, ?)');
  
  db.serialize(() => {
    Object.keys(configs).forEach((key) => {
      stmt.run(key, configs[key]);
    });
    stmt.finalize((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Configuraciones guardadas con éxito' });
    });
  });
});

// Asegurar que exista la carpeta public/uploads
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Endpoint para subir imagen (base64 WebP)
app.post('/api/admin/subir-imagen', (req, res) => {
  const { imagenBase64 } = req.body;
  if (!imagenBase64) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen base64' });
  }

  try {
    // Limpiar el prefijo data:image/...;base64,
    const matches = imagenBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Formato base64 inválido' });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    const uniqueName = `img_${Date.now()}_${Math.round(Math.random() * 1000)}.webp`;
    const filePath = path.join(uploadsDir, uniqueName);

    fs.writeFileSync(filePath, buffer);
    const urlPublica = `/uploads/${uniqueName}`;
    res.json({ url: urlPublica });
  } catch (error) {
    console.error('Error al guardar la imagen subida:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- APIs de Publicidades ---

// Obtener publicidades activas (público)
app.get('/api/publicidades', (req, res) => {
  db.all('SELECT * FROM publicidades WHERE activo = 1', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Obtener todas las publicidades (admin)
app.get('/api/admin/publicidades', (req, res) => {
  db.all('SELECT * FROM publicidades ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Crear publicidad
app.post('/api/admin/publicidades', (req, res) => {
  const { nombre, tipo, formato, url_archivo, url_destino, activo } = req.body;
  db.run(`
    INSERT INTO publicidades (nombre, tipo, formato, url_archivo, url_destino, activo)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [nombre, tipo, formato, url_archivo, url_destino, activo], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Publicidad creada con éxito' });
  });
});

// Actualizar publicidad
app.put('/api/admin/publicidades/:id', (req, res) => {
  const id = req.params.id;
  const { nombre, tipo, formato, url_archivo, url_destino, activo } = req.body;
  db.run(`
    UPDATE publicidades
    SET nombre = ?, tipo = ?, formato = ?, url_archivo = ?, url_destino = ?, activo = ?
    WHERE id = ?
  `, [nombre, tipo, formato, url_archivo, url_destino, activo, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Publicidad actualizada con éxito' });
  });
});

// Eliminar publicidad
app.delete('/api/admin/publicidades/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM publicidades WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Publicidad eliminada con éxito' });
  });
});

// --- API de Configuración de Diseño de Categorías ---

// Actualizar configuración de diseño y límite de una categoría
app.put('/api/admin/categorias/:id', (req, res) => {
  const id = req.params.id;
  const { diseno_home, limite_home } = req.body;
  db.run(`
    UPDATE categorias
    SET diseno_home = ?, limite_home = ?
    WHERE id = ?
  `, [diseno_home, limite_home, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Diseño de categoría actualizado con éxito' });
  });
});

// --- Endpoint de Carga Genérica de Archivos (Imágenes, GIFs, Videos) ---
app.post('/api/admin/subir-archivo', (req, res) => {
  const { archivoBase64 } = req.body;
  if (!archivoBase64) {
    return res.status(400).json({ error: 'No se recibió ningún archivo base64' });
  }

  try {
    const matches = archivoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Formato base64 inválido' });
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    
    // Determinar extensión basándose en el mimeType
    let ext = 'bin';
    if (mimeType.includes('image/webp')) ext = 'webp';
    else if (mimeType.includes('image/gif')) ext = 'gif';
    else if (mimeType.includes('image/jpeg') || mimeType.includes('image/jpg')) ext = 'jpg';
    else if (mimeType.includes('image/png')) ext = 'png';
    else if (mimeType.includes('video/mp4')) ext = 'mp4';
    else if (mimeType.includes('video/webm')) ext = 'webm';
    else if (mimeType.includes('video/ogg')) ext = 'ogv';
    else {
      const parts = mimeType.split('/');
      if (parts.length === 2) {
        ext = parts[1];
      }
    }

    const uniqueName = `file_${Date.now()}_${Math.round(Math.random() * 1000)}.${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    fs.writeFileSync(filePath, buffer);
    const urlPublica = `/uploads/${uniqueName}`;
    res.json({ url: urlPublica });
  } catch (error) {
    console.error('Error al guardar el archivo subido:', error);
    res.status(500).json({ error: error.message });
  }
});

// Levantar el servidor
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

module.exports = app;
