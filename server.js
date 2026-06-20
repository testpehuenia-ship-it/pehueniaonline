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
const parser = new Parser({ timeout: 8000 }); // Tiempo de espera de 8s para evitar que servidores caídos cuelguen la ejecución

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Prevenir almacenamiento en caché de todas las APIs
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

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

// Helper para resolver URLs relativas a absolutas usando URL base
function resolverUrlAbsoluta(urlRelativa, urlPagina) {
  if (!urlRelativa) return '';
  if (urlRelativa.startsWith('http://') || urlRelativa.startsWith('https://')) {
    return urlRelativa;
  }
  if (urlRelativa.startsWith('//')) {
    return 'https:' + urlRelativa;
  }
  try {
    return new URL(urlRelativa, urlPagina).href;
  } catch (e) {
    return urlRelativa;
  }
}

// Helper para optimizar y reducir el peso de imágenes externas usando wsrv.nl (CDN gratuito de compresión y WebP)
function optimizarUrlImagen(url) {
  if (!url) return '';
  // Si es una imagen local (/uploads/) o ya está optimizada con wsrv.nl, no la modificamos
  if (url.startsWith('/uploads/') || url.includes('wsrv.nl')) {
    return url;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Redimensionar a un ancho máximo de 1000px y convertir a WebP con calidad del 80%
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1000&output=webp&q=80`;
  }
  return url;
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

          // Quitar scripts e iframes nocivos del contenido para mantenerlo limpio, y resolver URLs de imágenes relativas
          if (contenidoOriginal) {
            try {
              const $ = cheerio.load(contenidoOriginal);
              $('script').remove();
              $('iframe').remove();
              
              // Resolver y optimizar (convertir a WebP y comprimir) URLs de imágenes relativas dentro del contenido
              $('img').each((i, el) => {
                const src = $(el).attr('src');
                if (src) {
                  const absSrc = resolverUrlAbsoluta(src, item.link || campana.url_feed);
                  $(el).attr('src', optimizarUrlImagen(absSrc));
                }
              });
              
              contenidoOriginal = $.html();
            } catch (cleanErr) {
              console.error('Error al limpiar marcado del contenido:', cleanErr);
            }
          }

          // Resolver y optimizar (convertir a WebP y comprimir) URL de la imagen destacada para que sea absoluta
          if (imagenUrl) {
            imagenUrl = optimizarUrlImagen(resolverUrlAbsoluta(imagenUrl, item.link || campana.url_feed));
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
        const ahora = new Date().toISOString();
        db.run('UPDATE campanas SET ultima_ejecucion = ? WHERE id = ?', [ahora, campana.id], () => {
          reject(error);
        });
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

// Endpoint de Vercel Cron para importación programada de campañas
app.get('/api/cron', async (req, res) => {
  console.log('Ejecutando Cron Job de Importación desde /api/cron...');
  
  db.all('SELECT id, frecuencia_minutos, ultima_ejecucion, estado FROM campanas WHERE estado = \'activa\'', async (err, campanas) => {
    if (err) {
      console.error('Error en cron al consultar campañas:', err.message);
      return res.status(500).json({ error: err.message });
    }

    const ahora = new Date();
    const promesas = [];

    for (const campana of campanas) {
      let necesitaEjecutar = false;

      if (!campana.ultima_ejecucion) {
        necesitaEjecutar = true;
      } else {
        try {
          const ultimaEj = new Date(campana.ultima_ejecucion);
          const diferenciaMinutos = Math.floor((ahora - ultimaEj) / (1000 * 60));
          if (diferenciaMinutos >= (campana.frecuencia_minutos || 60)) {
            necesitaEjecutar = true;
          }
        } catch (e) {
          necesitaEjecutar = true;
        }
      }

      if (necesitaEjecutar) {
        console.log(`Cron programó ejecutar campaña ${campana.id}`);
        promesas.push(
          procesarCampana(campana.id)
            .then(resultado => {
              console.log(`Campaña ${campana.id} completada por Cron.`);
              return { id: campana.id, status: 'completada', resultado };
            })
            .catch(errCamp => {
              console.error(`Error en campaña ${campana.id} por Cron:`, errCamp.message);
              return { id: campana.id, status: 'error', error: errCamp.message };
            })
        );
      }
    }

    const resultados = await Promise.all(promesas);
    res.json({
      mensaje: 'Procesamiento de Cron completado',
      fecha: ahora.toISOString(),
      campanasProcesadas: resultados
    });
  });
});

// ==========================================
// ENDPOINTS DE API REST (FRONTEND Y ADMIN)
// ==========================================

// --- APIs Públicas ---

// Obtener todas las categorías (sincronizando con almacén en la nube para persistencia serverless)
const disenoMap = {
  'grid': 'g',
  'carousel': 'c',
  'list': 'l',
  'featured': 'f',
  'mosaic': 'm',
  'carousel-infinite': 'i',
  'title-overlay': 'o',
  'large-image': 'd'
};

const reverseDisenoMap = {
  'g': 'grid',
  'c': 'carousel',
  'l': 'list',
  'f': 'featured',
  'm': 'mosaic',
  'i': 'carousel-infinite',
  'o': 'title-overlay',
  'd': 'large-image'
};

// Obtener todas las categorías (sincronizando con almacén en la nube para persistencia serverless)
app.get('/api/categorias', (req, res) => {
  db.all('SELECT * FROM categorias', async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    try {
      // Intentar recuperar configuraciones de diseño en la nube (evitando problemas de stateless en Vercel)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
      
      const kvRes = await fetch('https://keyvalue.immanuel.co/api/KeyVal/GetValue/nwoxgbkq/categorias_config', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (kvRes.ok) {
        const text = await kvRes.text();
        if (text) {
          const hexClean = text.replace(/"/g, '').trim();
          if (hexClean) {
            const decodedString = Buffer.from(hexClean, 'hex').toString('utf-8');
            
            let cloudConfig = {};
            let isOldFormat = false;

            if (decodedString.trim().startsWith('{')) {
              try {
                cloudConfig = JSON.parse(decodedString);
                isOldFormat = true;
              } catch (e) {
                console.error('Error parsing old format JSON in GET:', e.message);
              }
            } else {
              // New format: id:disenoShort:limite:posicionShort:orden
              decodedString.split(',').forEach(item => {
                const parts = item.split(':');
                if (parts.length >= 3) {
                  const catId = parseInt(parts[0], 10);
                  const disenoShort = parts[1];
                  const limite = parseInt(parts[2], 10);
                  const posShort = parts[3] || 'i';
                  const ordVal = parseInt(parts[4], 10) || 0;
                  if (!isNaN(catId)) {
                    cloudConfig[catId] = {
                      diseno_home: reverseDisenoMap[disenoShort] || 'grid',
                      limite_home: limite,
                      posicion_home: posShort === 'd' ? 'derecha' : 'izquierda',
                      orden: ordVal
                    };
                  }
                }
              });
            }

            // Mezclar configuraciones de la nube en los registros locales
            rows = rows.map(row => {
              if (isOldFormat) {
                const config = cloudConfig[row.slug] || cloudConfig[row.nombre];
                if (config) {
                  return {
                    ...row,
                    diseno_home: config.diseno_home || row.diseno_home,
                    limite_home: config.limite_home || row.limite_home,
                    posicion_home: config.posicion_home || row.posicion_home || 'izquierda',
                    orden: config.orden !== undefined ? config.orden : (row.orden || 0)
                  };
                }
              } else {
                const config = cloudConfig[row.id];
                if (config) {
                  return {
                    ...row,
                    diseno_home: config.diseno_home || row.diseno_home,
                    limite_home: config.limite_home || row.limite_home,
                    posicion_home: config.posicion_home || row.posicion_home || 'izquierda',
                    orden: config.orden !== undefined ? config.orden : (row.orden || 0)
                  };
                }
              }
              return row;
            });
          }
        }
      }
    } catch (e) {
      console.error('Error al sincronizar categorías con la nube:', e.message);
    }

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

// Asegurar que exista la carpeta public/uploads (silenciar errores en entornos de solo lectura como Vercel)
const uploadsDir = path.join(__dirname, 'public', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn('Advertencia: No se pudo crear la carpeta public/uploads (esperable en Vercel):', err.message);
}

// Endpoint para subir imagen (base64 WebP)
app.post('/api/admin/subir-imagen', async (req, res) => {
  const { imagenBase64 } = req.body;
  if (!imagenBase64) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen base64' });
  }

  try {
    // Limpiar el prefijo data:image/...;base64,
    const matches = imagenBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Formato base64 inválido' });
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    // Determinar extensión basándose en el mimeType
    let ext = 'webp';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('gif')) ext = 'gif';

    // SI ESTAMOS EN VERCEL O PRODUCCIÓN: Subir a Catbox para evitar limitaciones de solo lectura y temporalidad
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      try {
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        
        const fileBlob = new Blob([buffer], { type: mimeType });
        formData.append('fileToUpload', fileBlob, `upload_${Date.now()}.${ext}`);

        const uploadRes = await fetch('https://catbox.moe/user/api.php', {
          method: 'POST',
          body: formData
        });

        if (!uploadRes.ok) {
          throw new Error(`Catbox retornó estado ${uploadRes.status}: ${uploadRes.statusText}`);
        }

        const fileUrl = await uploadRes.text();
        if (fileUrl && fileUrl.startsWith('http')) {
          return res.json({ url: fileUrl.trim() });
        } else {
          throw new Error(`Respuesta inválida de Catbox: ${fileUrl}`);
        }
      } catch (uploadError) {
        console.error('Error al subir imagen a Catbox:', uploadError.message);
        return res.status(502).json({ error: `La subida externa falló: ${uploadError.message}` });
      }
    }

    // DESARROLLO LOCAL o FALLBACK: Guardar en el sistema de archivos local
    const uniqueName = `img_${Date.now()}_${Math.round(Math.random() * 1000)}.${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    if (!fs.existsSync(uploadsDir)) {
      try {
        fs.mkdirSync(uploadsDir, { recursive: true });
      } catch (err) {
        console.warn('No se pudo crear carpeta de uploads para fallback:', err.message);
      }
    }

    fs.writeFileSync(filePath, buffer);
    const urlPublica = `/uploads/${uniqueName}`;
    res.json({ url: urlPublica });
  } catch (error) {
    console.error('Error al guardar la imagen subida:', error);
    res.status(500).json({ error: error.message });
  }
});


// --- APIs de Publicidades ---

// Funciones auxiliares para sincronización de publicidades en la nube
async function savePublicidadesToCloud(ads) {
  try {
    const val = Buffer.from(JSON.stringify(ads)).toString('hex');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
    await fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/nwoxgbkq/publicidades_config/${val}`, {
      method: 'POST',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
  } catch (e) {
    console.error('Error al guardar publicidades en la nube:', e.message);
  }
}

async function getPublicidadesFromCloud(sqliteRows) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
    const kvRes = await fetch('https://keyvalue.immanuel.co/api/KeyVal/GetValue/nwoxgbkq/publicidades_config', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (kvRes.ok) {
      const text = await kvRes.text();
      if (text) {
        const hexClean = text.replace(/"/g, '').trim();
        if (hexClean) {
          const decodedString = Buffer.from(hexClean, 'hex').toString('utf-8');
          return JSON.parse(decodedString);
        }
      }
    }
  } catch (e) {
    console.error('Error al recuperar publicidades desde la nube:', e.message);
  }
  return sqliteRows;
}

// Obtener publicidades activas (público)
app.get('/api/publicidades', (req, res) => {
  db.all('SELECT * FROM publicidades WHERE activo = 1', async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const cloudRows = await getPublicidadesFromCloud(rows);
    const activeCloudRows = cloudRows.filter(r => r.activo === 1);
    res.json(activeCloudRows);
  });
});

// Obtener todas las publicidades (admin)
app.get('/api/admin/publicidades', (req, res) => {
  db.all('SELECT * FROM publicidades ORDER BY id DESC', async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const cloudRows = await getPublicidadesFromCloud(rows);
    res.json(cloudRows);
  });
});

// Crear publicidad
app.post('/api/admin/publicidades', (req, res) => {
  const { nombre, tipo, formato, url_archivo, url_destino, activo } = req.body;
  
  db.all('SELECT * FROM publicidades ORDER BY id DESC', async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    let currentAds = await getPublicidadesFromCloud(rows);
    const newId = currentAds.length > 0 ? Math.max(...currentAds.map(a => a.id)) + 1 : 1;
    
    const newAd = {
      id: newId,
      nombre,
      tipo,
      formato,
      url_archivo,
      url_destino,
      activo: parseInt(activo, 10) || 0
    };
    
    currentAds.unshift(newAd); // Agregar al inicio
    
    // Guardar en la nube
    await savePublicidadesToCloud(currentAds);
    
    // Guardar localmente
    db.run(`
      INSERT INTO publicidades (id, nombre, tipo, formato, url_archivo, url_destino, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [newId, nombre, tipo, formato, url_archivo, url_destino, activo], function(dbErr) {
      res.json({ id: newId, message: 'Publicidad creada con éxito' });
    });
  });
});

// Actualizar publicidad
app.put('/api/admin/publicidades/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { nombre, tipo, formato, url_archivo, url_destino, activo } = req.body;
  
  db.all('SELECT * FROM publicidades ORDER BY id DESC', async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    let currentAds = await getPublicidadesFromCloud(rows);
    
    let adIndex = currentAds.findIndex(a => a.id === id);
    if (adIndex !== -1) {
      currentAds[adIndex] = {
        id,
        nombre,
        tipo,
        formato,
        url_archivo,
        url_destino,
        activo: parseInt(activo, 10) || 0
      };
    } else {
      currentAds.unshift({
        id,
        nombre,
        tipo,
        formato,
        url_archivo,
        url_destino,
        activo: parseInt(activo, 10) || 0
      });
    }
    
    // Guardar en la nube
    await savePublicidadesToCloud(currentAds);
    
    // Actualizar localmente
    db.run(`
      UPDATE publicidades
      SET nombre = ?, tipo = ?, formato = ?, url_archivo = ?, url_destino = ?, activo = ?
      WHERE id = ?
    `, [nombre, tipo, formato, url_archivo, url_destino, activo, id], (dbErr) => {
      res.json({ message: 'Publicidad actualizada con éxito' });
    });
  });
});

// Eliminar publicidad
app.delete('/api/admin/publicidades/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  
  db.all('SELECT * FROM publicidades ORDER BY id DESC', async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    let currentAds = await getPublicidadesFromCloud(rows);
    currentAds = currentAds.filter(a => a.id !== id);
    
    // Guardar en la nube
    await savePublicidadesToCloud(currentAds);
    
    // Borrar localmente
    db.run('DELETE FROM publicidades WHERE id = ?', [id], (dbErr) => {
      res.json({ message: 'Publicidad eliminada con éxito' });
    });
  });
});

// --- API de Configuración de Diseño de Categorías ---

// Actualizar configuración de diseño y límite de una categoría (guardando en SQLite y sincronizando con la nube)
app.put('/api/admin/categorias/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { diseno_home, limite_home, posicion_home, orden } = req.body;
  
  db.all('SELECT * FROM categorias', async (err, categoriasList) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const categoryRow = categoriasList.find(c => c.id === id);
    if (!categoryRow) return res.status(404).json({ error: 'Categoría no encontrada' });

    const slug = categoryRow.slug;

    // 1. Obtener la config actual de la nube
    let cloudConfig = {};
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const kvRes = await fetch('https://keyvalue.immanuel.co/api/KeyVal/GetValue/nwoxgbkq/categorias_config', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (kvRes.ok) {
        const text = await kvRes.text();
        if (text) {
          const hexClean = text.replace(/"/g, '').trim();
          if (hexClean) {
            const decodedString = Buffer.from(hexClean, 'hex').toString('utf-8');
            if (decodedString.trim().startsWith('{')) {
              try {
                const oldConfig = JSON.parse(decodedString);
                categoriasList.forEach(cat => {
                  const config = oldConfig[cat.slug] || oldConfig[cat.nombre];
                  if (config) {
                    cloudConfig[cat.id] = {
                      diseno_home: config.diseno_home || cat.diseno_home,
                      limite_home: config.limite_home || cat.limite_home,
                      posicion_home: config.posicion_home || cat.posicion_home || 'izquierda',
                      orden: config.orden !== undefined ? config.orden : (cat.orden || 0)
                    };
                  }
                });
              } catch (e) {
                console.error('Error parsing old format JSON in PUT:', e.message);
              }
            } else {
              // New format: id:disenoShort:limite:posicionShort:orden
              decodedString.split(',').forEach(item => {
                const parts = item.split(':');
                if (parts.length >= 3) {
                  const catId = parseInt(parts[0], 10);
                  const disenoShort = parts[1];
                  const limite = parseInt(parts[2], 10);
                  const posShort = parts[3] || 'i';
                  const ordVal = parseInt(parts[4], 10) || 0;
                  if (!isNaN(catId)) {
                    cloudConfig[catId] = {
                      diseno_home: reverseDisenoMap[disenoShort] || 'grid',
                      limite_home: limite,
                      posicion_home: posShort === 'd' ? 'derecha' : 'izquierda',
                      orden: ordVal
                    };
                  }
                }
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Error al recuperar config actual de la nube:', e.message);
    }

    // 2. Modificar solo la categoría que estamos actualizando
    cloudConfig[id] = {
      diseno_home,
      limite_home: parseInt(limite_home, 10) || 3,
      posicion_home: posicion_home || 'izquierda',
      orden: parseInt(orden, 10) || 0
    };

    // 3. Serializar en la nueva estructura compacta
    const serializedParts = [];
    for (const catId of Object.keys(cloudConfig)) {
      const config = cloudConfig[catId];
      const disenoShort = disenoMap[config.diseno_home] || 'g';
      const posShort = config.posicion_home === 'derecha' ? 'd' : 'i';
      const ordVal = config.orden || 0;
      serializedParts.push(`${catId}:${disenoShort}:${config.limite_home}:${posShort}:${ordVal}`);
    }
    const serializedString = serializedParts.join(',');

    // 4. Guardar de vuelta en la nube
    try {
      const val = Buffer.from(serializedString).toString('hex');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/nwoxgbkq/categorias_config/${val}`, {
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (e) {
      console.error('Error al guardar configuración en la nube:', e.message);
    }

    // 5. Guardar en la base de datos local / nube Turso
    db.run(`
      UPDATE categorias
      SET diseno_home = ?, limite_home = ?, posicion_home = ?, orden = ?
      WHERE id = ?
    `, [diseno_home, parseInt(limite_home, 10) || 3, posicion_home || 'izquierda', parseInt(orden, 10) || 0, id], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }
      res.json({ message: 'Diseño de categoría actualizado con éxito' });
    });
  });
});

// Endpoint bulk para actualizar configuraciones de categorías en lote (bulk)
app.put('/api/admin/categorias-bulk', (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'Payload must be an array of category updates.' });
  }

  db.all('SELECT * FROM categorias', async (err, categoriasList) => {
    if (err) return res.status(500).json({ error: err.message });

    let cloudConfig = {};
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const kvRes = await fetch('https://keyvalue.immanuel.co/api/KeyVal/GetValue/nwoxgbkq/categorias_config', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (kvRes.ok) {
        const text = await kvRes.text();
        if (text) {
          const hexClean = text.replace(/"/g, '').trim();
          if (hexClean) {
            const decodedString = Buffer.from(hexClean, 'hex').toString('utf-8');
            if (decodedString.trim().startsWith('{')) {
              try {
                const oldConfig = JSON.parse(decodedString);
                categoriasList.forEach(cat => {
                  const config = oldConfig[cat.slug] || oldConfig[cat.nombre];
                  if (config) {
                    cloudConfig[cat.id] = {
                      diseno_home: config.diseno_home || cat.diseno_home,
                      limite_home: config.limite_home || cat.limite_home,
                      posicion_home: config.posicion_home || cat.posicion_home || 'izquierda',
                      orden: config.orden !== undefined ? config.orden : (cat.orden || 0)
                    };
                  }
                });
              } catch (e) {
                console.error('Error parsing old format JSON in GET:', e.message);
              }
            } else {
              decodedString.split(',').forEach(item => {
                const parts = item.split(':');
                if (parts.length >= 3) {
                  const catId = parseInt(parts[0], 10);
                  const disenoShort = parts[1];
                  const limite = parseInt(parts[2], 10);
                  const posShort = parts[3] || 'i';
                  const ordVal = parseInt(parts[4], 10) || 0;
                  if (!isNaN(catId)) {
                    cloudConfig[catId] = {
                      diseno_home: reverseDisenoMap[disenoShort] || 'grid',
                      limite_home: limite,
                      posicion_home: posShort === 'd' ? 'derecha' : 'izquierda',
                      orden: ordVal
                    };
                  }
                }
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Error al recuperar config actual de la nube en bulk:', e.message);
    }

    updates.forEach(u => {
      const catId = parseInt(u.id, 10);
      const dbRow = categoriasList.find(c => c.id === catId);
      if (dbRow) {
        if (!cloudConfig[catId]) {
          cloudConfig[catId] = {
            diseno_home: dbRow.diseno_home || 'grid',
            limite_home: dbRow.limite_home || 3,
            posicion_home: dbRow.posicion_home || 'izquierda',
            orden: dbRow.orden || 0
          };
        }
        if (u.diseno_home !== undefined) cloudConfig[catId].diseno_home = u.diseno_home;
        if (u.limite_home !== undefined) cloudConfig[catId].limite_home = parseInt(u.limite_home, 10) || 3;
        if (u.posicion_home !== undefined) cloudConfig[catId].posicion_home = u.posicion_home;
        if (u.orden !== undefined) cloudConfig[catId].orden = parseInt(u.orden, 10) || 0;
      }
    });

    const serializedParts = [];
    for (const catId of Object.keys(cloudConfig)) {
      const config = cloudConfig[catId];
      const disenoShort = disenoMap[config.diseno_home] || 'g';
      const posShort = config.posicion_home === 'derecha' ? 'd' : 'i';
      const ordVal = config.orden || 0;
      serializedParts.push(`${catId}:${disenoShort}:${config.limite_home}:${posShort}:${ordVal}`);
    }
    const serializedString = serializedParts.join(',');

    try {
      const val = Buffer.from(serializedString).toString('hex');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/nwoxgbkq/categorias_config/${val}`, {
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (e) {
      console.error('Error al guardar en bulk en la nube:', e.message);
    }

    if (updates.length === 0) {
      return res.json({ message: 'No hay categorías para actualizar' });
    }

    let updateCount = 0;
    let hasError = false;
    let errMsg = '';

    updates.forEach(u => {
      const catId = parseInt(u.id, 10);
      const dbRow = categoriasList.find(c => c.id === catId);
      if (dbRow) {
        const diseno = u.diseno_home !== undefined ? u.diseno_home : (dbRow.diseno_home || 'grid');
        const limite = u.limite_home !== undefined ? parseInt(u.limite_home, 10) || 3 : (dbRow.limite_home || 3);
        const posicion = u.posicion_home !== undefined ? u.posicion_home : (dbRow.posicion_home || 'izquierda');
        const orden = u.orden !== undefined ? parseInt(u.orden, 10) || 0 : (dbRow.orden || 0);

        db.run(`
          UPDATE categorias
          SET diseno_home = ?, limite_home = ?, posicion_home = ?, orden = ?
          WHERE id = ?
        `, [diseno, limite, posicion, orden, catId], (updateErr) => {
          updateCount++;
          if (updateErr) {
            hasError = true;
            errMsg = updateErr.message;
          }
          if (updateCount === updates.length) {
            if (hasError) {
              return res.status(500).json({ error: errMsg });
            }
            res.json({ message: 'Categorías actualizadas en lote correctamente' });
          }
        });
      } else {
        updateCount++;
        if (updateCount === updates.length) {
          if (hasError) {
            return res.status(500).json({ error: errMsg });
          }
          res.json({ message: 'Categorías actualizadas en lote correctamente' });
        }
      }
    });
  });
});


// --- Endpoint de Carga Genérica de Archivos (Imágenes, GIFs, Videos) ---
app.post('/api/admin/subir-archivo', async (req, res) => {
  const { archivoBase64 } = req.body;
  if (!archivoBase64) {
    return res.status(400).json({ error: 'No se recibió ningún archivo base64' });
  }

  try {
    const matches = archivoBase64.match(/^data:([^;]+);base64,(.+)$/);
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

    // SI ESTAMOS EN VERCEL O PRODUCCIÓN: Subir a Catbox para evitar limitaciones de solo lectura y temporalidad
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      try {
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        
        const fileBlob = new Blob([buffer], { type: mimeType });
        formData.append('fileToUpload', fileBlob, `upload_${Date.now()}.${ext}`);

        const uploadRes = await fetch('https://catbox.moe/user/api.php', {
          method: 'POST',
          body: formData
        });

        if (!uploadRes.ok) {
          throw new Error(`Catbox retornó estado ${uploadRes.status}: ${uploadRes.statusText}`);
        }

        const fileUrl = await uploadRes.text();
        if (fileUrl && fileUrl.startsWith('http')) {
          return res.json({ url: fileUrl.trim() });
        } else {
          throw new Error(`Respuesta inválida de Catbox: ${fileUrl}`);
        }
      } catch (uploadError) {
        console.error('Error al subir archivo a Catbox:', uploadError.message);
        return res.status(502).json({ error: `La subida externa falló: ${uploadError.message}` });
      }
    }

    // DESARROLLO LOCAL o FALLBACK: Guardar en el sistema de archivos local
    const uniqueName = `file_${Date.now()}_${Math.round(Math.random() * 1000)}.${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    if (!fs.existsSync(uploadsDir)) {
      try {
        fs.mkdirSync(uploadsDir, { recursive: true });
      } catch (err) {
        console.warn('No se pudo crear carpeta de uploads para fallback:', err.message);
      }
    }

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
