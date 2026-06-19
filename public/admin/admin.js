// Lógica del Panel de Administración Principal - Pehuenia Online

document.addEventListener('DOMContentLoaded', () => {
  // Estado
  let categorias = [];

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
    categoriasTableBody: document.getElementById('categorias-table-body'),
    btnGuardarCategoriaConfig: document.getElementById('btn-guardar-categoria-config'),
    formCategoriaConfig: document.getElementById('form-categoria-config'),
    catConfigId: document.getElementById('cat-config-id'),
    catConfigNombre: document.getElementById('cat-config-nombre'),
    catConfigDiseno: document.getElementById('cat-config-diseno'),
    catConfigLimite: document.getElementById('cat-config-limite')
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
      switchTab('config');
      abrirModal('modal-configuraciones');
    } else {
      switchTab('inicio');
    }
  }

  // ==========================================
  // NAVEGACIÓN Y TABS
  // ==========================================

  function setupEventListeners() {
    el.tabInicio.addEventListener('click', () => switchTab('inicio'));
    el.tabNoticias.addEventListener('click', () => switchTab('noticias'));
    el.tabPublicidad.addEventListener('click', () => switchTab('publicidad'));
    el.tabCategorias.addEventListener('click', () => switchTab('categorias'));
    el.tabConfig.addEventListener('click', () => {
      abrirModal('modal-configuraciones');
    });

    el.btnConfigAnalytics.addEventListener('click', () => {
      abrirModal('modal-configuraciones');
      el.configAnalyticsId.focus();
    });

    // Modales de noticias
    el.btnNuevaNoticia.addEventListener('click', () => abrirModalNoticia());
    el.btnNuevaNoticiaQuick.addEventListener('click', () => abrirModalNoticia());
    el.btnGuardarNoticia.addEventListener('click', guardarNoticia);
    el.btnGuardarConfig.addEventListener('click', guardarConfiguraciones);
    el.noticiaArchivos.addEventListener('change', manejarSubidaImagenes);

    // Publicidad
    el.btnNuevaPublicidad.addEventListener('click', () => abrirModalPublicidad());
    el.btnGuardarPublicidad.addEventListener('click', guardarPublicidad);
    el.pubArchivoInput.addEventListener('change', manejarSubidaPublicidad);

    // Categorías Config
    el.btnGuardarCategoriaConfig.addEventListener('click', guardarCategoriaConfig);
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
      const res = await fetch('/api/admin/estadisticas');
      const stats = await res.json();
      
      el.statHoy.textContent = stats.noticiasHoy;
      el.statBorradores.textContent = stats.borradores;
      el.statVisitas.textContent = stats.lecturasTotales.toLocaleString('es-AR');
    } catch (e) {
      console.error('Error al cargar estadísticas');
    }

    // Config de Analytics
    try {
      const res = await fetch('/api/admin/configuraciones');
      const configs = await res.json();
      
      el.configGeminiKey.value = configs.gemini_api_key || '';
      el.configAnalyticsId.value = configs.analytics_id || '';
      el.configNombreDiario.value = configs.nombre_diario || 'PEHUENIA ONLINE';
      el.configClimaCiudad.value = configs.clima_ciudad || 'Villa Pehuenia';

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
      const res = await fetch('/api/categorias');
      categorias = await res.json();
      
      el.noticiaCategoria.innerHTML = '';
      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        el.noticiaCategoria.appendChild(option);
      });
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
      clima_ciudad: el.configClimaCiudad.value.trim()
    };

    try {
      const res = await fetch('/api/admin/configuraciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
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
      const res = await fetch('/api/admin/noticias');
      const noticias = await res.json();
      
      el.noticiasTableBody.innerHTML = '';
      if (noticias.length === 0) {
        el.noticiasTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center">No hay noticias registradas.</td></tr>';
        return;
      }

      noticias.forEach(n => {
        const tr = document.createElement('tr');
        const fecha = new Date(n.fecha).toLocaleDateString('es-AR', { hour: '2-digit', minute: '2-digit' });
        
        const badgeClass = n.estado === 'publicado' ? 'badge-published' : 'badge-draft';
        const badgeLabel = n.estado === 'publicado' ? 'Publicado' : 'Borrador';

        tr.innerHTML = `
          <td style="font-weight:600">${n.titulo}</td>
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
    } catch (e) {
      el.noticiasTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--color-danger)">Error al cargar noticias.</td></tr>';
    }
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
        
        if (!res.ok) throw new Error('Error al subir');
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
  // ==========================================
  // GESTIÓN DE PUBLICIDAD (CRUD)
  // ==========================================

  async function fetchPublicidadesList() {
    try {
      const res = await fetch('/api/admin/publicidades');
      const publicidades = await res.json();
      
      el.pubTableBody.innerHTML = '';
      if (publicidades.length === 0) {
        el.pubTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center">No hay publicidades registradas.</td></tr>';
        return;
      }

      publicidades.forEach(pub => {
        const tr = document.createElement('tr');
        
        const badgeClass = pub.activo === 1 ? 'badge-published' : 'badge-draft';
        const badgeLabel = pub.activo === 1 ? 'Activo' : 'Inactivo';
        
        const tipoLabel = pub.tipo.replace('banner_', 'Banner ').replace('popup', 'Popup Flotante');

        tr.innerHTML = `
          <td style="font-weight:600">${pub.nombre}</td>
          <td>${tipoLabel}</td>
          <td><span class="badge badge-published" style="background-color:var(--bg-tertiary); color:var(--text-secondary); text-transform:uppercase">${pub.formato}</span></td>
          <td><a href="${pub.url_destino}" target="_blank" style="color:var(--color-primary); text-decoration:underline">${pub.url_destino}</a></td>
          <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
          <td>
            <button class="btn btn-outline btn-editar" style="padding:4px 8px; font-size:0.75rem;"><i class="fa-regular fa-pen-to-square"></i></button>
            <button class="btn btn-danger btn-eliminar" style="padding:4px 8px; font-size:0.75rem;"><i class="fa-regular fa-trash-can"></i></button>
          </td>
        `;

        tr.querySelector('.btn-editar').addEventListener('click', () => abrirModalPublicidad(pub));
        tr.querySelector('.btn-eliminar').addEventListener('click', () => eliminarPublicidad(pub.id));

        el.pubTableBody.appendChild(tr);
      });
    } catch (e) {
      console.error('Error al cargar listado de anuncios:', e);
      el.pubTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--color-danger)">Error al cargar publicidades.</td></tr>';
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

  function actualizarPrevisualizacionPub(url, formato) {
    el.previsualizacionPub.innerHTML = '';
    if (!url) return;
    
    if (formato === 'video') {
      el.previsualizacionPub.innerHTML = `<video src="${url}" autoplay loop muted playsinline style="max-width:100%; max-height:120px; border-radius:4px; border:1px solid var(--border-color);"></video>`;
    } else {
      el.previsualizacionPub.innerHTML = `<img src="${url}" style="max-width:100%; max-height:120px; border-radius:4px; border:1px solid var(--border-color); object-fit:contain;">`;
    }
  }

  async function manejarSubidaPublicidad(e) {
    const file = e.target.files[0];
    if (!file) return;

    el.previsualizacionPub.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:var(--color-primary); font-size:1.5rem;"></i>';

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Content = event.target.result;
      try {
        const res = await fetch('/api/admin/subir-archivo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archivoBase64: base64Content })
        });
        
        if (!res.ok) throw new Error('Error de subida');
        const data = await res.json();
        
        el.pubUrlArchivo.value = data.url;
        
        // Detectar formato basándose en tipo de archivo
        if (file.type.startsWith('video/')) {
          el.pubFormato.value = 'video';
        } else if (file.type.includes('gif')) {
          el.pubFormato.value = 'gif';
        } else {
          el.pubFormato.value = 'imagen';
        }

        actualizarPrevisualizacionPub(data.url, el.pubFormato.value);
      } catch (err) {
        console.error('Error al subir archivo de publicidad:', err);
        el.previsualizacionPub.innerHTML = '<span style="color:var(--color-danger)"><i class="fa-solid fa-triangle-exclamation"></i> Error al subir</span>';
      }
    };
    reader.readAsDataURL(file);
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

  async function fetchCategoriasConfigList() {
    try {
      const res = await fetch('/api/categorias');
      const cats = await res.json();
      
      el.categoriasTableBody.innerHTML = '';
      
      // Filtrar páginas virtuales
      const catsFiltradas = cats.filter(c => c.slug !== 'quienes-somos' && c.slug !== 'contacto');

      catsFiltradas.forEach(cat => {
        const tr = document.createElement('tr');
        
        let disenoLabel = 'Grilla estándar';
        if (cat.diseno_home === 'carousel') disenoLabel = 'Carrusel horizontal';
        else if (cat.diseno_home === 'list') disenoLabel = 'Lista compacta';
        else if (cat.diseno_home === 'featured') disenoLabel = 'Destacada + Lista';
        else if (cat.diseno_home === 'mosaic') disenoLabel = 'Mosaico asimétrico';
        else if (cat.diseno_home === 'large-image') disenoLabel = 'Foto Grande (1 Col)';
        else if (cat.diseno_home === 'title-overlay') disenoLabel = 'Título s/ Foto (1 Col)';
        else if (cat.diseno_home === 'carousel-infinite') disenoLabel = 'Carrusel Infinito (3 Cols)';

        tr.innerHTML = `
          <td style="font-weight:600">${cat.nombre}</td>
          <td><code style="background-color:var(--bg-tertiary); padding:2px 6px; border-radius:2px;">${cat.slug}</code></td>
          <td style="text-transform: capitalize; font-weight:500;">${disenoLabel}</td>
          <td style="font-weight:600; text-align:center;">${cat.limite_home}</td>
          <td>
            <button class="btn btn-outline btn-editar" style="padding:4px 8px; font-size:0.75rem;"><i class="fa-solid fa-sliders"></i> Ajustar Inicio</button>
          </td>
        `;

        tr.querySelector('.btn-editar').addEventListener('click', () => abrirModalCategoriaConfig(cat));

        el.categoriasTableBody.appendChild(tr);
      });
    } catch (e) {
      console.error('Error al cargar configurador de categorías:', e);
      el.categoriasTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--color-danger)">Error al cargar categorías.</td></tr>';
    }
  }

  function abrirModalCategoriaConfig(cat) {
    el.formCategoriaConfig.reset();
    
    el.catConfigId.value = cat.id;
    el.catConfigNombre.value = cat.nombre;
    el.catConfigDiseno.value = cat.diseno_home || 'grid';
    el.catConfigLimite.value = cat.limite_home || 3;

    abrirModal('modal-categoria-config');
  }

  async function guardarCategoriaConfig(e) {
    e.preventDefault();
    
    const id = el.catConfigId.value;
    const payload = {
      diseno_home: el.catConfigDiseno.value,
      limite_home: parseInt(el.catConfigLimite.value)
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
