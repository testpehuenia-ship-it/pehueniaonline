// Lógica del Content Importer (WPeMatico-style) - Pehuenia Online

document.addEventListener('DOMContentLoaded', () => {
  // Estado
  let categorias = [];

  // Elementos
  const el = {
    campanasTableBody: document.getElementById('campanas-table-body'),
    btnNuevaCampana: document.getElementById('btn-nueva-campana'),
    btnGuardarCampana: document.getElementById('btn-guardar-campana'),
    
    // Inputs del Modal Campaña
    formCampana: document.getElementById('form-campana'),
    campanaId: document.getElementById('campana-id'),
    campanaNombre: document.getElementById('campana-nombre'),
    campanaFeed: document.getElementById('campana-feed'),
    campanaCategoria: document.getElementById('campana-categoria'),
    campanaLimite: document.getElementById('campana-limite'),
    campanaFrecuencia: document.getElementById('campana-frecuencia'),
    campanaEstado: document.getElementById('campana-estado'),
    campanaAutoReformular: document.getElementById('campana-auto-reformular'),
    campanaAutoPublicar: document.getElementById('campana-auto-publicar'),
    
    modalTitle: document.getElementById('modal-campana-title')
  };

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  async function init() {
    setupEventListeners();
    await fetchCategorias();
    fetchCampanasList();
  }

  function setupEventListeners() {
    el.btnNuevaCampana.addEventListener('click', () => abrirModalCampana());
    el.btnGuardarCampana.addEventListener('click', guardarCampaña);
  }

  // ==========================================
  // OBTENER CATEGORÍAS Y CAMPAÑAS
  // ==========================================

  async function fetchCategorias() {
    try {
      const res = await fetch('/api/categorias');
      categorias = await res.json();
      
      el.campanaCategoria.innerHTML = '';
      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        el.campanaCategoria.appendChild(option);
      });
    } catch (e) {
      console.error('Error al cargar categorías');
    }
  }

  async function fetchCampanasList() {
    try {
      const res = await fetch('/api/admin/campanas');
      const campanas = await res.json();
      
      el.campanasTableBody.innerHTML = '';
      if (campanas.length === 0) {
        el.campanasTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center">No hay campañas de importación configuradas.</td></tr>';
        return;
      }

      campanas.forEach(c => {
        const tr = document.createElement('tr');
        
        const fecha = c.ultima_ejecucion 
          ? new Date(c.ultima_ejecucion).toLocaleDateString('es-AR', { hour: '2-digit', minute: '2-digit' }) 
          : 'Nunca';
        
        const isActiva = c.estado === 'activa';
        const badgeState = isActiva ? 'badge-active' : 'badge-paused';
        const labelState = isActiva ? 'Activa' : 'Pausada';

        const pubMode = c.auto_publicar === 1 ? 'badge-published' : 'badge-draft';
        const pubLabel = c.auto_publicar === 1 ? 'Publicado' : 'Borrador';

        const reformularLabel = c.auto_reformular === 1 
          ? '<span style="color:var(--color-success); font-weight:700"><i class="fa-solid fa-check"></i> Activo</span>' 
          : '<span style="color:var(--text-muted)">No</span>';

        const frecuenciaTexto = c.frecuencia_minutos >= 60 
          ? `Cada ${Math.floor(c.frecuencia_minutos / 60)} hora(s)` 
          : `Cada ${c.frecuencia_minutos} minutos`;

        tr.innerHTML = `
          <td style="font-weight:600">${c.nombre}</td>
          <td style="font-size:0.75rem; color:var(--text-muted); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${c.url_feed}">
            ${c.url_feed}
          </td>
          <td>${c.categoria_nombre}</td>
          <td><span class="badge ${pubMode}">${pubLabel}</span></td>
          <td>${frecuenciaTexto}</td>
          <td style="text-align:center">${reformularLabel}</td>
          <td>${fecha}</td>
          <td><span class="badge ${badgeState}">${labelState}</span></td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-success btn-ejecutar" title="Ejecutar Importación Ahora" style="padding:4px 8px; font-size:0.75rem;">
                <i class="fa-solid fa-play"></i>
              </button>
              <button class="btn btn-outline btn-toggle-estado" title="${isActiva ? 'Pausar campaña' : 'Reactivar campaña'}" style="padding:4px 8px; font-size:0.75rem;">
                <i class="fa-solid ${isActiva ? 'fa-pause' : 'fa-play-circle'}"></i>
              </button>
              <button class="btn btn-outline btn-editar" title="Editar Campaña" style="padding:4px 8px; font-size:0.75rem;">
                <i class="fa-regular fa-pen-to-square"></i>
              </button>
              <button class="btn btn-danger btn-eliminar" title="Eliminar Campaña" style="padding:4px 8px; font-size:0.75rem;">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </td>
        `;

        // Bind events
        const btnEjecutar = tr.querySelector('.btn-ejecutar');
        btnEjecutar.addEventListener('click', () => ejecutarCampañaManual(c.id, btnEjecutar));
        
        tr.querySelector('.btn-toggle-estado').addEventListener('click', () => toggleCampañaEstado(c));
        tr.querySelector('.btn-editar').addEventListener('click', () => abrirModalCampana(c));
        tr.querySelector('.btn-eliminar').addEventListener('click', () => eliminarCampaña(c.id));

        el.campanasTableBody.appendChild(tr);
      });
    } catch (e) {
      el.campanasTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--color-danger)">Error al cargar campañas.</td></tr>';
    }
  }

  // ==========================================
  // GESTIÓN DE CAMPAÑAS (CRUD Y EJECUCIÓN)
  // ==========================================

  function abrirModalCampana(campana = null) {
    el.formCampana.reset();
    
    if (campana) {
      el.modalTitle.textContent = 'Editar Campaña';
      el.campanaId.value = campana.id;
      el.campanaNombre.value = campana.nombre;
      el.campanaFeed.value = campana.url_feed;
      el.campanaCategoria.value = campana.categoria_id;
      el.campanaLimite.value = campana.limite_por_ejecucion;
      el.campanaFrecuencia.value = campana.frecuencia_minutos;
      el.campanaEstado.value = campana.estado;
      el.campanaAutoReformular.checked = campana.auto_reformular === 1;
      el.campanaAutoPublicar.checked = campana.auto_publicar === 1;
    } else {
      el.modalTitle.textContent = 'Agregar Nueva Campaña';
      el.campanaId.value = '';
      el.campanaLimite.value = 5;
      el.campanaFrecuencia.value = 60;
      el.campanaEstado.value = 'activa';
      el.campanaAutoReformular.checked = true; // Habilitar IA por defecto
      el.campanaAutoPublicar.checked = false; // Guardar como borrador por defecto para prueba
    }

    abrirModal('modal-campana');
  }

  async function guardarCampaña(e) {
    e.preventDefault();
    
    const id = el.campanaId.value;
    const payload = {
      nombre: el.campanaNombre.value.trim(),
      url_feed: el.campanaFeed.value.trim(),
      categoria_id: parseInt(el.campanaCategoria.value),
      limite_por_ejecucion: parseInt(el.campanaLimite.value),
      frecuencia_minutos: parseInt(el.campanaFrecuencia.value),
      estado: el.campanaEstado.value,
      auto_reformular: el.campanaAutoReformular.checked ? 1 : 0,
      auto_publicar: el.campanaAutoPublicar.checked ? 1 : 0
    };

    if (!payload.nombre || !payload.url_feed) {
      alert('Por favor completa el nombre y el feed de la campaña.');
      return;
    }

    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/admin/campanas/${id}` : '/api/admin/campanas';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(id ? 'Campaña modificada correctamente.' : 'Campaña creada correctamente.');
        cerrarModal('modal-campana');
        fetchCampanasList();
      } else {
        alert('Error al guardar la campaña.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al conectar con el servidor.');
    }
  }

  async function toggleCampañaEstado(campana) {
    const nuevoEstado = campana.estado === 'activa' ? 'pausada' : 'activa';
    const payload = { ...campana, estado: nuevoEstado };
    
    try {
      const res = await fetch(`/api/admin/campanas/${campana.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchCampanasList();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function eliminarCampaña(id) {
    if (!confirm('¿Seguro que deseas eliminar esta campaña de importación?')) return;

    try {
      const res = await fetch(`/api/admin/campanas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Campaña eliminada correctamente.');
        fetchCampanasList();
      } else {
        alert('Error al eliminar la campaña.');
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Ejecutar manualmente la campaña RSS
  async function ejecutarCampañaManual(id, btnElement) {
    // Desactivar botón y cambiar a spinner
    const originalHtml = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    try {
      const res = await fetch(`/api/admin/campanas/${id}/ejecutar`, { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        const importados = data.resultado.importados !== undefined ? data.resultado.importados : 0;
        alert(`Campaña completada. Se han importado ${importados} noticias nuevas.`);
        fetchCampanasList();
      } else {
        alert(`Error al ejecutar la campaña: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al ejecutar campaña.');
    } finally {
      // Reactivar botón
      btnElement.disabled = false;
      btnElement.innerHTML = originalHtml;
    }
  }

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
