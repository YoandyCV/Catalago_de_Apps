
// CONFIGURACIÓN DEL CONTADOR
// ============================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzI8xdX1RDMHa3Dy86UK410123d2gEyZgWnuEhL0jpFiRL9DN8S55QCqVNO4glTXtEU/exec';

// ============================================
// FUNCIONES JSONP
// ============================================
function peticionJSONP(url, callbackName, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const timeoutId = setTimeout(() => {
            reject(new Error('Timeout JSONP'));
            if (document.head.contains(script)) document.head.removeChild(script);
            delete window[callbackName];
        }, timeout);
        
        window[callbackName] = function(data) {
            clearTimeout(timeoutId);
            resolve(data);
            delete window[callbackName];
            if (document.head.contains(script)) document.head.removeChild(script);
        };
        
        const separator = url.includes('?') ? '&' : '?';
        script.src = `${url}${separator}callback=${callbackName}&t=${Date.now()}`;
        script.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Error de red JSONP'));
            delete window[callbackName];
            if (document.head.contains(script)) document.head.removeChild(script);
        };
        document.head.appendChild(script);
    });
}

// ============================================
// CONTADOR (usando JSONP)
// ============================================
async function obtenerContadorReal(appId) {
    try {
        const url = `${SCRIPT_URL}?app=${encodeURIComponent(appId)}&mode=get`;
        const callback = `jsonp_get_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const data = await peticionJSONP(url, callback);
        const contador = parseInt(data, 10);
        return isNaN(contador) ? 0 : contador;
    } catch (error) {
        console.error(`Error obteniendo contador para ${appId}:`, error);
        const local = localStorage.getItem(`count_${appId}`);
        return local ? parseInt(local, 10) : 0;
    }
}

async function incrementarContador(appId) {
    try {
        const url = `${SCRIPT_URL}?app=${encodeURIComponent(appId)}&mode=inc`;
        const callback = `jsonp_inc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const data = await peticionJSONP(url, callback);
        const nuevoContador = parseInt(data, 10);
        if (!isNaN(nuevoContador)) {
            localStorage.setItem(`count_${appId}`, nuevoContador);
            return nuevoContador;
        }
        throw new Error('Respuesta inválida');
    } catch (error) {
        console.error(`Error al incrementar ${appId}:`, error);
        const actual = localStorage.getItem(`count_${appId}`);
        const nuevo = (actual ? parseInt(actual, 10) : 0) + 1;
        localStorage.setItem(`count_${appId}`, nuevo);
        return nuevo;
    }
}

// ============================================
// MANEJADOR DE DESCARGA
// ============================================
async function handleDl(id, url) {
    console.log(`Descargando: ${id}`);
    const nuevoValor = await incrementarContador(id);
    
    const countSpan = document.getElementById(`count-${id}`);
    if (countSpan && nuevoValor !== null) {
        countSpan.innerHTML = `⬇️ ${nuevoValor} descargas`;
    }
    
    if (url && url !== '#') {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert('❌ URL de descarga no disponible');
    }
}

// ============================================
// CARGA Y RENDERIZADO DE APPS
// ============================================
async function loadApps() {
    const grid = document.getElementById('appsContainer');
    if (!grid) {
        console.error('No se encontró el contenedor appsContainer');
        return;
    }
    
    console.log('Cargando aplicaciones...');
    grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Sincronizando base de datos...</p></div>';
    
    try {
        const res = await fetch('apps.json');
        if (!res.ok) throw new Error(`No se pudo cargar apps.json: ${res.status}`);
        const apps = await res.json();
        
        if (!Array.isArray(apps) || apps.length === 0) {
            grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:2rem;">📭 No hay aplicaciones disponibles</p>';
            return;
        }
        
        // Obtener contadores reales en paralelo
        const promesasContadores = apps.map(app => obtenerContadorReal(app.id));
        const contadoresReales = await Promise.all(promesasContadores);
        
        // Guardar en localStorage
        apps.forEach((app, i) => {
            localStorage.setItem(`count_${app.id}`, contadoresReales[i]);
        });
        
        grid.innerHTML = '';
        
        for (let i = 0; i < apps.length; i++) {
            const app = apps[i];
            if (!app.id || !app.nombre) continue;
            
            const descargas = contadoresReales[i];
            
            const card = document.createElement('div');
            card.className = 'app-card';
            
            let iconoHtml = '';
            if (app.iconoUrl && app.iconoUrl.trim() !== '') {
                iconoHtml = `<img src="${escapeHtml(app.iconoUrl)}" alt="${escapeHtml(app.nombre)}" class="app-icon-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` +
                           `<div style="font-size:2.5rem; margin-bottom:1rem; display:none;">${escapeHtml(app.iconoEmoji || '⚙️')}</div>`;
            } else {
                iconoHtml = `<div style="font-size:2.5rem; margin-bottom:1rem;">${escapeHtml(app.iconoEmoji || '⚙️')}</div>`;
            }
            
            let descripcionCorta = app.descripcion || 'Sin descripción disponible';
            let tieneMasTexto = descripcionCorta.length > 80;
            if (tieneMasTexto) descripcionCorta = descripcionCorta.substring(0, 80) + '...';
            
            card.innerHTML = `
                <div class="card-info">
                    ${iconoHtml}
                    <h3>${escapeHtml(app.nombre)}</h3>
                    <p class="card-description">${escapeHtml(descripcionCorta)}${tieneMasTexto ? ' <span class="more-indicator">🔍</span>' : ''}</p>
                    <div class="card-meta">
                        <span class="size-tag">📦 ${escapeHtml(app.tamaño || 'Desconocido')}</span>
                        <span class="download-count" id="count-${escapeHtml(app.id)}">⬇️ ${descargas} descargas</span>
                    </div>
                </div>
                <div class="card-buttons">
                    <button class="btn-info" data-id="${escapeHtml(app.id)}">🔍 Detalles</button>
                    <button class="btn-dl" data-id="${escapeHtml(app.id)}" data-url="${escapeHtml(app.urlDescarga || '#')}">⛓️ Descargar</button>
                </div>
            `;
            
            grid.appendChild(card);
        }
        
        // Eventos de descarga
        document.querySelectorAll('.btn-dl').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const url = btn.getAttribute('data-url');
                handleDl(id, url);
            });
        });
        
        // Eventos de detalles
        document.querySelectorAll('.btn-info').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const res = await fetch('apps.json');
                const appsData = await res.json();
                const appCompleta = appsData.find(a => a.id === id);
                if (appCompleta) showAppDetails(appCompleta);
            });
        });
        
        console.log('Apps renderizadas correctamente');
        
    } catch (err) {
        console.error('Error en loadApps:', err);
        grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:2rem;">⚠️ Error: ${escapeHtml(err.message)}</p>`;
    }
}

// ============================================
// MODAL DE DETALLES
// ============================================
function showAppDetails(app) {
    const detalles = app.detalles || {
        version: "1.0",
        fecha: "No especificada",
        requisitos: "No especificados",
        categorias: ["General"],
        capturas: [],
        caracteristicas: ["✔️ Funcionalidad principal", "✔️ Interfaz intuitiva"]
    };
    
    const screenshots = detalles.capturas || [];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    let carouselHtml = '';
    if (screenshots.length > 0) {
        carouselHtml = `
            <div class="screenshots-carousel">
                ${screenshots.map((src, idx) => `
                    <div class="screenshot-item">
                        <img src="${escapeHtml(src)}" alt="Captura ${idx + 1}" class="screenshot-img" onerror="this.parentElement.innerHTML='<div class=\\'screenshot-placeholder\\'>📷<br>Sin imagen</div>'">
                    </div>
                `).join('')}
            </div>
            <div class="carousel-nav">
                <button class="carousel-prev">◀</button>
                <span class="carousel-counter">1 / ${screenshots.length}</span>
                <button class="carousel-next">▶</button>
            </div>
        `;
    } else {
        carouselHtml = `
            <div class="screenshots-placeholder">
                <div class="placeholder-icon">📸</div>
                <p>Capturas de pantalla próximamente</p>
                <small>Pronto añadiremos imágenes de esta app</small>
            </div>
        `;
    }
    
    const caracteristicasHtml = (detalles.caracteristicas || []).map(c => `<li>${escapeHtml(c)}</li>`).join('');
    
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-container">
            <button class="modal-close">✕</button>
            <div class="modal-header">
                <div class="modal-icon">${escapeHtml(app.iconoEmoji || '📱')}</div>
                <h2>${escapeHtml(app.nombre)}</h2>
                <div class="modal-badge">Versión ${escapeHtml(detalles.version)}</div>
            </div>
            <div class="modal-body">
                <div class="modal-description">
                    <h3>📝 Descripción</h3>
                    <p>${escapeHtml(app.descripcion)}</p>
                </div>
                <div class="modal-screenshots">
                    <h3>📸 Capturas de pantalla</h3>
                    ${carouselHtml}
                </div>
                <div class="modal-info-grid">
                    <div class="info-card">
                        <h4>📊 Información técnica</h4>
                        <ul class="info-list">
                            <li><strong>Tamaño:</strong> ${escapeHtml(app.tamaño || 'Desconocido')}</li>
                            <li><strong>Versión:</strong> ${escapeHtml(detalles.version)}</li>
                            <li><strong>Fecha:</strong> ${escapeHtml(detalles.fecha)}</li>
                            <li><strong>Requisitos:</strong> ${escapeHtml(detalles.requisitos)}</li>
                            <li><strong>Categorías:</strong> ${(detalles.categorias || []).map(c => `<span class="category-tag">${escapeHtml(c)}</span>`).join('')}</li>
                        </ul>
                    </div>
                    <div class="info-card">
                        <h4>✨ Características</h4>
                        <ul class="features-list">${caracteristicasHtml}</ul>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-dl-modal" data-id="${escapeHtml(app.id)}" data-url="${escapeHtml(app.urlDescarga)}">
                    ⛓️ Descargar ahora (${escapeHtml(app.tamaño || 'Desconocido')})
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Carrusel
    if (screenshots.length > 0) {
        const carousel = modal.querySelector('.screenshots-carousel');
        const prevBtn = modal.querySelector('.carousel-prev');
        const nextBtn = modal.querySelector('.carousel-next');
        const counter = modal.querySelector('.carousel-counter');
        let currentIndex = 0;
        
        const updateCarousel = () => {
            const itemWidth = carousel.querySelector('.screenshot-item')?.offsetWidth + 16 || 0;
            carousel.scrollTo({ left: currentIndex * itemWidth, behavior: 'smooth' });
            if (counter) counter.textContent = `${currentIndex + 1} / ${screenshots.length}`;
        };
        
        prevBtn?.addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; updateCarousel(); } });
        nextBtn?.addEventListener('click', () => { if (currentIndex < screenshots.length - 1) { currentIndex++; updateCarousel(); } });
        
        carousel?.addEventListener('scroll', () => {
            const scrollPos = carousel.scrollLeft;
            const itemWidth = carousel.querySelector('.screenshot-item')?.offsetWidth + 16 || 0;
            const newIndex = Math.round(scrollPos / itemWidth);
            if (newIndex !== currentIndex && newIndex >= 0 && newIndex < screenshots.length) {
                currentIndex = newIndex;
                if (counter) counter.textContent = `${currentIndex + 1} / ${screenshots.length}`;
            }
        });
    }
    
    // Cerrar modal
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); }, { once: true });
    
    // Descarga desde modal
    modal.querySelector('.btn-dl-modal').addEventListener('click', async (e) => {
        await handleDl(app.id, app.urlDescarga);
        closeModal();
    });
}

// ============================================
// UTILIDADES
// ============================================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado correctamente');
    
    const menuBtn = document.getElementById('menuToggle');
    const side = document.getElementById('sidebar');
    if (menuBtn && side) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            side.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (side.classList.contains('open') && !side.contains(e.target) && e.target !== menuBtn) {
                side.classList.remove('open');
            }
        });
    }
    
    loadApps();
});