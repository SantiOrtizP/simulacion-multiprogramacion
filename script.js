const NUM_PROCESOS = 10;
const QUANTUM = 10;
const INTERVALO = 500; // milisegundos por turno
const LATENCIA_BLOQUEO = 2; // Estará bloqueado por 2 * 500ms = 1 segundo (2 intervalos)
const MIN_UNIDADES_POR_SEGMENTO = 5; // Mínimo de unidades que debe tener cada E/S.
const NUM_SEGMENTOS_REQUERIDOS = 4; // Cantidad de E/S forzosas.
const colors = ['#BB4119', '#41BB19', '#1993BB', '#4119BB'];

function generarProcesos() {
    const procesos = [];

    for (let i = 0; i < NUM_PROCESOS; i++) {
        // Rango de 100 a 200 unidades
        const limiteTotal = Math.floor(Math.random() * 101) + 100;
        const entradas = [];
        
        const espacioMinimoTotal = MIN_UNIDADES_POR_SEGMENTO * NUM_SEGMENTOS_REQUERIDOS;
        
        if (limiteTotal < espacioMinimoTotal) {
             limiteTotal = espacioMinimoTotal;
        }

        const rangoAleatorioDisponible = limiteTotal - espacioMinimoTotal;
        
        let puntosCorteAleatorios = [];
        for (let k = 0; k < NUM_SEGMENTOS_REQUERIDOS - 1; k++) {
            puntosCorteAleatorios.push(Math.floor(Math.random() * rangoAleatorioDisponible));
        }
        
        puntosCorteAleatorios.sort((a, b) => a - b);
        
        let puntosCorteReales = [];
        for (let j = 0; j < NUM_SEGMENTOS_REQUERIDOS - 1; j++) {
            const ajusteMinimo = (j + 1) * MIN_UNIDADES_POR_SEGMENTO;
            puntosCorteReales.push(puntosCorteAleatorios[j] + ajusteMinimo);
        }
        
        const limites = [0, ...puntosCorteReales, limiteTotal];

        for (let j = 0; j < NUM_SEGMENTOS_REQUERIDOS; j++) {
            const inicio = limites[j] + 1;
            const fin = limites[j + 1];
            
            if (inicio <= fin) {
                 entradas.push({ inicio: inicio, fin: fin });
            } else if (j === NUM_SEGMENTOS_REQUERIDOS - 1) {
                entradas.push({ inicio: limites[j], fin: limites[j+1] });
            }
        }
        
        const totalUnidades = entradas.reduce((sum, entrada) => sum + (entrada.fin - entrada.inicio + 1), 0);
        
        procesos.push({
            id: `Proceso ${i + 1}`,
            limite: totalUnidades,
            entradas: entradas,
            progreso: entradas.map(() => 0),
            completado: false,
            bloqueado: false,
            tiempoBloqueoRestante: 0,
            tiempoEspera: 0
        });
    }
    return procesos;
}

const procesos = generarProcesos();
const container = document.getElementById('container');
let procesoIdxActual = 0;
let simulacionInterval;

const maxLimiteGlobal = Math.max(...procesos.map(p => p.limite));

// --- Funciones de Renderizado ---

function renderizarInicial() {
    procesos.forEach((proceso, i) => {
        const procesoDiv = document.createElement('div');
        procesoDiv.className = 'process-container';
        procesoDiv.id = `proceso-${i}`;
        
        const anchoRelativoContenedor = (proceso.limite / maxLimiteGlobal) * 100;

        procesoDiv.innerHTML = `
            <div class="process-label">${proceso.id}</div>
            <div class="progress-bar-wrapper">
                <div class="progress-bar-container" style="width: ${anchoRelativoContenedor}%;"></div>
            </div>
            <div class="total-label">(${proceso.limite})</div>
            <div class="status-label">En Espera</div>
        `;
        container.appendChild(procesoDiv);

        const progressBarContainer = procesoDiv.querySelector('.progress-bar-container');
        proceso.entradas.forEach((entrada, j) => {
            const anchoSegmentoUnidades = entrada.fin - entrada.inicio + 1;
            const anchoSegmentoPorcentaje = (anchoSegmentoUnidades / proceso.limite) * 100;

            const segmentBaseDiv = document.createElement('div');
            segmentBaseDiv.className = 'progress-bar-segment';
            segmentBaseDiv.style.width = `${anchoSegmentoPorcentaje}%`;
            
            const segmentFillDiv = document.createElement('div');
            segmentFillDiv.className = 'progress-fill';
            segmentFillDiv.style.backgroundColor = colors[j % colors.length];
            segmentFillDiv.setAttribute('data-segmento-id', j);
            
            segmentBaseDiv.appendChild(segmentFillDiv);
            progressBarContainer.appendChild(segmentBaseDiv);

            const labelDiv = document.createElement('span');
            labelDiv.className = 'segment-label';
            labelDiv.textContent = anchoSegmentoUnidades;
            segmentBaseDiv.appendChild(labelDiv);
        });
    });
}

function actualizarPanelMétricas(proceso) {
    const trabajoCompletado = proceso.progreso.reduce((sum, p) => sum + p, 0);
    const tiempoRestante = proceso.limite - trabajoCompletado;
    
    document.getElementById('metric-name').textContent = `Proceso: ${proceso.id}`;
    document.getElementById('metric-burst').textContent = `Ejecución (Q): ${QUANTUM}`; 
    document.getElementById('metric-wait').textContent = `Espera: ${proceso.tiempoEspera}`;
    document.getElementById('metric-remaining').textContent = `Restante: ${tiempoRestante}`;
}


function actualizarUI(procesoEjecucionIdx) {
    procesos.forEach((proceso, i) => {
        const procesoDiv = document.getElementById(`proceso-${i}`);
        const statusLabel = procesoDiv.querySelector('.status-label');
        
        if (proceso.completado) {
            statusLabel.textContent = 'Terminado';
            statusLabel.style.color = 'green';
        } else if (proceso.bloqueado) {
            statusLabel.textContent = `Bloqueado`;
            statusLabel.style.color = '#ff0000ff';
        } else if (i === procesoEjecucionIdx) {
            statusLabel.textContent = 'En Ejecución';
            statusLabel.style.color = 'orange';
        } else {
            statusLabel.textContent = 'En Espera';
            statusLabel.style.color = 'grey';
        }
        
        proceso.entradas.forEach((entrada, j) => {
            const segmentFillDiv = procesoDiv.querySelector(`.progress-fill[data-segmento-id='${j}']`);
            const progresoActual = proceso.progreso[j];
            const anchoSegmentoTotal = (entrada.fin - entrada.inicio + 1);
            
            const progresoPorcentajeSegmento = (progresoActual / anchoSegmentoTotal) * 100;
            segmentFillDiv.style.width = `${progresoPorcentajeSegmento}%`;
        });
    });
}

// --- Lógica Principal de la Simulación ---

function simularTurno() {
    let procesoEjecutandoAhora = null;
    let procesoEjecutado = false;

    // 1. Manejar el avance del tiempo de espera y desbloqueo para TODOS los procesos
    procesos.forEach((p, i) => {
        if (p.completado) return;

        if (p.bloqueado) {
            p.tiempoBloqueoRestante--;
            p.tiempoEspera += QUANTUM;
            if (p.tiempoBloqueoRestante <= 0) {
                p.bloqueado = false;
            }
        } else if (i !== procesoIdxActual) {
            // El tiempo de espera se actualiza aquí, excepto para el que se va a ejecutar
            p.tiempoEspera += QUANTUM;
        }
    });

    // 2. Encontrar el proceso que ejecutará en este turno (Round Robin)
    let inicioBusqueda = procesoIdxActual;
    let procesoEncontrado = false;
    let procesosAunActivos = procesos.filter(p => !p.completado).length;

    if (procesosAunActivos === 0) {
        // La simulación ha terminado completamente
        clearInterval(simulacionInterval);
        actualizarUI(-1);
        return;
    }

    do {
        if (!procesos[procesoIdxActual].completado && !procesos[procesoIdxActual].bloqueado) {
            procesoEjecutandoAhora = procesos[procesoIdxActual];
            procesoEncontrado = true;
            break;
        }
        procesoIdxActual = (procesoIdxActual + 1) % NUM_PROCESOS;
    } while (procesoIdxActual !== inicioBusqueda);

    if (!procesoEncontrado) {
         // Si todos están bloqueados, no ejecutamos nada, solo actualizamos UI
         actualizarUI(-1);
         procesoIdxActual = (procesoIdxActual + 1) % NUM_PROCESOS;
         return;
    }

    // 3. Ejecutar el turno
    
    let segmentoIdx = -1;
    for (let i = 0; i < procesoEjecutandoAhora.entradas.length; i++) {
        if (procesoEjecutandoAhora.progreso[i] < (procesoEjecutandoAhora.entradas[i].fin - procesoEjecutandoAhora.entradas[i].inicio + 1)) {
            segmentoIdx = i;
            break;
        }
    }

    if (segmentoIdx !== -1) {
        const entrada = procesoEjecutandoAhora.entradas[segmentoIdx];
        const trabajoRestante = (entrada.fin - entrada.inicio + 1) - procesoEjecutandoAhora.progreso[segmentoIdx];
        const trabajoEnTurno = Math.min(QUANTUM, trabajoRestante);
        
        procesoEjecutandoAhora.progreso[segmentoIdx] += trabajoEnTurno;

        let segmentoCompletado = (procesoEjecutandoAhora.progreso[segmentoIdx] >= (entrada.fin - entrada.inicio + 1));
        
        procesoEjecutandoAhora.completado = procesoEjecutandoAhora.entradas.every(
            (e, i) => procesoEjecutandoAhora.progreso[i] >= (e.fin - e.inicio + 1)
        );

        // 4. Bloquear si terminó un segmento y no todo el proceso
        if (segmentoCompletado && !procesoEjecutandoAhora.completado) {
            procesoEjecutandoAhora.bloqueado = true;
            procesoEjecutandoAhora.tiempoBloqueoRestante = LATENCIA_BLOQUEO;
        }
        procesoEjecutado = true;
    }
    
    // 5. Preparar para el siguiente turno y actualizar métricas
    if (procesoEjecutado) {
        // LLAMADA CRÍTICA: Actualizar métricas DESPUÉS de que el progreso y el estado final han sido determinados.
        actualizarPanelMétricas(procesoEjecutandoAhora);
        procesoIdxActual = (procesoIdxActual + 1) % NUM_PROCESOS;
    }

    // Actualizar la interfaz visual de las barras y estados
    actualizarUI(procesoEncontrado ? procesoEjecutandoAhora.id.split(' ')[1] - 1 : -1);
}


// Iniciar la simulación cuando la página esté lista
document.addEventListener('DOMContentLoaded', () => {
    renderizarInicial();
    if (procesos.length > 0) {
        actualizarPanelMétricas(procesos[0]);
    }
    simulacionInterval = setInterval(simularTurno, INTERVALO);
});