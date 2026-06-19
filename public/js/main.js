// Lógica del Cliente - Pehuenia Online

document.addEventListener('DOMContentLoaded', () => {
  // Estado Global de la App
  const state = {
    activeCategory: 'home',
    theme: localStorage.getItem('theme') || 'light',
    currentAudio: null,
    currentAudioId: null,
    noticias: [],
    reproductores: []
  };

  // Elementos del DOM
  const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    currentDate: document.getElementById('current-date'),
    weatherWidget: document.getElementById('weather-widget'),
    weatherTemp: document.getElementById('weather-temp'),
    weatherHum: document.getElementById('weather-hum'),
    mobileToggle: document.getElementById('mobile-toggle'),
    navLinks: document.getElementById('nav-links'),
    sections: {
      home: document.getElementById('section-home'),
      category: document.getElementById('section-category'),
      detail: document.getElementById('section-detail')
    },
    tickerTrack: document.getElementById('breaking-ticker-track'),
    heroGrid: document.getElementById('hero-grid'),
    gridProvinciales: document.getElementById('grid-provinciales'),
    listDeportes: document.getElementById('list-deportes'),
    listPoliciales: document.getElementById('list-policiales'),
    audioContainer: document.getElementById('audio-streams-container'),
    categoryPageTitle: document.getElementById('category-page-title'),
    gridCategoryPosts: document.getElementById('grid-category-posts'),
    articleDetailContent: document.getElementById('article-detail-content'),
    searchInput: document.getElementById('search-input'),
    searchButton: document.getElementById('search-button'),
    newsletterForm: document.getElementById('newsletter-form'),
    rateDolarOficial: document.getElementById('rate-dolar-oficial'),
    rateDolarBlue: document.getElementById('rate-dolar-blue')
  };

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  async function init() {
    setupDateTime();
    setupTheme();
    setupWeather();
    setupRates();
    setupEventListeners();
    
    // Cargar publicidades y banners
    await fetchPublicidades();
    
    // Cargar contenidos del backend
    fetchNoticiasTicker();
    fetchNoticiasHero();
    fetchNoticiasHomeCategorias();
    fetchReproductoresAudio();

    // Cargar nuevos widgets de barra lateral
    renderClimaSemanal();
    renderFixtureMundial();
    renderSidebarCategory('policiales', 'sidebar-policiales-category', 'fa-solid fa-building-shield');
    renderSidebarCategory('entretenimiento-y-curiosidades', 'sidebar-curiosidades-category', 'fa-solid fa-lightbulb');
    renderSidebarCategory('mascotas', 'sidebar-compact-category', 'fa-solid fa-paw');
  }

  // ==========================================
  // CONFIGURACIÓN DE INTERFAZ Y EVENTOS
  // ==========================================

  function setupDateTime() {
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const hoy = new Date();
    elements.currentDate.textContent = hoy.toLocaleDateString('es-ES', opciones);
  }

  function setupTheme() {
    if (state.theme === 'dark') {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
      elements.themeToggle.innerHTML = '<i class="fa-regular fa-sun"></i>';
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
      elements.themeToggle.innerHTML = '<i class="fa-regular fa-moon"></i>';
    }
  }

  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', state.theme);
    setupTheme();
  }

  function setupEventListeners() {
    // Toggle tema oscuro/claro
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Toggle menú móvil
    elements.mobileToggle.addEventListener('click', () => {
      elements.navLinks.classList.toggle('mobile-active');
    });

    // Soporte para abrir dropdowns haciendo click (crucial para móviles y pantallas táctiles)
    document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const parent = trigger.parentElement;
        
        // Cerrar otros desplegables
        document.querySelectorAll('.dropdown').forEach(d => {
          if (d !== parent) d.classList.remove('open');
        });
        
        parent.classList.toggle('open');
      });
    });

    // Cerrar desplegables al hacer click fuera
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown').forEach(d => {
        d.classList.remove('open');
      });
    });

    // Navegación por links de categorías y secciones
    document.querySelectorAll('[data-category]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const category = link.getAttribute('data-category');
        elements.navLinks.classList.remove('mobile-active'); // Cerrar menú móvil
        
        // Cerrar todos los desplegables al seleccionar una categoría
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
        
        // Manejar links activos
        document.querySelectorAll('[data-category]').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        if (category === 'home') {
          showSection('home');
        } else if (category === 'quienes-somos') {
          showQuienesSomos();
        } else if (category === 'contacto') {
          showContacto();
        } else {
          showCategoryPage(category);
        }
      });
    });

    // Buscador
    elements.searchButton.addEventListener('click', executeSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') executeSearch();
    });

    // Suscripción Newsletter
    elements.newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('¡Gracias por suscribirte al newsletter de Pehuenia Online!');
      elements.newsletterForm.reset();
    });
  }

  function showSection(sectionName) {
    Object.keys(elements.sections).forEach(key => {
      if (key === sectionName) {
        elements.sections[key].classList.add('active');
      } else {
        elements.sections[key].classList.remove('active');
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  // CARGA DE DATOS DE API (FRONTEND)
  // ==========================================

  // Ticker de Noticias de Última Hora
  async function fetchNoticiasTicker() {
    try {
      const res = await fetch('/api/noticias?limite=8');
      const noticias = await res.json();
      
      if (noticias.length === 0) {
        elements.tickerTrack.innerHTML = '<span>Bienvenido a Pehuenia Online - Diario Digital de la Cordillera</span>';
        return;
      }

      elements.tickerTrack.innerHTML = '';
      noticias.forEach(noticia => {
        const span = document.createElement('span');
        span.textContent = noticia.titulo;
        span.addEventListener('click', () => showArticleDetail(noticia.id));
        elements.tickerTrack.appendChild(span);
      });
    } catch (error) {
      console.error('Error al cargar noticias del ticker:', error);
      elements.tickerTrack.innerHTML = '<span>Manténgase informado con Pehuenia Online</span>';
    }
  }

  // Grid del Hero
  async function fetchNoticiasHero() {
    try {
      const res = await fetch('/api/noticias?limite=3');
      const noticias = await res.json();
      
      if (noticias.length === 0) {
        elements.heroGrid.innerHTML = '<div class="no-news-message">No hay noticias publicadas actualmente.</div>';
        return;
      }

      elements.heroGrid.innerHTML = '';
      
      // Primera noticia (Grande)
      const primary = noticias[0];
      const primaryCard = createHeroItemMarkup(primary, 'large');
      elements.heroGrid.appendChild(primaryCard);

      // Segunda noticia (Mediana)
      if (noticias[1]) {
        const secondary = noticias[1];
        const secondaryCard = createHeroItemMarkup(secondary, 'medium');
        elements.heroGrid.appendChild(secondaryCard);
      }

      // Tercera noticia (Pequeña - inyectamos un mockup si no hay para balancear el grid)
      if (noticias[2]) {
        const tertiary = noticias[2];
        const tertiaryCard = createHeroItemMarkup(tertiary, 'small');
        elements.heroGrid.appendChild(tertiaryCard);
      }
    } catch (error) {
      console.error('Error al cargar noticias del Hero:', error);
      elements.heroGrid.innerHTML = '<div class="no-news-message">Error al cargar la portada.</div>';
    }
  }

  function createHeroItemMarkup(noticia, sizeClass) {
    const item = document.createElement('div');
    item.className = `hero-item ${sizeClass}`;
    
    const defaultImg = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=600';
    const imagen = noticia.imagen_url || defaultImg;
    
    const fechaFormateada = new Date(noticia.fecha).toLocaleDateString('es-AR');

    item.innerHTML = `
      <img src="${imagen}" alt="${noticia.titulo}">
      <div class="hero-overlay">
        <span class="hero-category">${noticia.categoria_name}</span>
        <h3 class="hero-title">${noticia.titulo}</h3>
        <span class="hero-meta">${fechaFormateada} | Lecturas: ${noticia.visitas}</span>
      </div>
    `;

    item.addEventListener('click', () => showArticleDetail(noticia.id));
    return item;
  }

  // Cargar categorías y renderizarlas dinámicamente según su configuración en el inicio
  async function fetchNoticiasHomeCategorias() {
    const container = document.getElementById('dynamic-home-categories');
    if (!container) return;
    container.innerHTML = '<div class="shimmer-placeholder" style="height:200px"></div>';

    try {
      // 1. Obtener todas las categorías
      const catRes = await fetch('/api/categorias');
      const categorias = await catRes.json();

      // Filtrar páginas de navegación fijas y las que van al lateral derecho (Policiales y Curiosidades)
      const categoriasHome = categorias.filter(c => c.slug !== 'quienes-somos' && c.slug !== 'contacto' && c.slug !== 'policiales' && c.slug !== 'entretenimiento-y-curiosidades');

      container.innerHTML = '';
      let indexC = 0;
      let filaOcupada = 0; // Acumulador de columnas ocupadas (0 a 3)

      // 2. Para cada categoría, cargar noticias
      for (const cat of categoriasHome) {
        const limite = cat.limite_home || 3;
        const resNews = await fetch(`/api/noticias?categoria=${cat.slug}&limite=${limite}`);
        const noticias = await resNews.json();

        if (noticias.length === 0) continue; // Omitir categoría si no tiene noticias

        // Determinar span de columna según el diseño
        const diseno = cat.diseno_home || 'grid';
        let span = 3; // Por defecto ocupa todo (Carousel, Mosaic, Featured)
        if (diseno === 'grid') span = 2;
        if (diseno === 'list') span = 1;

        // Si agregar esta categoría excede el espacio de la fila actual (3 columnas),
        // rellenamos la fila actual con un anuncio del tamaño adecuado antes de colocarla
        if (filaOcupada > 0 && filaOcupada + span > 3) {
          const espacioLibre = 3 - filaOcupada;
          const adBlock = crearAdBlockGrid(espacioLibre);
          if (adBlock) {
            container.appendChild(adBlock);
          }
          filaOcupada = 0;
        }

        // Crear contenedor de bloque de categoría
        const sectionBlock = document.createElement('section');
        sectionBlock.className = `category-block cat-block-span-${span}`;
        
        // Agregar título de categoría con detalle de acento naranja
        sectionBlock.innerHTML = `<h2 class="category-title" style="border-left: 4px solid var(--color-orange); padding-left: 10px;">${cat.nombre}</h2>`;

        // Contenedor interno para los posts
        const postsContainer = document.createElement('div');
        
        if (diseno === 'carousel') {
          postsContainer.className = 'posts-carousel';
          noticias.forEach(noticia => {
            postsContainer.appendChild(createPostCardMarkup(noticia));
          });
        } else if (diseno === 'list') {
          postsContainer.className = 'posts-list';
          noticias.forEach(noticia => {
            postsContainer.appendChild(createPostListRowMarkup(noticia));
          });
        } else if (diseno === 'featured') {
          postsContainer.className = 'posts-featured-layout';
          
          // Primera nota destacada (Grande)
          const primaryPost = noticias[0];
          const primaryCard = createPostCardMarkup(primaryPost);
          postsContainer.appendChild(primaryCard);
          
          // Lista de notas a la derecha
          if (noticias.length > 1) {
            const listCol = document.createElement('div');
            listCol.className = 'posts-list';
            noticias.slice(1).forEach(noticia => {
              listCol.appendChild(createPostListRowMarkup(noticia));
            });
            postsContainer.appendChild(listCol);
          }
        } else if (diseno === 'mosaic') {
          postsContainer.className = 'posts-mosaic-layout';
          noticias.forEach(noticia => {
            postsContainer.appendChild(createPostCardMarkup(noticia));
          });
        } else if (diseno === 'large-image') {
          postsContainer.className = 'posts-large-image-layout';
          noticias.forEach(noticia => {
            postsContainer.appendChild(createPostLargeImageMarkup(noticia));
          });
        } else if (diseno === 'title-overlay') {
          postsContainer.className = 'posts-title-overlay-layout';
          noticias.forEach(noticia => {
            postsContainer.appendChild(createPostTitleOverlayMarkup(noticia));
          });
        } else if (diseno === 'carousel-infinite') {
          postsContainer.className = 'posts-carousel-infinite-container';
          
          const wrapper = document.createElement('div');
          wrapper.className = 'posts-carousel-infinite-wrapper';
          
          const track = document.createElement('div');
          track.className = 'posts-carousel-infinite-track';
          
          noticias.forEach(noticia => {
            track.appendChild(createPostCarouselInfiniteMarkup(noticia));
          });
          
          wrapper.appendChild(track);
          postsContainer.appendChild(wrapper);
        } else {
          // 'grid' (Por defecto)
          postsContainer.className = 'posts-grid';
          noticias.forEach(noticia => {
            postsContainer.appendChild(createPostCardMarkup(noticia));
          });
        }

        sectionBlock.appendChild(postsContainer);
        container.appendChild(sectionBlock);

        // Actualizar filaOcupada
        filaOcupada = (filaOcupada + span) % 3;
        indexC++;

        // Inyectar un banner publicitario intermedio cada 2 categorías cargadas
        if (indexC % 2 === 0) {
          let espacioAnuncio = 3 - filaOcupada; // Puede ser 1, 2 o 3 (si filaOcupada es 0)
          const adBlock = crearAdBlockGrid(espacioAnuncio);
          if (adBlock) {
            container.appendChild(adBlock);
          }
          filaOcupada = 0; // Al inyectar el anuncio para rellenar, la fila queda completa (0 col ocupadas)
        }
      }

      // Si al finalizar las categorías quedó un espacio libre en la última fila, colocar un anuncio para completarla
      if (filaOcupada > 0) {
        const espacioLibre = 3 - filaOcupada;
        const adBlock = crearAdBlockGrid(espacioLibre);
        if (adBlock) {
          container.appendChild(adBlock);
        }
      }

      // Inicializar carruseles infinitos después de renderizar todo el Home
      initInfiniteCarousels();

    } catch (err) {
      console.error('Error al cargar noticias de categorías dinámicas:', err);
      container.innerHTML = '<p class="text-muted">Error al cargar la portada del diario.</p>';
    }
  }

  function renderGrid(container, noticias) {
    container.innerHTML = '';
    if (noticias.length === 0) {
      container.innerHTML = '<p class="text-muted">No hay noticias en esta sección.</p>';
      return;
    }

    noticias.forEach(noticia => {
      const card = document.createElement('div');
      card.className = 'post-card';
      
      const defaultImg = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?q=80&w=400';
      const imagen = noticia.imagen_url || defaultImg;
      const fecha = new Date(noticia.fecha).toLocaleDateString('es-AR');
      const copete = noticia.copete || noticia.contenido.replace(/<[^>]*>/g, '').slice(0, 100) + '...';

      card.innerHTML = `
        <div class="post-card-thumb">
          <img src="${imagen}" alt="${noticia.titulo}">
        </div>
        <div class="post-card-body">
          <span class="post-card-category">${noticia.categoria_name}</span>
          <h3 class="post-card-title">${noticia.titulo}</h3>
          <p class="post-card-excerpt">${copete}</p>
          <div class="post-card-meta">
            <span>${fecha}</span>
            <span><i class="fa-regular fa-eye"></i> ${noticia.visitas}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => showArticleDetail(noticia.id));
      container.appendChild(card);
    });
  }

  function renderList(container, noticias) {
    container.innerHTML = '';
    if (noticias.length === 0) {
      container.innerHTML = '<p class="text-muted">No hay novedades.</p>';
      return;
    }

    noticias.forEach(noticia => {
      const item = document.createElement('div');
      item.className = 'post-list-item';
      
      const defaultImg = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?q=80&w=150';
      const imagen = noticia.imagen_url || defaultImg;
      const fecha = new Date(noticia.fecha).toLocaleDateString('es-AR');

      item.innerHTML = `
        <div class="post-list-thumb">
          <img src="${imagen}" alt="${noticia.titulo}">
        </div>
        <div class="post-list-content">
          <h4 class="post-list-title">${noticia.titulo}</h4>
          <span class="post-list-meta">${fecha}</span>
        </div>
      `;
      item.addEventListener('click', () => showArticleDetail(noticia.id));
      container.appendChild(item);
    });
  }

  // ==========================================
  // REPRODUCTORES DE AUDIO (RADIO STREAMING)
  // ==========================================

  async function fetchReproductoresAudio() {
    try {
      const res = await fetch('/api/reproductores');
      state.reproductores = await res.json();
      renderReproductores();
    } catch (error) {
      elements.audioContainer.innerHTML = '<p>Error al cargar streams de radio.</p>';
    }
  }

  function renderReproductores() {
    elements.audioContainer.innerHTML = '';
    
    if (state.reproductores.length === 0) {
      elements.audioContainer.innerHTML = '<p class="text-muted">No hay radios configuradas.</p>';
      return;
    }

    state.reproductores.forEach(radio => {
      const isPlaying = state.currentAudioId === radio.id;
      const card = document.createElement('div');
      card.className = 'audio-player-card';
      
      card.innerHTML = `
        <div class="audio-info">
          <span class="audio-title">${radio.nombre}</span>
          <span class="audio-status ${isPlaying ? 'playing' : ''}">${isPlaying ? 'Escuchando en vivo' : 'Desconectado'}</span>
        </div>
        <button class="audio-btn" data-id="${radio.id}">
          <i class="fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}"></i>
        </button>
      `;

      const btn = card.querySelector('.audio-btn');
      btn.addEventListener('click', () => handleAudioPlay(radio.id, radio.url_stream));
      
      elements.audioContainer.appendChild(card);
    });
  }

  function handleAudioPlay(radioId, urlStream) {
    // Si ya se está reproduciendo ESTA radio, la pausamos
    if (state.currentAudioId === radioId) {
      state.currentAudio.pause();
      state.currentAudio = null;
      state.currentAudioId = null;
      renderReproductores();
      return;
    }

    // Si hay otra radio reproduciéndose, la detenemos
    if (state.currentAudio) {
      state.currentAudio.pause();
    }

    // Creamos y reproducimos el nuevo audio
    console.log(`Conectando al stream: ${urlStream}`);
    
    // Mockeamos el reproductor de audio real si el stream es de ejemplo para evitar bloqueos
    let streamUrlToPlay = urlStream;
    if (urlStream.includes('stream.server.com')) {
      // Stream de radio público y real de ejemplo (Icecast de prueba o stream libre)
      streamUrlToPlay = 'https://stream.zeno.fm/f378w22129duv'; // URL real de stream musical
    }

    try {
      state.currentAudio = new Audio(streamUrlToPlay);
      state.currentAudio.play();
      state.currentAudioId = radioId;
      renderReproductores();
      
      state.currentAudio.addEventListener('error', (e) => {
        console.error('Error en el stream de audio, reintentando con fallback...');
        alert('El stream de audio no está disponible en este momento.');
        state.currentAudio = null;
        state.currentAudioId = null;
        renderReproductores();
      });
    } catch (err) {
      console.error(err);
    }
  }

  // ==========================================
  // NAVEGACIÓN Y DETALLES DE PÁGINA
  // ==========================================

  // Vista de Categoría Completa
  async function showCategoryPage(categorySlug) {
    showSection('category');
    elements.gridCategoryPosts.innerHTML = '<div class="shimmer-placeholder" style="height:250px; grid-column:1/4"></div>';
    
    try {
      // Buscar información de la categoría para poner el título correcto
      const catRes = await fetch('/api/categorias');
      const categorias = await catRes.json();
      const catObj = categorias.find(c => c.slug === categorySlug);
      elements.categoryPageTitle.textContent = catObj ? catObj.nombre : categorySlug.toUpperCase();

      // Buscar noticias de esta categoría
      const res = await fetch(`/api/noticias?categoria=${categorySlug}&limite=20`);
      const noticias = await res.json();
      
      renderCategoryGrid(noticias);
    } catch (error) {
      elements.gridCategoryPosts.innerHTML = '<p>Error al cargar las noticias de esta sección.</p>';
    }
  }

  function renderCategoryGrid(noticias) {
    elements.gridCategoryPosts.className = 'posts-grid-category-2col'; // Forzar 2 columnas
    elements.gridCategoryPosts.innerHTML = '';
    
    if (noticias.length === 0) {
      elements.gridCategoryPosts.innerHTML = '<p class="text-muted" style="grid-column: 1/3; text-align: center; padding: 40px 0;">No hay noticias publicadas en esta categoría actualmente.</p>';
      return;
    }

    noticias.forEach(noticia => {
      const card = document.createElement('div');
      card.className = 'post-card-horizontal';
      
      const defaultImg = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?q=80&w=400';
      const imagen = noticia.imagen_url || defaultImg;
      const fecha = new Date(noticia.fecha).toLocaleDateString('es-AR');
      const copete = noticia.copete || noticia.contenido.replace(/<[^>]*>/g, '').slice(0, 150) + '...';

      card.innerHTML = `
        <div class="post-card-horizontal-thumb">
          <img src="${imagen}" alt="${noticia.titulo}">
        </div>
        <div class="post-card-horizontal-body">
          <div>
            <span class="post-card-horizontal-category" style="color: var(--color-orange);">${noticia.categoria_nombre || noticia.categoria_name}</span>
            <h3 class="post-card-horizontal-title">${noticia.titulo}</h3>
            <p class="post-card-horizontal-excerpt">${copete}</p>
          </div>
          <div class="post-card-horizontal-meta">
            <span>${fecha}</span>
            <span><i class="fa-regular fa-eye"></i> ${noticia.visitas}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => showArticleDetail(noticia.id));
      elements.gridCategoryPosts.appendChild(card);
    });
  }

  // Mostrar Artículo Completo
  async function showArticleDetail(noticiaId) {
    showSection('detail');
    elements.articleDetailContent.innerHTML = '<div class="shimmer-placeholder" style="height:400px"></div>';
    
    try {
      const res = await fetch(`/api/noticias/${noticiaId}`);
      if (!res.ok) throw new Error();
      const noticia = await res.json();
      
      const defaultImg = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?q=80&w=800';
      const imagen = noticia.imagen_url || defaultImg;
      const fecha = new Date(noticia.fecha).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      let badgeHtml = noticia.url_original ? `<span class="editorial-tag"><a href="${noticia.url_original}" target="_blank"><i class="fa-solid fa-link"></i> Fuente Original</a></span>` : '';

      elements.articleDetailContent.innerHTML = `
        <div class="article-header">
          <div class="article-meta-top">
            <span>${noticia.categoria_name}</span>
            ${badgeHtml}
          </div>
          <h1 class="article-title">${noticia.titulo}</h1>
          <div class="article-meta-bottom">
            <div class="article-author-info">
              <i class="fa-regular fa-user"></i>
              <span>${noticia.autor}</span>
            </div>
            <span><i class="fa-regular fa-calendar"></i> ${fecha} | Lecturas: ${noticia.visitas}</span>
          </div>
        </div>
        
        <div class="article-main-image">
          <img src="${imagen}" alt="${noticia.titulo}">
        </div>
        
        <div class="article-body">
          ${noticia.contenido}
        </div>
      `;
      
      // Actualizar contadores del Home de forma transparente
      fetchNoticiasTicker();
    } catch (error) {
      elements.articleDetailContent.innerHTML = '<p>Error al cargar el artículo.</p>';
    }
  }

  // Quienes Somos
  function showQuienesSomos() {
    showSection('detail');
    elements.articleDetailContent.innerHTML = `
      <div class="article-header">
        <h1 class="article-title">Quiénes Somos</h1>
      </div>
      <div class="article-body">
        <p><strong>Pehuenia Online</strong> es el primer diario digital interactivo de Villa Pehuenia y Moquehue, fundado con el objetivo de informar con veracidad, rapidez y profesionalismo sobre todos los hechos acontecidos en nuestra cordillera.</p>
        <p>Brindamos cobertura periodística local, provincial y nacional, promoviendo la difusión turística y cultural de nuestra zona, preservando la belleza natural del entorno y su identidad cordillerana.</p>
        <blockquote>"Comprometidos con el desarrollo y la voz de la comunidad de Villa Pehuenia Moquehue."</blockquote>
      </div>
    `;
  }

  // Contacto
  function showContacto() {
    showSection('detail');
    elements.articleDetailContent.innerHTML = `
      <div class="article-header">
        <h1 class="article-title">Contacto</h1>
      </div>
      <div class="article-body">
        <p>¿Tienes alguna primicia, consulta publicitaria o sugerencia? Ponte en contacto con nosotros.</p>
        <br>
        <form class="editorial-card" style="display:flex; flex-direction:column; gap:16px; border:1px solid var(--border-color); padding:24px; border-radius:var(--border-radius-md); background-color:var(--bg-secondary)" id="contact-form">
          <div style="display:flex; flex-direction:column; gap:4px">
            <label style="font-size:0.75rem; font-weight:700">Nombre Completo</label>
            <input type="text" style="padding:10px; border:1px solid var(--border-color); border-radius:var(--border-radius-sm); outline:none" required>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <label style="font-size:0.75rem; font-weight:700">Email</label>
            <input type="email" style="padding:10px; border:1px solid var(--border-color); border-radius:var(--border-radius-sm); outline:none" required>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px">
            <label style="font-size:0.75rem; font-weight:700">Mensaje</label>
            <textarea rows="5" style="padding:10px; border:1px solid var(--border-color); border-radius:var(--border-radius-sm); outline:none; resize:none" required></textarea>
          </div>
          <button type="submit" style="background-color:var(--color-primary); color:var(--text-light); border:none; padding:12px; font-weight:700; border-radius:var(--border-radius-md); cursor:pointer">Enviar Mensaje</button>
        </form>
      </div>
    `;
    
    setTimeout(() => {
      const cForm = document.getElementById('contact-form');
      if (cForm) {
        cForm.addEventListener('submit', (e) => {
          e.preventDefault();
          alert('¡Tu mensaje ha sido enviado! Nos comunicaremos a la brevedad.');
          cForm.reset();
        });
      }
    }, 100);
  }

  // Búsqueda
  async function executeSearch() {
    const query = elements.searchInput.value.trim();
    if (!query) return;

    showSection('category');
    elements.categoryPageTitle.textContent = `Búsqueda: "${query}"`;
    elements.gridCategoryPosts.innerHTML = '<div class="shimmer-placeholder" style="height:250px; grid-column:1/4"></div>';

    try {
      const res = await fetch('/api/noticias?limite=50');
      const noticias = await res.json();
      const filtradas = noticias.filter(n => 
        n.titulo.toLowerCase().includes(query.toLowerCase()) || 
        n.contenido.toLowerCase().includes(query.toLowerCase())
      );
      renderCategoryGrid(filtradas);
    } catch (error) {
      elements.gridCategoryPosts.innerHTML = '<p>Error al procesar la búsqueda.</p>';
    }
  }

  // ==========================================
  // WIDGETS AUXILIARES (CLIMA Y COTIZACIÓN)
  // ==========================================

  // Clima de Villa Pehuenia
  async function setupWeather() {
    try {
      // Villa Pehuenia coord: lat -38.8789, lon -71.1803
      const weatherRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-38.8789&longitude=-71.1803&current_weather=true');
      const data = await weatherRes.json();
      
      if (data && data.current_weather) {
        const temp = Math.round(data.current_weather.temperature);
        elements.weatherTemp.textContent = `${temp}°C`;
        elements.weatherHum.textContent = `Viento: ${data.current_weather.windspeed} km/h`;
      }
    } catch (e) {
      // Fallback clima invernal cordillerano promedio
      elements.weatherTemp.textContent = `7°C`;
      elements.weatherHum.textContent = `Viento: 12 km/h`;
    }
  }

  // Cotizaciones Financieras
  async function setupRates() {
    try {
      const res = await fetch('https://dolarapi.com/v1/dolares');
      const data = await res.json();
      
      const oficial = data.find(d => d.casa === 'oficial');
      const blue = data.find(d => d.casa === 'blue');
      
      if (oficial) elements.rateDolarOficial.textContent = `$${oficial.venta}`;
      if (blue) elements.rateDolarBlue.textContent = `$${blue.venta}`;
    } catch (error) {
      // Fallback
      elements.rateDolarOficial.textContent = `$1020`;
      elements.rateDolarBlue.textContent = `$1280`;
    }
  }

  // ==========================================
  // LÓGICA DE PUBLICIDAD (BANNERS Y POPUPS)
  // ==========================================
  let publicidadesCargadas = [];

  async function fetchPublicidades() {
    try {
      const res = await fetch('/api/publicidades');
      publicidadesCargadas = await res.json();
      
      desplegarPublicidadesEstaticas();
      desplegarPopupPublicitario();
    } catch (err) {
      console.error('Error al cargar anuncios publicidades:', err);
    }
  }

  function obtenerPublicidadParaPosicion(posicion) {
    const filtro = publicidadesCargadas.filter(p => p.tipo === posicion && p.activo === 1);
    if (filtro.length === 0) return null;
    return filtro[Math.floor(Math.random() * filtro.length)];
  }

  function createAdMarkup(ad) {
    if (!ad) return '';
    
    const mediaHtml = ad.formato === 'video' 
      ? `<video src="${ad.url_archivo}" autoplay loop muted playsinline></video>`
      : `<img src="${ad.url_archivo}" alt="${ad.nombre}">`;

    return `
      <a href="${ad.url_destino}" target="_blank" class="ad-link">
        ${mediaHtml}
      </a>
    `;
  }

  function desplegarPublicidadesEstaticas() {
    // 1. Banner Superior
    const topAd = obtenerPublicidadParaPosicion('banner_1200x100') || obtenerPublicidadParaPosicion('banner_1200x200');
    const topContainer = document.getElementById('ad-top-banner');
    if (topAd && topContainer) {
      topContainer.className = topAd.tipo === 'banner_1200x200' ? 'ad-banner-1200x200' : 'ad-banner-1200x100';
      topContainer.innerHTML = createAdMarkup(topAd);
      topContainer.style.display = 'flex';
    }

    // 2. Banners Laterales (Posiciones 1 y 2)
    const sidebarAds = publicidadesCargadas.filter(p => p.tipo === 'banner_300x300' && p.activo === 1);
    
    const sidebarContainer1 = document.getElementById('ad-sidebar-banner-1');
    if (sidebarContainer1 && sidebarAds.length > 0) {
      sidebarContainer1.innerHTML = createAdMarkup(sidebarAds[0]);
      sidebarContainer1.style.display = 'flex';
    }

    const sidebarContainer2 = document.getElementById('ad-sidebar-banner-2');
    if (sidebarContainer2 && sidebarAds.length > 1) {
      sidebarContainer2.innerHTML = createAdMarkup(sidebarAds[1]);
      sidebarContainer2.style.display = 'flex';
    } else if (sidebarContainer2 && sidebarAds.length > 0) {
      sidebarContainer2.innerHTML = createAdMarkup(sidebarAds[0]);
      sidebarContainer2.style.display = 'flex';
    }
  }

  function desplegarPopupPublicitario() {
    const popupAd = obtenerPublicidadParaPosicion('popup');
    if (!popupAd) return;

    const overlay = document.getElementById('ad-popup-overlay');
    const body = document.getElementById('ad-popup-body');
    const closeBtn = document.getElementById('ad-popup-close');

    if (overlay && body && closeBtn) {
      const mediaHtml = popupAd.formato === 'video'
        ? `<video src="${popupAd.url_archivo}" autoplay loop muted playsinline></video>`
        : `<img src="${popupAd.url_archivo}" alt="${popupAd.nombre}">`;

      body.innerHTML = `
        <a href="${popupAd.url_destino}" target="_blank">
          ${mediaHtml}
        </a>
      `;

      // Mostrar popup después de 1.5 segundos
      setTimeout(() => {
        overlay.classList.add('active');
      }, 1500);

      closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    }
  }

  // ==========================================
  // HELPERS DE MAQUETADO DE NOTICIAS
  // ==========================================
  function createPostCardMarkup(noticia) {
    const card = document.createElement('div');
    card.className = 'post-card';
    
    const defaultImg = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?q=80&w=400';
    const imagen = noticia.imagen_url || defaultImg;
    const fecha = new Date(noticia.fecha).toLocaleDateString('es-AR');
    const copete = noticia.copete || noticia.contenido.replace(/<[^>]*>/g, '').slice(0, 100) + '...';

    card.innerHTML = `
      <div class="post-card-thumb">
        <img src="${imagen}" alt="${noticia.titulo}">
      </div>
      <div class="post-card-body">
        <span class="post-card-category" style="color: var(--color-orange);">${noticia.categoria_nombre || noticia.categoria_name}</span>
        <h3 class="post-card-title">${noticia.titulo}</h3>
        <p class="post-card-excerpt">${copete}</p>
        <div class="post-card-meta">
          <span>${fecha}</span>
          <span><i class="fa-regular fa-eye"></i> ${noticia.visitas}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => showArticleDetail(noticia.id));
    return card;
  }

  function createPostListRowMarkup(noticia) {
    const item = document.createElement('div');
    item.className = 'post-list-item';
    
    const defaultImg = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?q=80&w=150';
    const imagen = noticia.imagen_url || defaultImg;
    const fecha = new Date(noticia.fecha).toLocaleDateString('es-AR');

    item.innerHTML = `
      <div class="post-list-thumb">
        <img src="${imagen}" alt="${noticia.titulo}">
      </div>
      <div class="post-list-content">
        <h4 class="post-list-title">${noticia.titulo}</h4>
        <span class="post-list-meta">${fecha}</span>
      </div>
    `;
    item.addEventListener('click', () => showArticleDetail(noticia.id));
    return item;
  }

  function createPostLargeImageMarkup(noticia) {
    const card = document.createElement('div');
    card.className = 'post-card-large-image';
    
    const defaultImg = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?q=80&w=600';
    const imagen = noticia.imagen_url || defaultImg;
    const fecha = new Date(noticia.fecha).toLocaleDateString('es-AR');

    card.innerHTML = `
      <img src="${imagen}" alt="${noticia.titulo}">
      <div class="post-card-large-image-body">
        <span class="post-card-category" style="color: var(--color-orange);">${noticia.categoria_nombre || noticia.categoria_name}</span>
        <h3 class="post-card-large-image-title">${noticia.titulo}</h3>
        <div class="post-card-large-image-meta">
          <span>${fecha} | <i class="fa-regular fa-eye"></i> ${noticia.visitas}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => showArticleDetail(noticia.id));
    return card;
  }

  function createPostTitleOverlayMarkup(noticia) {
    const card = document.createElement('div');
    card.className = 'post-card-title-overlay';
    
    const defaultImg = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?q=80&w=600';
    const imagen = noticia.imagen_url || defaultImg;
    const fecha = new Date(noticia.fecha).toLocaleDateString('es-AR');

    card.innerHTML = `
      <img src="${imagen}" alt="${noticia.titulo}">
      <div class="post-card-title-overlay-content">
        <span class="post-card-title-overlay-cat">${noticia.categoria_nombre || noticia.categoria_name}</span>
        <h3 class="post-card-title-overlay-title">${noticia.titulo}</h3>
        <div class="post-card-title-overlay-meta">
          <span>${fecha} | <i class="fa-regular fa-eye"></i> ${noticia.visitas}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => showArticleDetail(noticia.id));
    return card;
  }

  function createPostCarouselInfiniteMarkup(noticia) {
    const card = document.createElement('div');
    card.className = 'post-card-carousel-infinite';
    
    const defaultImg = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?q=80&w=400';
    const imagen = noticia.imagen_url || defaultImg;
    const fecha = new Date(noticia.fecha).toLocaleDateString('es-AR');

    card.innerHTML = `
      <div class="post-card-carousel-infinite-thumb">
        <img src="${imagen}" alt="${noticia.titulo}">
      </div>
      <div class="post-card-carousel-infinite-body">
        <div>
          <span class="post-card-category" style="color: var(--color-orange); font-size: 0.6rem; display: block; margin-bottom: 2px;">${noticia.categoria_nombre || noticia.categoria_name}</span>
          <h3 class="post-card-carousel-infinite-title">${noticia.titulo}</h3>
        </div>
        <div class="post-card-carousel-infinite-meta">
          <span>${fecha}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => showArticleDetail(noticia.id));
    return card;
  }

  function initInfiniteCarousels() {
    const carousels = document.querySelectorAll('.posts-carousel-infinite-wrapper');
    carousels.forEach(wrapper => {
      const track = wrapper.querySelector('.posts-carousel-infinite-track');
      const cards = track.querySelectorAll('.post-card-carousel-infinite');
      if (cards.length <= 1) return;
      
      let currentIndex = 0;
      let intervalId = null;
      
      function getVisibleCount() {
        return window.innerWidth <= 768 ? 1 : 3;
      }
      
      function slide() {
        const visibleCount = getVisibleCount();
        const totalCount = cards.length;
        const maxIndex = Math.max(0, totalCount - visibleCount);
        
        currentIndex++;
        if (currentIndex > maxIndex) {
          currentIndex = 0;
        }
        
        const card = cards[0];
        const cardWidth = card.getBoundingClientRect().width;
        const gap = 24;
        const offset = currentIndex * (cardWidth + gap);
        
        track.style.transform = `translateX(-${offset}px)`;
      }
      
      function start() {
        stop();
        intervalId = setInterval(slide, 3000);
      }
      
      function stop() {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
      
      start();
      
      wrapper.addEventListener('mouseenter', stop);
      wrapper.addEventListener('mouseleave', start);
      
      window.addEventListener('resize', () => {
        currentIndex = 0;
        track.style.transform = 'translateX(0)';
      });
    });
  }

  // ==========================================
  // WIDGETS Y HELPERS ADICIONALES (4 COLUMNAS)
  // ==========================================

  // Crear bloque de anuncio para la grilla izquierda
  function crearAdBlockGrid(espacioColumnas) {
    let ad = null;
    let claseSpan = `ad-block-span-${espacioColumnas}`;
    
    if (espacioColumnas === 1) {
      ad = obtenerPublicidadParaPosicion('banner_300x300');
    } else if (espacioColumnas === 2) {
      ad = obtenerPublicidadParaPosicion('banner_700x100') || obtenerPublicidadParaPosicion('banner_700x200');
    } else {
      ad = obtenerPublicidadParaPosicion('banner_700x200') || obtenerPublicidadParaPosicion('banner_700x100');
    }

    if (!ad) return null;

    const div = document.createElement('div');
    div.className = `ad-block-container ${claseSpan}`;
    div.innerHTML = createAdMarkup(ad);
    return div;
  }

  // Clima Semanal a 5 días
  async function renderClimaSemanal() {
    const container = document.getElementById('weather-weekly-container');
    if (!container) return;
    
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-38.8789&longitude=-71.1803&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=America/Argentina/Salta');
      if (!res.ok) throw new Error();
      const data = await res.json();
      
      if (data && data.daily) {
        container.innerHTML = '';
        const weatherGrid = document.createElement('div');
        weatherGrid.className = 'weather-weekly-container';
        
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        
        for (let i = 0; i < 5; i++) {
          const date = new Date(data.daily.time[i] + 'T00:00:00');
          const dayName = diasSemana[date.getDay()];
          const maxTemp = Math.round(data.daily.temperature_2m_max[i]);
          const minTemp = Math.round(data.daily.temperature_2m_min[i]);
          const code = data.daily.weathercode[i];
          
          let iconClass = 'fa-sun';
          if ([1, 2, 3].includes(code)) iconClass = 'fa-cloud-sun';
          else if ([45, 48].includes(code)) iconClass = 'fa-smog';
          else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) iconClass = 'fa-cloud-showers-heavy';
          else if ([71, 73, 75, 77, 85, 86].includes(code)) iconClass = 'fa-snowflake';
          else if ([95, 96, 99].includes(code)) iconClass = 'fa-cloud-bolt';
          
          const dayDiv = document.createElement('div');
          dayDiv.className = 'weather-weekly-day';
          dayDiv.innerHTML = `
            <span class="weather-weekly-day-name">${dayName}</span>
            <i class="fa-solid ${iconClass} weather-weekly-icon"></i>
            <span class="weather-weekly-temps">${maxTemp}°/${minTemp}°</span>
          `;
          weatherGrid.appendChild(dayDiv);
        }
        container.appendChild(weatherGrid);
      }
    } catch (err) {
      console.error('Error al cargar clima semanal, cargando fallback...', err);
      renderClimaSemanalFallback(container);
    }
  }

  function renderClimaSemanalFallback(container) {
    container.innerHTML = `
      <div class="weather-weekly-container">
        <div class="weather-weekly-day">
          <span class="weather-weekly-day-name">Lun</span>
          <i class="fa-solid fa-cloud-sun weather-weekly-icon"></i>
          <span class="weather-weekly-temps">8°/2°</span>
        </div>
        <div class="weather-weekly-day">
          <span class="weather-weekly-day-name">Mar</span>
          <i class="fa-solid fa-snowflake weather-weekly-icon"></i>
          <span class="weather-weekly-temps">4°/-1°</span>
        </div>
        <div class="weather-weekly-day">
          <span class="weather-weekly-day-name">Mié</span>
          <i class="fa-solid fa-cloud-showers-heavy weather-weekly-icon"></i>
          <span class="weather-weekly-temps">6°/1°</span>
        </div>
        <div class="weather-weekly-day">
          <span class="weather-weekly-day-name">Jue</span>
          <i class="fa-solid fa-sun weather-weekly-icon"></i>
          <span class="weather-weekly-temps">9°/1°</span>
        </div>
        <div class="weather-weekly-day">
          <span class="weather-weekly-day-name">Vie</span>
          <i class="fa-solid fa-sun weather-weekly-icon"></i>
          <span class="weather-weekly-temps">11°/3°</span>
        </div>
      </div>
    `;
  }

  // Fixture Mundial
  function renderFixtureMundial() {
    const container = document.getElementById('fixture-container');
    if (!container) return;
    
    const partidos = [
      {
        equipoA: 'Argentina', flagA: 'ar', scoreA: 2,
        equipoB: 'Francia', flagB: 'fr', scoreB: 1,
        estado: 'Finalizado', fecha: 'Ayer'
      },
      {
        equipoA: 'Brasil', flagA: 'br', scoreA: 1,
        equipoB: 'Alemania', flagB: 'de', scoreB: 1,
        estado: 'En vivo', fecha: '72\''
      },
      {
        equipoA: 'España', flagA: 'es', scoreA: '-',
        equipoB: 'Italia', flagB: 'it', scoreB: '-',
        estado: 'Próximo', fecha: 'Hoy 20:00'
      }
    ];
    
    container.innerHTML = '';
    partidos.forEach(p => {
      const row = document.createElement('div');
      row.className = 'fixture-match-row';
      
      const scoreText = p.scoreA === '-' ? 'vs' : `${p.scoreA} - ${p.scoreB}`;
      const isLive = p.estado === 'En vivo';
      
      row.innerHTML = `
        <div class="fixture-team team-a">
          <span class="fixture-team-name">${p.equipoA}</span>
          <img src="https://flagcdn.com/w20/${p.flagA}.png" alt="${p.equipoA}" class="fixture-flag">
        </div>
        <div class="fixture-info">
          <span class="fixture-score" style="${isLive ? 'color: var(--color-orange);' : ''}">${scoreText}</span>
          <span class="fixture-date" style="${isLive ? 'color: var(--color-orange); font-weight:700;' : ''}">${isLive ? 'EN VIVO' : p.fecha}</span>
        </div>
        <div class="fixture-team team-b">
          <img src="https://flagcdn.com/w20/${p.flagB}.png" alt="${p.equipoB}" class="fixture-flag">
          <span class="fixture-team-name">${p.equipoB}</span>
        </div>
      `;
      container.appendChild(row);
    });
  }

  // Widget de Categoría Compacta en Barra Lateral
  async function renderSidebarCategory(categorySlug, containerId, iconClass) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    try {
      const catRes = await fetch('/api/categorias');
      const categorias = await catRes.json();
      
      let targetCat = categorias.find(c => c.slug === categorySlug);
      
      // Fallback si no encuentra la categoría deseada (solo para el sidebar principal compact)
      if (!targetCat && containerId === 'sidebar-compact-category') {
        targetCat = categorias.find(c => c.slug === 'mascotas') 
          || categorias.find(c => c.slug === 'internacionales')
          || categorias.find(c => c.slug !== 'quienes-somos' && c.slug !== 'contacto');
      }
        
      if (!targetCat) {
        container.style.display = 'none';
        return;
      }
      
      const res = await fetch(`/api/noticias?categoria=${targetCat.slug}&limite=3`);
      const noticias = await res.json();
      
      if (noticias.length === 0) {
        container.style.display = 'none';
        return;
      }
      
      container.style.display = 'block';
      container.innerHTML = `
        <h3 class="widget-title"><i class="${iconClass || 'fa-solid fa-list-ul'}"></i> ${targetCat.nombre}</h3>
        <div class="compact-posts-list"></div>
      `;
      
      const listContainer = container.querySelector('.compact-posts-list');
      const defaultImg = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?q=80&w=150';
      
      noticias.forEach(n => {
        const item = document.createElement('div');
        item.className = 'compact-post-item';
        
        const imagen = n.imagen_url || defaultImg;
        const fecha = new Date(n.fecha).toLocaleDateString('es-AR');
        
        item.innerHTML = `
          <div class="compact-post-thumb">
            <img src="${imagen}" alt="${n.titulo}">
          </div>
          <div class="compact-post-content">
            <h4 class="compact-post-title">${n.titulo}</h4>
            <span class="compact-post-meta">${fecha}</span>
          </div>
        `;
        
        item.addEventListener('click', () => showArticleDetail(n.id));
        listContainer.appendChild(item);
      });
      
    } catch (err) {
      console.error(`Error al cargar categoría compacta ${categorySlug}:`, err);
      container.style.display = 'none';
    }
  }

  // Ejecutar al cargar la app
  init();
});
