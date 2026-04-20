// Configuracion DEL SCRIPT
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzI8xdX1RDMHa3Dy86UK410123d2gEyZgWnuEhL0jpFiRL9DN8S55QCqVNO4glTXtEU/exec';

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado correctamente');
    
    const menuBtn = document.getElementById('menuToggle');
    const side = document.getElementById('sidebar');

    if (menuBtn && side) {
        menuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            side.classList.toggle('open');
        });

        document.addEventListener('click', function(e) {
            if (side.classList.contains('open') && !side.contains(e.target) && e.target !== menuBtn) {
                side.classList.remove('open');
            }
        });
    }

    loadApps();
});

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
        if (!res.ok) throw new Error('No se pudo cargar apps.json: ' + res.status);
        
        const textContent = await res.text();
        let data = [];
        
        try {
            data = JSON.parse(textContent);
            console.log('JSON parseado correctamente, apps:', data.length);
        } catch (jsonError) {
            console.error('Error de sintaxis JSON:', jsonError.message);
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:2rem; background:#1e293b; border-radius:1rem;">
                    <h3>⚠️ Error en el archivo de datos</h3>
                    <p>${escapeHtml(jsonError.message)}</p>
                    <small>Revisa la sintaxis del archivo apps.json</small>
                </div>
            `;
            return;
        }
        
        if (!Array.isArray(data) || data.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 2rem;">📭 No hay aplicaciones disponibles</p>';
            return;
        }
        
        grid.innerHTML = '';
        
        for (let i = 0; i < data.length; i++) {
            const app = data[i];
            
            if (!app.id || !app.nombre) {
                console.warn('App inválida omitida:', app);
                continue;
            }
            
            let descargas = 0;
            const savedCount = localStorage.getItem('count_' + app.id);
            if (savedCount) {
                descargas = parseInt(savedCount);
            }
            
            const card = document.createElement('div');
            card.className = 'app-card';
            
            let iconoHtml = '';
            if (app.iconoUrl && app.iconoUrl.trim() !== '') {
                iconoHtml = '<img src="' + escapeHtml(app.iconoUrl) + '" alt="' + escapeHtml(app.nombre) + '" class="app-icon-img" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\';">' +
                           '<div style="font-size: 2.5rem; margin-bottom: 1rem; display: none;">' + (app.iconoEmoji || '⚙️') + '</div>';
            } else {
                iconoHtml = '<div style="font-size: 2.5rem; margin-bottom: 1rem;">' + (app.iconoEmoji || '⚙️') + '</div>';
            }
            
            // Descripción CORTA para la tarjeta (máximo 80 caracteres)
            let descripcionParaTarjeta = app.descripcion || 'Sin descripción disponible';
            let tieneMasTexto = descripcionParaTarjeta.length > 80;
            
            if (descripcionParaTarjeta.length > 80) {
                descripcionParaTarjeta = descripcionParaTarjeta.substring(0, 80) + '...';
            }
            
            card.innerHTML = 
                '<div class="card-info">' +
                    iconoHtml +
                    '<h3>' + escapeHtml(app.nombre) + '</h3>' +
                    '<p class="card-description">' + escapeHtml(descripcionParaTarjeta) + (tieneMasTexto ? ' <span class="more-indicator">🔍</span>' : '') + '</p>' +
                    '<div class="card-meta">' +
                        '<span class="size-tag">📦 ' + escapeHtml(app.tamaño || 'Desconocido') + '</span>' +
                        '<span class="download-count" id="count-' + app.id + '">⬇️ ' + descargas + ' descargas</span>' +
                    '</div>' +
                '</div>' +
                '<div class="card-buttons">' +
                    '<button class="btn-info" data-id="' + escapeHtml(app.id) + '">' +
                        '🔍 Detalles' +
                    '</button>' +
                    '<button class="btn-dl" data-id="' + escapeHtml(app.id) + '" data-url="' + escapeHtml(app.urlDescarga || '#') + '">' +
                        '⛓️ Descargar' +
                    '</button>' +
                '</div>';
            
            grid.appendChild(card);
        }
        
        // Event listeners para descargas
        document.querySelectorAll('.btn-dl').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const url = btn.getAttribute('data-url');
                if (url && url !== '#') {
                    handleDl(id, url);
                } else {
                    alert('❌ URL de descarga no disponible');
                }
            });
        });
        
        // Event listeners para detalles (ahora busca la app completa en los datos)
        document.querySelectorAll('.btn-info').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                
                // Buscar la app completa en los datos originales
                const res = await fetch('apps.json');
                const textContent = await res.text();
                const apps = JSON.parse(textContent);
                const app = apps.find(a => a.id === id);
                
                if (app) {
                    showAppDetails(app);
                }
            });
        });
        
        console.log('Apps renderizadas correctamente');
        
    } catch (err) {
        console.error('Error en loadApps:', err);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 2rem;">⚠️ Error: ' + escapeHtml(err.message) + '</p>';
    }
}

async function incrementarContador(appId) {
    try {
        const url = SCRIPT_URL + '?app=' + encodeURIComponent(appId) + '&mode=inc&t=' + Date.now();
        fetch(url, { mode: 'no-cors' }).catch(e => console.log('Error en fetch:', e));
        
        const current = localStorage.getItem('count_' + appId);
        const newCount = (current ? parseInt(current) : 0) + 1;
        localStorage.setItem('count_' + appId, newCount);
        
        return newCount;
    } catch (error) {
        console.error('Error al incrementar contador:', error);
        const current = localStorage.getItem('count_' + appId);
        const newCount = (current ? parseInt(current) : 0) + 1;
        localStorage.setItem('count_' + appId, newCount);
        return newCount;
    }
}

async function handleDl(id, url) {
    console.log('Descargando:', id, url);
    
    const nuevoValor = await incrementarContador(id);
    
    const countSpan = document.getElementById('count-' + id);
    if (countSpan && nuevoValor !== null) {
        countSpan.innerHTML = '⬇️ ' + nuevoValor + ' descargas';
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showAppDetails(app) {
    // Obtener detalles (con fallbacks por si no existen)
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
                        <img src="${escapeHtml(src)}" 
                             alt="Captura ${idx + 1}" 
                             class="screenshot-img"
                             onerror="this.parentElement.innerHTML='<div class=\\'screenshot-placeholder\\'>📷<br>Sin imagen</div>'">
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
    
    // Configurar carrusel
    if (screenshots.length > 0) {
        const carousel = modal.querySelector('.screenshots-carousel');
        const prevBtn = modal.querySelector('.carousel-prev');
        const nextBtn = modal.querySelector('.carousel-next');
        const counter = modal.querySelector('.carousel-counter');
        let currentIndex = 0;
        
        const updateCarousel = () => {
            if (carousel) {
                const itemWidth = carousel.querySelector('.screenshot-item')?.offsetWidth + 16 || 0;
                carousel.scrollTo({ left: currentIndex * itemWidth, behavior: 'smooth' });
                if (counter) counter.textContent = `${currentIndex + 1} / ${screenshots.length}`;
            }
        };
        
        if (prevBtn) prevBtn.addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; updateCarousel(); } });
        if (nextBtn) nextBtn.addEventListener('click', () => { if (currentIndex < screenshots.length - 1) { currentIndex++; updateCarousel(); } });
        
        if (carousel) {
            carousel.addEventListener('scroll', () => {
                const scrollPos = carousel.scrollLeft;
                const itemWidth = carousel.querySelector('.screenshot-item')?.offsetWidth + 16 || 0;
                const newIndex = Math.round(scrollPos / itemWidth);
                if (newIndex !== currentIndex && newIndex >= 0 && newIndex < screenshots.length) {
                    currentIndex = newIndex;
                    if (counter) counter.textContent = `${currentIndex + 1} / ${screenshots.length}`;
                }
            });
        }
    }
    
    // Cerrar modal
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); }, { once: true });
    
    // Descargar desde modal
    modal.querySelector('.btn-dl-modal').addEventListener('click', async (e) => {
        await handleDl(app.id, app.urlDescarga);
        closeModal();
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}