// Lógica del Panel de Administración Principal - Pehuenia Online

document.addEventListener('DOMContentLoaded', () => {
  // Estado
  let categorias = [];
  let appConfigs = {};
  let todasLasNoticias = [];
  let noticiasFiltros = {
    categoria: '',
    estado: '',
    fecha: ''
  };
  let noticiasOrden = {
    columna: 'fecha',
    direccion: 'desc'
  };

  // Elementos
  const el = {
    statHoy: document.getElementById('stat-hoy'),
    statBorradores: document.getElementById('stat-borradores'),
    statVisitas: document.getElementById('stat-visitas'),
    
    analyticsDot: document.getElementById('analytics-status-dot'),
    analyticsText: document.getElementById('analytics-status-text'),
    analyticsDisplay: document.getElementById('analytics-id-display'),
    
    noticiasTableBody: document.getElementById('noticias-table-body'),
    
    btnNuevaNoticia: document.getElementById('btn-nueva-noticia'),
    btnNuevaNoticiaQuick: document.getElementById('btn-nueva-noticia-quick'),
    btnGuardarNoticia: document.getElementById('btn-guardar-noticia'),
    
    btnConfigAnalytics: document.getElementById('btn-config-analytics'),
    btnGuardarConfig: document.getElementById('btn-guardar-configuraciones'),
    
    // Inputs Form Noticias
    formNoticia: document.getElementById('form-noticia'),
    noticiaId: document.getElementById('noticia-id'),
    noticiaTitulo: document.getElementById('noticia-titulo'),
    noticiaCopete: document.getElementById('noticia-copete'),
    noticiaCategoria: document.getElementById('noticia-categoria'),
    noticiaImagen: document.getElementById('noticia-imagen'),
    noticiaArchivos: document.getElementById('noticia-archivos'),
    previsualizacionImagenes: document.getElementById('previsualizacion-imagenes'),
    noticiaAutor: document.getElementById('noticia-autor'),
    noticiaContenido: document.getElementById('noticia-contenido'),
    noticiaEstado: document.getElementById('noticia-estado'),
    
    // Inputs Form Config
    formConfig: document.getElementById('form-configuraciones'),
    configGeminiKey: document.getElementById('config-gemini-key'),
    configAnalyticsId: document.getElementById('config-analytics-id'),
    configNombreDiario: document.getElementById('config-nombre-diario'),
    configClimaCiudad: document.getElementById('config-clima-ciudad'),
    configCloudinaryName: document.getElementById('config-cloudinary-cloud-name'),
    configCloudinaryPreset: document.getElementById('config-cloudinary-upload-preset'),
    
    // Tabs de Navegación
    tabInicio: document.getElementById('menu-inicio'),
    tabNoticias: document.getElementById('menu-noticias'),
    tabPublicidad: document.getElementById('menu-publicidad'),
    tabCategorias: document.getElementById('menu-categorias'),
    tabConfig: document.getElementById('menu-config'),
    
    sections: {
      inicio: document.getElementById('section-inicio'),
      noticias: document.getElementById('section-noticias'),
      publicidad: document.getElementById('section-publicidad'),
      categorias: document.getElementById('section-categorias')
    },

    // Publicidad elements
    pubTableBody: document.getElementById('publicidad-table-body'),
    btnNuevaPublicidad: document.getElementById('btn-nueva-publicidad'),
    btnGuardarPublicidad: document.getElementById('btn-guardar-publicidad'),
    formPublicidad: document.getElementById('form-publicidad'),
    pubId: document.getElementById('pub-id'),
    pubNombre: document.getElementById('pub-nombre'),
    pubTipo: document.getElementById('pub-tipo'),
    pubFormato: document.getElementById('pub-formato'),
    pubArchivoInput: document.getElementById('pub-archivo-input'),
    pubUrlArchivo: document.getElementById('pub-url-archivo'),
    pubUrlDestino: document.getElementById('pub-url-destino'),
    pubActivo: document.getElementById('pub-activo'),
    previsualizacionPub: document.getElementById('previsualizacion-pub'),

    // Categorías Config elements
    categoriasIzquierdaTableBody: document.getElementById('categorias-izquierda-table-body'),
    categoriasDerechaTableBody: document.getElementById('categorias-derecha-table-body'),
    btnGuardarCategoriaConfig: document.getElementById('btn-guardar-categoria-config'),
    formCategoriaConfig: document.getElementById('form-categoria-config'),
    catConfigId: document.getElementById('cat-config-id'),
    catConfigNombre: document.getElementById('cat-config-nombre'),
    catConfigDiseno: document.getElementById('cat-config-diseno'),
    catConfigLimite: document.getElementById('cat-config-limite'),
    catConfigPosicion: document.getElementById('cat-config-posicion'),
    catConfigOrden: document.getElementById('cat-config-orden'),

    // Filtros de Noticias elements
    filtroNoticiaCategoria: document.getElementById('filtro-noticia-categoria'),
    filtroNoticiaEstado: document.getElementById('filtro-noticia-estado'),
    filtroNoticiaFecha: document.getElementById('filtro-noticia-fecha'),
    btnLimpiarFiltros: document.getElementById('btn-limpiar-filtros'),
    headerNoticiaCategoria: document.getElementById('header-noticia-categoria'),
    headerNoticiaFecha: document.getElementById('header-noticia-fecha')
  };

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  async function init() {
    setupEventListeners();
    await fetchCategorias();
    
    // Manejar tab activa por URL query
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    if (tabParam === 'noticias') {
      switchTab('noticias');
    } else if (tabParam === 'publicidad') {
      switchTab('publicidad');
    } else if (tabParam === 'categorias') {
      switchTab('categorias');
    } else if (tabParam === 'config') {
      switchTab('inicio');
      abrirModal('modal-configuraciones');
    } else {
      switchTab('inicio');
    }
  }

  // ==========================================
  // NAVEGACIÓN Y TABS
  // ==========================================

  function setupEventListeners() {
    el.tabInicio.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('inicio');
    });
    el.tabNoticias.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('noticias');
    });
    el.tabPublicidad.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('publicidad');
    });
    el.tabCategorias.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('categorias');
    });
    el.tabConfig.addEventListener('click', (e) => {
      e.preventDefault();
      abrirModal('modal-configuraciones');
    });

    el.btnConfigAnalytics.addEventListener('click', () => {
      abrirModal('modal-configuraciones');
      el.configAnalyticsId.focus();
    });

    // Modales de noticias
    el.btnNuevaNoticia.addEventListener('click', () => abrirModalNoticia());
    el.btnNuevaNoticiaQuick.addEventListener('click', () => abrirModalNoticia());
    el.formNoticia.addEventListener('submit', guardarNoticia);
    el.formConfig.addEventListener('submit', guardarConfiguraciones);
    el.noticiaArchivos.addEventListener('change', manejarSubidaImagenes);

    // Publicidad
    el.btnNuevaPublicidad.addEventListener('click', () => abrirModalPublicidad());
    el.formPublicidad.addEventListener('submit', guardarPublicidad);
    el.pubArchivoInput.addEventListener('change', manejarSubidaPublicidad);
    el.pubUrlArchivo.addEventListener('input', () => {
      actualizarPrevisualizacionPub(el.pubUrlArchivo.value, el.pubFormato.value);
    });
    el.pubFormato.addEventListener('change', () => {
      actualizarPrevisualizacionPub(el.pubUrlArchivo.value, el.pubFormato.value);
    });

    // Categorías Config
    el.formCategoriaConfig.addEventListener('submit', guardarCategoriaConfig);

    // Eventos de Filtrado de Noticias
    if (el.filtroNoticiaCategoria) {
      el.filtroNoticiaCategoria.addEventListener('change', (e) => {
        noticiasFiltros.categoria = e.target.value;
        renderNoticiasFiltradasYOrdenadas();
      });
    }
    if (el.filtroNoticiaEstado) {
      el.filtroNoticiaEstado.addEventListener('change', (e) => {
        noticiasFiltros.estado = e.target.value;
        renderNoticiasFiltradasYOrdenadas();
      });
    }
    if (el.filtroNoticiaFecha) {
      el.filtroNoticiaFecha.addEventListener('input', (e) => {
        noticiasFiltros.fecha = e.target.value;
        renderNoticiasFiltradasYOrdenadas();
      });
    }
    if (el.btnLimpiarFiltros) {
      el.btnLimpiarFiltros.addEventListener('click', () => {
        if (el.filtroNoticiaCategoria) el.filtroNoticiaCategoria.value = '';
        if (el.filtroNoticiaEstado) el.filtroNoticiaEstado.value = '';
        if (el.filtroNoticiaFecha) el.filtroNoticiaFecha.value = '';
        noticiasFiltros.categoria = '';
        noticiasFiltros.estado = '';
        noticiasFiltros.fecha = '';
        renderNoticiasFiltradasYOrdenadas();
      });
    }

    // Eventos de Ordenación de Noticias
    if (el.headerNoticiaCategoria) {
      el.headerNoticiaCategoria.addEventListener('click', () => {
        if (noticiasOrden.columna === 'categoria') {
          noticiasOrden.direccion = noticiasOrden.direccion === 'asc' ? 'desc' : 'asc';
        } else {
          noticiasOrden.columna = 'categoria';
          noticiasOrden.direccion = 'asc';
        }
        actualizarIconosOrdenNoticias();
        renderNoticiasFiltradasYOrdenadas();
      });
    }
    if (el.headerNoticiaFecha) {
      el.headerNoticiaFecha.addEventListener('click', () => {
        if (noticiasOrden.columna === 'fecha') {
          noticiasOrden.direccion = noticiasOrden.direccion === 'asc' ? 'desc' : 'asc';
        } else {
          noticiasOrden.columna = 'fecha';
          noticiasOrden.direccion = 'desc';
        }
        actualizarIconosOrdenNoticias();
        renderNoticiasFiltradasYOrdenadas();
      });
    }
  }

  function switchTab(tabName) {
    // Clases del menú
    el.tabInicio.classList.remove('active');
    el.tabNoticias.classList.remove('active');
    el.tabPublicidad.classList.remove('active');
    el.tabCategorias.classList.remove('active');
    
    // Ocultar todas las secciones
    Object.keys(el.sections).forEach(key => {
      el.sections[key].style.display = 'none';
    });

    if (tabName === 'inicio') {
      el.tabInicio.classList.add('active');
      el.sections.inicio.style.display = 'block';
      document.getElementById('page-title').textContent = 'Panel de Control';
      fetchDashboardStats();
    } else if (tabName === 'noticias') {
      el.tabNoticias.classList.add('active');
      el.sections.noticias.style.display = 'block';
      document.getElementById('page-title').textContent = 'Gestión de Noticias';
      fetchNoticiasList();
    } else if (tabName === 'publicidad') {
      el.tabPublicidad.classList.add('active');
      el.sections.publicidad.style.display = 'block';
      document.getElementById('page-title').textContent = 'Gestión de Anuncios Publicitarios';
      fetchPublicidadesList();
    } else if (tabName === 'categorias') {
      el.tabCategorias.classList.add('active');
      el.sections.categorias.style.display = 'block';
      document.getElementById('page-title').textContent = 'Diseño de Portada por Categoría';
      fetchCategoriasConfigList();
    }
  }

  // ==========================================
  // CARGA DE CONFIGURACIÓN Y ESTADÍSTICAS
  // ==========================================

  async function fetchDashboardStats() {
    try {
      const res = await fetch('/api/admin/estadisticas?_t=' + Date.now());
      const stats = await res.json();
      
      el.statHoy.textContent = stats.noticiasHoy;
      el.statBorradores.textContent = stats.borradores;
      el.statVisitas.textContent = stats.lecturasTotales.toLocaleString('es-AR');
    } catch (e) {
      console.error('Error al cargar estadísticas');
    }

    // Config de Analytics
    try {
      const res = await fetch('/api/admin/configuraciones?_t=' + Date.now());
      const configs = await res.json();
      
      el.configGeminiKey.value = configs.gemini_api_key || '';
      el.configAnalyticsId.value = configs.analytics_id || '';
      el.configNombreDiario.value = configs.nombre_diario || 'PEHUENIA ONLINE';
      el.configClimaCiudad.value = configs.clima_ciudad || 'Villa Pehuenia';
      
      appConfigs = configs;
      el.configCloudinaryName.value = configs.cloudinary_cloud_name || '';
      el.configCloudinaryPreset.value = configs.cloudinary_upload_preset || '';

      if (configs.analytics_id) {
        el.analyticsDot.className = 'status-dot connected';
        el.analyticsText.textContent = 'Conectado';
        el.analyticsDisplay.textContent = `Google Analytics activo (ID: ${configs.analytics_id})`;
      } else {
        el.analyticsDot.className = 'status-dot';
        el.analyticsText.textContent = 'Sin conectar';
        el.analyticsDisplay.textContent = 'Agrega tu ID de Analytics para ver estadísticas reales';
      }
    } catch (e) {
      console.error('Error al cargar configuraciones');
    }
  }

  async function fetchCategorias() {
    try {
      const res = await fetch('/api/categorias?_t=' + Date.now());
      categorias = await res.json();
      
      el.noticiaCategoria.innerHTML = '';
      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        el.noticiaCategoria.appendChild(option);
      });

      if (el.filtroNoticiaCategoria) {
        el.filtroNoticiaCategoria.innerHTML = '<option value="">Todas las Categorías</option>';
        categorias.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.nombre;
          el.filtroNoticiaCategoria.appendChild(option);
        });
      }
    } catch (e) {
      console.error('Error al cargar categorías');
    }
  }

  // Guardar configuración general
  async function guardarConfiguraciones(e) {
    e.preventDefault();
    const payload = {
      gemini_api_key: el.configGeminiKey.value.trim(),
      analytics_id: el.configAnalyticsId.value.trim(),
      nombre_diario: el.configNombreDiario.value.trim(),
      clima_ciudad: el.configClimaCiudad.value.trim(),
      cloudinary_cloud_name: el.configCloudinaryName.value.trim(),
      cloudinary_upload_preset: el.configCloudinaryPreset.value.trim()
    };

    try {
      const res = await fetch('/api/admin/configuraciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        appConfigs = payload;
        alert('Configuraciones guardadas correctamente.');
        cerrarModal('modal-configuraciones');
        fetchDashboardStats();
      } else {
        alert('Error al guardar las configuraciones.');
      }
    } catch (err) {
      console.error(err);
      alert('Error en el servidor.');
    }
  }

  // ==========================================
  // GESTIÓN DE NOTICIAS (CRUD)
  // ==========================================

  async function fetchNoticiasList() {
    try {
      const res = await fetch('/api/admin/noticias?_t=' + Date.now());
      todasLasNoticias = await res.json();
      renderNoticiasFiltradasYOrdenadas();
    } catch (e) {
      el.noticiasTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--color-danger)">Error al cargar noticias.</td></tr>';
    }
  }

  function actualizarIconosOrdenNoticias() {
    const iconCat = el.headerNoticiaCategoria.querySelector('i');
    const iconFecha = el.headerNoticiaFecha.querySelector('i');
    
    iconCat.className = 'fa-solid fa-sort';
    iconFecha.className = 'fa-solid fa-sort';
    
    if (noticiasOrden.columna === 'categoria') {
      if (noticiasOrden.direccion === 'asc') {
        iconCat.className = 'fa-solid fa-sort-up';
      } else {
        iconCat.className = 'fa-solid fa-sort-down';
      }
    } else if (noticiasOrden.columna === 'fecha') {
      if (noticiasOrden.direccion === 'asc') {
        iconFecha.className = 'fa-solid fa-sort-up';
      } else {
        iconFecha.className = 'fa-solid fa-sort-down';
      }
    }
  }

  function renderNoticiasFiltradasYOrdenadas() {
    let filtradas = [...todasLasNoticias];
    
    // Filtrar por categoría
    if (noticiasFiltros.categoria) {
      filtradas = filtradas.filter(n => String(n.categoria_id) === String(noticiasFiltros.categoria));
    }
    
    // Filtrar por estado
    if (noticiasFiltros.estado) {
      filtradas = filtradas.filter(n => n.estado === noticiasFiltros.estado);
    }
    
    // Filtrar por fecha (YYYY-MM-DD)
    if (noticiasFiltros.fecha) {
      const filtroFechaStr = noticiasFiltros.fecha;
      filtradas = filtradas.filter(n => {
        if (!n.fecha) return false;
        return n.fecha.substring(0, 10) === filtroFechaStr;
      });
    }
    
    // Ordenar
    filtradas.sort((a, b) => {
      let valorA, valorB;
      
      if (noticiasOrden.columna === 'categoria') {
        valorA = (a.categoria_nombre || '').toLowerCase();
        valorB = (b.categoria_nombre || '').toLowerCase();
      } else {
        // Por defecto fecha
        valorA = a.fecha ? new Date(a.fecha).getTime() : 0;
        valorB = b.fecha ? new Date(b.fecha).getTime() : 0;
      }
      
      if (valorA < valorB) {
        return noticiasOrden.direccion === 'asc' ? -1 : 1;
      }
      if (valorA > valorB) {
        return noticiasOrden.direccion === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    // Renderizar
    el.noticiasTableBody.innerHTML = '';
    if (filtradas.length === 0) {
      el.noticiasTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center">No se encontraron noticias que coincidan con los filtros.</td></tr>';
      return;
    }
    
    filtradas.forEach(n => {
      const tr = document.createElement('tr');
      const fecha = new Date(n.fecha).toLocaleDateString('es-AR', { hour: '2-digit', minute: '2-digit' });
      
      const badgeClass = n.estado === 'publicado' ? 'badge-published' : 'badge-draft';
      const badgeLabel = n.estado === 'publicado' ? 'Publicado' : 'Borrador';

      tr.innerHTML = `
        <td style="font-weight:600">
          <a href="../#/noticia/${n.id}" target="_blank" style="color: var(--color-primary, #0f4c81); text-decoration: none; cursor: pointer;">
            ${n.titulo}
          </a>
        </td>
        <td>${n.categoria_nombre}</td>
        <td>${fecha}</td>
        <td><i class="fa-regular fa-eye"></i> ${n.visitas}</td>
        <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
        <td>
          <button class="btn btn-outline btn-editar" style="padding:4px 8px; font-size:0.75rem;"><i class="fa-regular fa-pen-to-square"></i></button>
          <button class="btn btn-danger btn-eliminar" style="padding:4px 8px; font-size:0.75rem;"><i class="fa-regular fa-trash-can"></i></button>
        </td>
      `;

      tr.querySelector('.btn-editar').addEventListener('click', () => abrirModalNoticia(n));
      tr.querySelector('.btn-eliminar').addEventListener('click', () => eliminarNoticia(n.id));

      el.noticiasTableBody.appendChild(tr);
    });
  }

  function abrirModalNoticia(noticia = null) {
    el.formNoticia.reset();
    
    if (noticia) {
      el.modalNoticiaTitle.textContent = 'Editar Noticia';
      el.noticiaId.value = noticia.id;
      el.noticiaTitulo.value = noticia.titulo;
      el.noticiaCopete.value = noticia.copete || '';
      el.noticiaCategoria.value = noticia.categoria_id;
      el.noticiaImagen.value = noticia.imagen_url || '';
      el.noticiaAutor.value = noticia.autor || 'Redacción Pehuenia Online';
      el.noticiaContenido.value = noticia.contenido;
      el.noticiaEstado.value = noticia.estado;
    } else {
      el.modalNoticiaTitle.textContent = 'Redactar Nueva Noticia';
      el.noticiaId.value = '';
      el.noticiaAutor.value = 'Redacción Pehuenia Online';
    }
    
    abrirModal('modal-noticia');
  }

  async function guardarNoticia(e) {
    e.preventDefault();
    
    const id = el.noticiaId.value;
    const payload = {
      titulo: el.noticiaTitulo.value.trim(),
      copete: el.noticiaCopete.value.trim(),
      categoria_id: parseInt(el.noticiaCategoria.value),
      imagen_url: el.noticiaImagen.value.trim(),
      autor: el.noticiaAutor.value.trim(),
      contenido: el.noticiaContenido.value.trim(),
      estado: el.noticiaEstado.value
    };

    if (!payload.titulo || !payload.contenido) {
      alert('Por favor completa el título y el desarrollo de la noticia.');
      return;
    }

    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/admin/noticias/${id}` : '/api/admin/noticias';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(id ? 'Noticia modificada correctamente.' : 'Noticia creada correctamente.');
        cerrarModal('modal-noticia');
        fetchNoticiasList();
      } else {
        alert('Error al guardar la noticia.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red.');
    }
  }

  async function eliminarNoticia(id) {
    if (!confirm('¿Seguro que deseas eliminar esta noticia permanentemente?')) return;

    try {
      const res = await fetch(`/api/admin/noticias/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Noticia eliminada correctamente.');
        fetchNoticiasList();
      } else {
        alert('Error al eliminar noticia.');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function manejarSubidaImagenes(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    el.previsualizacionImagenes.innerHTML = '';
    
    // Subir cada imagen secuencialmente
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Crear tarjeta de previsualización con spinner
      const previewCard = document.createElement('div');
      previewCard.style = 'position:relative; width:80px; height:80px; border:1px solid var(--border-color); border-radius:4px; overflow:hidden; display:flex; align-items:center; justify-content:center; background-color:#fff;';
      previewCard.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:var(--color-primary); font-size:1.2rem;"></i>';
      el.previsualizacionImagenes.appendChild(previewCard);

      try {
        const base64WebP = await procesarYConvertirAWebP(file);
        
        const res = await fetch('/api/admin/subir-imagen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagenBase64: base64WebP })
        });
        
        if (!res.ok) {
          const errText = await res.text();
          let errMsg = 'Error al subir';
          try {
            const parsed = JSON.parse(errText);
            errMsg = parsed.error || errMsg;
          } catch (e) {}
          throw new Error(errMsg);
        }
        const data = await res.json();
        
        // Actualizar tarjeta con la imagen real
        previewCard.innerHTML = `<img src="${data.url}" style="width:100%; height:100%; object-fit:cover;"><span style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; font-size:0.6rem; cursor:pointer;" onclick="this.parentElement.remove()">X</span>`;
        
        if (i === 0) {
          // La primera se usa para la portada
          el.noticiaImagen.value = data.url;
        } else {
          // Las siguientes se añaden al desarrollo (contenido)
          el.noticiaContenido.value += `\n<p><img src="${data.url}" alt="Imagen de la noticia" style="width:100%; border-radius:4px; margin:15px 0;"></p>\n`;
        }
      } catch (err) {
        console.error('Error al procesar archivo:', err);
        previewCard.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-danger);"></i>';
      }
    }
  }

  // Helper para procesar imagen local en Canvas y exportar a WebP de 1200px max
  function procesarYConvertirAWebP(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const maxDimension = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Exportar a WebP
          const base64WebP = canvas.toDataURL('image/webp', 0.85);
          resolve(base64WebP);
        };
        img.onerror = (err) => reject(err);
        img.src = event.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
  // ==========================================
  // GESTIÓN DE PUBLICIDAD (CRUD)
  // ==========================================

  function parseUrlsPublicidad(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(u => typeof u === 'string' && u.trim().length > 10);
    const text = String(raw).trim();
    if (!text) return [];

    // Caso 1: Si es un Data URI (Base64)
    if (text.startsWith('data:')) {
      if (text.includes('\n') || text.includes('|||')) {
        const parts = text.split(/\n|\|\|\|/).map(s => s.trim()).filter(Boolean);
        return parts.filter(p => p.length > 30);
      }
      return [text];
    }

    // Caso 2: Si tiene saltos de línea (\n) o delimitador (|||)
    if (text.includes('\n') || text.includes('|||')) {
      return text.split(/\n|\|\|\|/).map(s => s.trim()).filter(s => s.length > 5);
    }

    // Caso 3: Si contiene comas (puede ser lista de URLs o un base64 partido por coma previamente)
    if (text.includes(',')) {
      const parts = text.split(',').map(s => s.trim()).filter(Boolean);
      const reconstructed = [];
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('data:') && i + 1 < parts.length && !parts[i + 1].startsWith('http') && !parts[i + 1].startsWith('/')) {
          reconstructed.push(part + ',' + parts[i + 1]);
          i++; // saltar payload
        } else if (part.startsWith('http') || part.startsWith('/') || part.startsWith('data:')) {
          reconstructed.push(part);
        }
      }
      if (reconstructed.length > 0) return reconstructed;
    }

    return [text];
  }

  async function fetchPublicidadesList() {
    try {
      const res = await fetch('/api/admin/publicidades?_t=' + Date.now());
      const publicidades = await res.json();
      
      el.pubTableBody.innerHTML = '';
      if (publicidades.length === 0) {
        el.pubTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">No hay publicidades registradas.</td></tr>';
        return;
      }

      publicidades.forEach(pub => {
        const tr = document.createElement('tr');
        
        let tipoLabel = pub.tipo;
        if (pub.tipo === 'P-Superior') tipoLabel = 'P-Superior (Banner Superior 1200x200)';
        else if (pub.tipo === 'P-Superior-Fino') tipoLabel = 'P-Superior Fino (Banner Superior 1200x100)';
        else if (pub.tipo === 'P-Middle') tipoLabel = 'P-Middle (Banner Intermedio 700x200)';
        else if (pub.tipo === 'P-Middle-Fino') tipoLabel = 'P-Middle Fino (Banner Intermedio 700x100)';
        else if (pub.tipo === 'P3') tipoLabel = 'P3 (Barra Lateral Superior 300x300)';
        else if (pub.tipo === 'P4') tipoLabel = 'P4 (Barra Lateral Inferior 300x300)';
        else if (pub.tipo === 'popup') tipoLabel = 'Popup de Bienvenida';
        else if (pub.tipo.startsWith('banner_cat_')) {
          const catSlug = pub.tipo.replace('banner_cat_', '');
          tipoLabel = `Debajo de: ${catSlug.charAt(0).toUpperCase() + catSlug.slice(1).replace(/-/g, ' ')}`;
        } else if (pub.tipo.startsWith('P-Cat-')) {
          const num = pub.tipo.replace('P-Cat-', '');
          tipoLabel = `Debajo de Categoría #${num}`;
        } else {
          tipoLabel = pub.tipo.replace('banner_', 'Banner ').replace('popup', 'Popup Flotante');
        }

        const urls = parseUrlsPublicidad(pub.url_archivo);
        const firstUrl = urls[0] || '';
        let thumbHtml = '<div style="width:70px; height:45px; background:var(--bg-tertiary); display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:10px; color:var(--text-muted); margin:0 auto;">Sin archivo</div>';
        
        if (firstUrl) {
          const isVid = pub.formato === 'video' || firstUrl.match(/\.(mp4|webm|ogg)$/i);
          if (isVid) {
            thumbHtml = `<video src="${firstUrl}" style="max-width:80px; max-height:48px; border-radius:4px; border:1px solid var(--border-color); object-fit:contain; display:block; margin:0 auto;" muted></video>`;
          } else {
            thumbHtml = `<img src="${firstUrl}" style="max-width:80px; max-height:48px; border-radius:4px; border:1px solid var(--border-color); object-fit:contain; display:block; margin:0 auto;" alt="Anuncio">`;
          }
        }

        if (urls.length > 1) {
          thumbHtml = `
            <div style="position:relative; display:inline-block;">
              ${thumbHtml}
              <span style="position:absolute; bottom:-4px; right:-4px; background:var(--color-orange); color:#fff; font-size:9px; padding:1px 5px; border-radius:8px; font-weight:700; box-shadow:0 1px 2px rgba(0,0,0,0.3);" title="${urls.length} archivos en rotación">+${urls.length}</span>
            </div>
          `;
        }

        const isActivo = pub.activo === 1;

        tr.innerHTML = `
          <td style="text-align:center; vertical-align:middle;">${thumbHtml}</td>
          <td style="font-weight:600">${pub.nombre}</td>
          <td><span style="font-size:0.82rem; color:var(--text-secondary);">${tipoLabel}</span></td>
          <td><span class="badge badge-published" style="background-color:var(--bg-tertiary); color:var(--text-secondary); text-transform:uppercase">${pub.formato}</span></td>
          <td><a href="${pub.url_destino}" target="_blank" style="color:var(--color-primary); text-decoration:underline; font-size:0.8rem; display:inline-block; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pub.url_destino}</a></td>
          <td style="text-align:center; vertical-align:middle;">
            <button type="button" class="btn btn-toggle-visibilidad" data-id="${pub.id}" data-activo="${pub.activo}" style="padding:5px 12px; font-size:0.75rem; border-radius:14px; cursor:pointer; font-weight:600; border:1px solid ${isActivo ? '#10b981' : '#ef4444'}; background:${isActivo ? '#ecfdf5' : '#fef2f2'}; color:${isActivo ? '#059669' : '#dc2626'}; transition:all 0.2s;" title="Clic para ${isActivo ? 'Ocultar' : 'Mostrar'}">
              <i class="fa-solid ${isActivo ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isActivo ? 'Visible (Activo)' : 'Oculto (Inactivo)'}
            </button>
          </td>
          <td style="text-align:center; vertical-align:middle;">
            <div style="display:flex; gap:6px; justify-content:center;">
              <button class="btn btn-outline btn-editar" title="Editar Campaña" style="padding:5px 9px; font-size:0.8rem;"><i class="fa-regular fa-pen-to-square"></i></button>
              <button class="btn btn-danger btn-eliminar" title="Eliminar Publicidad" style="padding:5px 9px; font-size:0.8rem;"><i class="fa-regular fa-trash-can"></i></button>
            </div>
          </td>
        `;

        tr.querySelector('.btn-toggle-visibilidad').addEventListener('click', () => toggleVisibilidadPublicidad(pub));
        tr.querySelector('.btn-editar').addEventListener('click', () => abrirModalPublicidad(pub));
        tr.querySelector('.btn-eliminar').addEventListener('click', () => eliminarPublicidad(pub.id));

        el.pubTableBody.appendChild(tr);
      });
    } catch (e) {
      console.error('Error al cargar listado de anuncios:', e);
      el.pubTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--color-danger)">Error al cargar publicidades.</td></tr>';
    }
  }

  async function toggleVisibilidadPublicidad(pub) {
    const nuevoEstado = pub.activo === 1 ? 0 : 1;
    const payload = {
      nombre: pub.nombre,
      tipo: pub.tipo,
      formato: pub.formato,
      url_archivo: pub.url_archivo,
      url_destino: pub.url_destino,
      activo: nuevoEstado
    };

    try {
      const res = await fetch(`/api/admin/publicidades/${pub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchPublicidadesList();
      } else {
        alert('No se pudo cambiar el estado de visibilidad.');
      }
    } catch (err) {
      console.error('Error al togglear visibilidad:', err);
    }
  }

  function abrirModalPublicidad(pub = null) {
    el.formPublicidad.reset();
    el.previsualizacionPub.innerHTML = '';
    
    if (pub) {
      document.getElementById('modal-publicidad-title').textContent = 'Editar Publicidad';
      el.pubId.value = pub.id;
      el.pubNombre.value = pub.nombre;
      el.pubTipo.value = pub.tipo;
      el.pubFormato.value = pub.formato;
      el.pubUrlArchivo.value = pub.url_archivo;
      el.pubUrlDestino.value = pub.url_destino;
      el.pubActivo.checked = pub.activo === 1;

      // Mostrar previsualización
      actualizarPrevisualizacionPub(pub.url_archivo, pub.formato);
    } else {
      document.getElementById('modal-publicidad-title').textContent = 'Crear Nueva Publicidad';
      el.pubId.value = '';
      el.pubActivo.checked = true;
    }

    abrirModal('modal-publicidad');
  }

  function actualizarPrevisualizacionPub(urlsString, formato) {
    el.previsualizacionPub.innerHTML = '';
    if (!urlsString) return;
    
    const urls = parseUrlsPublicidad(urlsString);
    if (urls.length === 0) return;

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.width = '100%';

    const headerNote = document.createElement('div');
    headerNote.style.display = 'flex';
    headerNote.style.justifyContent = 'space-between';
    headerNote.style.alignItems = 'center';
    headerNote.style.fontSize = '0.8rem';
    headerNote.style.color = 'var(--text-secondary)';
    headerNote.innerHTML = `<span><strong>${urls.length} archivo(s) cargado(s)</strong></span><span style="font-size:0.75rem; color:var(--text-muted)">Puedes eliminar individualmente</span>`;
    container.appendChild(headerNote);

    const itemsWrapper = document.createElement('div');
    itemsWrapper.style.display = 'flex';
    itemsWrapper.style.flexDirection = 'column';
    itemsWrapper.style.gap = '8px';

    urls.forEach((url, index) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.padding = '8px 12px';
      item.style.border = '1px solid var(--border-color)';
      item.style.borderRadius = '6px';
      item.style.background = 'var(--bg-secondary)';
      item.style.gap = '12px';
      
      let mediaHtml = '';
      const isVid = formato === 'video' || url.match(/\.(mp4|webm|ogg)$/i);
      if (isVid) {
        mediaHtml = `<video src="${url}" autoplay loop muted playsinline style="max-width:110px; max-height:60px; border-radius:4px; display:block; object-fit:contain;"></video>`;
      } else {
        mediaHtml = `<img src="${url}" style="max-width:110px; max-height:60px; border-radius:4px; display:block; object-fit:contain;" alt="Banner #${index+1}">`;
      }

      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; flex:1; overflow:hidden;">
          <span style="background:var(--color-primary); color:#fff; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:bold;">#${index+1}</span>
          <div style="width:110px; height:60px; display:flex; align-items:center; justify-content:center; background:var(--bg-tertiary); border-radius:4px; overflow:hidden;">
            ${mediaHtml}
          </div>
          <div style="font-size:0.78rem; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
            ${url.startsWith('data:') ? 'Archivo local (Base64)' : url}
          </div>
        </div>
        <button type="button" class="btn btn-outline btn-eliminar-archivo" data-index="${index}" style="padding:4px 8px; font-size:0.75rem; color:var(--color-danger); border-color:var(--color-danger); cursor:pointer;" title="Eliminar este archivo">
          <i class="fa-solid fa-trash-can"></i> Quitar
        </button>
      `;

      item.querySelector('.btn-eliminar-archivo').addEventListener('click', () => {
        const nuevasUrls = urls.filter((_, i) => i !== index);
        const nuevoTexto = nuevasUrls.join('\n');
        el.pubUrlArchivo.value = nuevoTexto;
        actualizarPrevisualizacionPub(nuevoTexto, formato);
      });

      itemsWrapper.appendChild(item);
    });

    container.appendChild(itemsWrapper);

    if (urls.length > 1) {
      const tip = document.createElement('div');
      tip.style.fontSize = '0.78rem';
      tip.style.color = 'var(--color-primary)';
      tip.style.fontWeight = '500';
      tip.style.padding = '6px 8px';
      tip.style.background = 'rgba(var(--color-primary-rgb, 37, 99, 235), 0.08)';
      tip.style.borderRadius = '4px';
      tip.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> <strong>Rotación activa:</strong> Se mostrarán uno tras otro con animación continua en el diario.`;
      container.appendChild(tip);
    }

    el.previsualizacionPub.appendChild(container);
  }

  async function subirArchivoUnico(file) {
    // 1. Si Cloudinary está configurado, intentar primero
    if (appConfigs.cloudinary_cloud_name && appConfigs.cloudinary_upload_preset) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', appConfigs.cloudinary_upload_preset);

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${appConfigs.cloudinary_cloud_name}/auto/upload`, {
          method: 'POST',
          body: formData
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          if (data.secure_url) return data.secure_url;
        }
      } catch (cloudinaryErr) {
        console.warn('Fallo Cloudinary, intentando backend:', cloudinaryErr.message);
      }
    }

    // 2. Subir vía backend
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Content = event.target.result;
        try {
          const res = await fetch('/api/admin/subir-archivo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archivoBase64: base64Content })
          });
          
          if (!res.ok) {
            const errText = await res.text();
            let errMsg = 'Error en servidor';
            try {
              const parsed = JSON.parse(errText);
              errMsg = parsed.error || errMsg;
            } catch (e) {}
            console.warn('Subida backend falló, usando Base64 directo:', errMsg);
            return resolve(base64Content);
          }
          const data = await res.json();
          if (data.url) {
            resolve(data.url);
          } else {
            resolve(base64Content);
          }
        } catch (err) {
          console.warn('Error en fetch backend, usando Base64 directo:', err);
          resolve(base64Content);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  async function manejarSubidaPublicidad(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    el.previsualizacionPub.innerHTML = `<div style="display:flex; align-items:center; gap:8px; color:var(--color-primary); font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin fa-lg"></i> Subiendo ${files.length} archivo(s)...</div>`;

    try {
      const urlsSubidas = [];
      let tieneVideo = false;
      let tieneGif = false;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        el.previsualizacionPub.innerHTML = `<div style="display:flex; align-items:center; gap:8px; color:var(--color-primary); font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin fa-lg"></i> Subiendo archivo ${i + 1} de ${files.length} (${file.name})...</div>`;
        
        if (file.type.startsWith('video/')) tieneVideo = true;
        if (file.type.includes('gif')) tieneGif = true;

        const url = await subirArchivoUnico(file);
        urlsSubidas.push(url);
      }

      // Detectar formato basándose en los archivos subidos
      if (tieneVideo) {
        el.pubFormato.value = 'video';
      } else if (tieneGif) {
        el.pubFormato.value = 'gif';
      } else {
        el.pubFormato.value = 'imagen';
      }

      // Combinar con URLs existentes si las hay
      const existentes = parseUrlsPublicidad(el.pubUrlArchivo.value);
      const combinadas = [...existentes, ...urlsSubidas];
      const urlsFinales = combinadas.join('\n');
      
      el.pubUrlArchivo.value = urlsFinales;
      actualizarPrevisualizacionPub(urlsFinales, el.pubFormato.value);
    } catch (err) {
      console.error('Error al subir archivos de publicidad:', err);
      el.previsualizacionPub.innerHTML = `<span style="color:var(--color-danger); font-size:0.85rem;"><i class="fa-solid fa-triangle-exclamation"></i> Error al subir: ${err.message}</span>`;
    }
  }

  async function guardarPublicidad(e) {
    e.preventDefault();
    
    const id = el.pubId.value;
    const payload = {
      nombre: el.pubNombre.value.trim(),
      tipo: el.pubTipo.value,
      formato: el.pubFormato.value,
      url_archivo: el.pubUrlArchivo.value.trim(),
      url_destino: el.pubUrlDestino.value.trim(),
      activo: el.pubActivo.checked ? 1 : 0
    };

    if (!payload.nombre || !payload.url_archivo || !payload.url_destino) {
      alert('Por favor, completa todos los campos requeridos (nombre, archivo y enlace).');
      return;
    }

    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/admin/publicidades/${id}` : '/api/admin/publicidades';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(id ? 'Anuncio publicitario modificado correctamente.' : 'Anuncio publicitario creado correctamente.');
        cerrarModal('modal-publicidad');
        fetchPublicidadesList();
      } else {
        alert('Error al guardar el anuncio publicitario.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  }

  async function eliminarPublicidad(id) {
    if (!confirm('¿Seguro que deseas eliminar esta publicidad permanentemente?')) return;

    try {
      const res = await fetch(`/api/admin/publicidades/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Publicidad eliminada correctamente.');
        fetchPublicidadesList();
      } else {
        alert('Error al eliminar la publicidad.');
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ==========================================
  // CONFIGURACIÓN DE DISEÑOS DE CATEGORÍAS
  // ==========================================

  async function enviarOrdenesBulk(catsList) {
    try {
      const payload = catsList.map(c => ({
        id: c.id,
        posicion_home: c.posicion_home || 'izquierda',
        orden: c.orden
      }));
      const res = await fetch('/api/admin/categorias-bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchCategoriasConfigList();
      } else {
        alert('Error al reordenar las categorías.');
      }
    } catch (err) {
      console.error('Error en bulk update:', err);
      alert('Error de conexión al reordenar.');
    }
  }

  async function fetchCategoriasConfigList() {
    try {
      const res = await fetch('/api/categorias?_t=' + Date.now());
      const cats = await res.json();
      
      el.categoriasIzquierdaTableBody.innerHTML = '';
      el.categoriasDerechaTableBody.innerHTML = '';
      
      // Filtrar páginas virtuales
      const catsFiltradas = cats.filter(c => c.slug !== 'quienes-somos' && c.slug !== 'contacto');

      // Separar por ubicación
      const catsIzquierda = catsFiltradas.filter(c => c.posicion_home !== 'derecha');
      const catsDerecha = catsFiltradas.filter(c => c.posicion_home === 'derecha');

      // Ordenar ascendentemente
      catsIzquierda.sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.id - b.id);
      catsDerecha.sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.id - b.id);

      // Renderizar tablas
      renderTablaCategoriasGrupo(catsIzquierda, el.categoriasIzquierdaTableBody);
      renderTablaCategoriasGrupo(catsDerecha, el.categoriasDerechaTableBody);

    } catch (e) {
      console.error('Error al cargar configurador de categorías:', e);
      el.categoriasIzquierdaTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--color-danger)">Error al cargar categorías.</td></tr>';
      el.categoriasDerechaTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--color-danger)">Error al cargar categorías.</td></tr>';
    }
  }

  function renderTablaCategoriasGrupo(list, container) {
    if (list.length === 0) {
      container.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 15px;">No hay categorías en esta ubicación.</td></tr>';
      return;
    }

    list.forEach((cat, index) => {
      const tr = document.createElement('tr');
      
      let disenoLabel = 'Grilla (3 Columnas)';
      if (cat.diseno_home === 'grid-2col') disenoLabel = 'Grilla (2 Columnas)';
      else if (cat.diseno_home === 'carousel') disenoLabel = 'Carrusel horizontal';
      else if (cat.diseno_home === 'list') disenoLabel = 'Lista compacta';
      else if (cat.diseno_home === 'featured') disenoLabel = 'Destacada + Lista';
      else if (cat.diseno_home === 'mosaic') disenoLabel = 'Mosaico asimétrico';
      else if (cat.diseno_home === 'large-image') disenoLabel = 'Foto Grande (1 Col)';
      else if (cat.diseno_home === 'title-overlay') disenoLabel = 'Título s/ Foto (1 Col)';
      else if (cat.diseno_home === 'carousel-infinite') disenoLabel = 'Carrusel Infinito (3 Cols)';

      const isFirst = index === 0;
      const isLast = index === list.length - 1;

      tr.innerHTML = `
        <td style="font-weight:600">${cat.nombre}</td>
        <td><code style="background-color:var(--bg-tertiary); padding:2px 6px; border-radius:2px;">${cat.slug}</code></td>
        <td style="font-weight:500;">${disenoLabel}</td>
        <td style="font-weight:600; text-align:center;">${cat.limite_home}</td>
        <td style="font-weight:600; text-align:center;">${cat.orden || 0}</td>
        <td>
          <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
            <button class="btn btn-outline btn-subir" style="padding:4px 8px; font-size:0.75rem;" ${isFirst ? 'disabled' : ''} title="Subir orden">
              <i class="fa-solid fa-arrow-up"></i>
            </button>
            <button class="btn btn-outline btn-bajar" style="padding:4px 8px; font-size:0.75rem;" ${isLast ? 'disabled' : ''} title="Bajar orden">
              <i class="fa-solid fa-arrow-down"></i>
            </button>
            <button class="btn btn-outline btn-editar" style="padding:4px 8px; font-size:0.75rem;" title="Ajustar diseño">
              <i class="fa-solid fa-sliders"></i> Ajustar
            </button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-editar').addEventListener('click', () => abrirModalCategoriaConfig(cat));
      
      if (!isFirst) {
        tr.querySelector('.btn-subir').addEventListener('click', () => {
          const newList = [...list];
          const temp = newList[index];
          newList[index] = newList[index - 1];
          newList[index - 1] = temp;
          
          newList.forEach((c, idx) => { c.orden = idx; });
          enviarOrdenesBulk(newList);
        });
      }

      if (!isLast) {
        tr.querySelector('.btn-bajar').addEventListener('click', () => {
          const newList = [...list];
          const temp = newList[index];
          newList[index] = newList[index + 1];
          newList[index + 1] = temp;
          
          newList.forEach((c, idx) => { c.orden = idx; });
          enviarOrdenesBulk(newList);
        });
      }

      container.appendChild(tr);
    });
  }

  function abrirModalCategoriaConfig(cat) {
    el.formCategoriaConfig.reset();
    
    el.catConfigId.value = cat.id;
    el.catConfigNombre.value = cat.nombre;
    el.catConfigDiseno.value = cat.diseno_home || 'grid';
    el.catConfigLimite.value = cat.limite_home || 3;
    el.catConfigPosicion.value = cat.posicion_home || 'izquierda';
    el.catConfigOrden.value = cat.orden || 0;

    abrirModal('modal-categoria-config');
  }

  async function guardarCategoriaConfig(e) {
    e.preventDefault();
    
    const id = el.catConfigId.value;
    const payload = {
      diseno_home: el.catConfigDiseno.value,
      limite_home: parseInt(el.catConfigLimite.value),
      posicion_home: el.catConfigPosicion.value,
      orden: parseInt(el.catConfigOrden.value) || 0
    };

    if (isNaN(payload.limite_home) || payload.limite_home < 1) {
      alert('La cantidad de noticias debe ser un número mayor a 0.');
      return;
    }

    try {
      const res = await fetch(`/api/admin/categorias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Configuración de visualización de categoría guardada correctamente.');
        cerrarModal('modal-categoria-config');
        fetchCategoriasConfigList();
      } else {
        alert('Error al guardar la configuración.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión.');
    }
  }

  // Guardar elementos en la estructura del modal
  el.modalNoticiaTitle = document.getElementById('modal-noticia-title');

  // Ejecutar inicialización
  init();
});

// Funciones globales de apertura y cierre de modales
function abrirModal(id) {
  document.getElementById(id).classList.add('active');
}

function cerrarModal(id) {
  document.getElementById(id).classList.remove('active');
}
