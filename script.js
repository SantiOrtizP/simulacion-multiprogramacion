const NUM_PROCESOS = 10;
const QUANTUM = 10;
const INTERVALO = 500; // milisegundos por turno
const LATENCIA_BLOQUEO = 2; // Estará bloqueado por 2 * 500ms = 1 segundo
const MIN_UNIDADES_POR_SEGMENTO = 5; // AÑADIDO: Mínimo de unidades que debe tener cada E/S.
const NUM_SEGMENTOS_REQUERIDOS = 4; // Constante para la cantidad de E/S.
const colors = ['#F54927', '#27F5B0', '#27D3F5', '#B027F5'];

function generarProcesos() {
    const procesos = [];
    
    for (let i = 0; i < NUM_PROCESOS; i++) {
        const limiteTotal = Math.floor(Math.random() * 100) + 100; // Total de unidades del proceso (50 a 500)
        const entradas = [];
        
        // 1. Calcular el espacio 'libre' para la aleatoriedad
        const espacioMinimoTotal = MIN_UNIDADES_POR_SEGMENTO * NUM_SEGMENTOS_REQUERIDOS;
        
        // Si el límite total es muy pequeño, aseguramos que tenga espacio.
        if (limiteTotal < espacioMinimoTotal) {
             console.warn(`Límite total ajustado a ${espacioMinimoTotal} para garantizar el mínimo.`);
             limiteTotal = espacioMinimoTotal;
        }

        const rangoAleatorioDisponible = limiteTotal - espacioMinimoTotal;
        
        // 2. Generar 3 puntos de corte aleatorios DENTRO DEL RANGO DISPONIBLE
        let puntosCorteAleatorios = [];
        for (let k = 0; k < NUM_SEGMENTOS_REQUERIDOS - 1; k++) {
            // Generamos puntos de corte entre 0 y el rango disponible
            puntosCorteAleatorios.push(Math.floor(Math.random() * rangoAleatorioDisponible));
        }
        
        // 3. Ordenar y agregar los puntos de inicio/fin (0 y limiteTotal)
        puntosCorteAleatorios.sort((a, b) => a - b);
        
        // 4. Transformar los puntos de corte aleatorios en límites reales con el mínimo garantizado
        let puntosCorteReales = [];
        let acumuladorMinimo = 0;
        
        for (let j = 0; j < NUM_SEGMENTOS_REQUERIDOS - 1; j++) {
            // El límite real es: (El punto de corte aleatorio) + (El mínimo acumulado de los segmentos anteriores)
            const ajusteMinimo = (j + 1) * MIN_UNIDADES_POR_SEGMENTO;
            
            // El punto de corte real es: el valor aleatorio + el ajuste de la reserva mínima
            puntosCorteReales.push(puntosCorteAleatorios[j] + ajusteMinimo);
        }
        
        // Los límites finales son: [0, CorteReal1, CorteReal2, CorteReal3, LimiteTotal]
        const limites = [0, ...puntosCorteReales, limiteTotal];

        // 5. Crear los 4 segmentos de forma contigua
        for (let j = 0; j < NUM_SEGMENTOS_REQUERIDOS; j++) {
            const inicio = limites[j] + 1;
            const fin = limites[j + 1];
            
            if (inicio <= fin) {
                 entradas.push({ inicio: inicio, fin: fin });
            } else {
                 // Esto no debería ocurrir con la nueva lógica, pero mantenemos la seguridad.
                 entradas.push({ inicio: inicio, fin: inicio }); 
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
            tiempoBloqueoRestante: 0 
        });
    }
    return procesos;
}
// Resto del código (constantes y funciones) permanece igual...
const procesos = generarProcesos();
const container = document.getElementById('container');
let procesoIdxActual = 0;
let simulacionInterval;

const maxLimiteGlobal = Math.max(...procesos.map(p => p.limite));

function renderizarInicial() {
    // ... (El resto de la función renderizarInicial es la misma)
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

function simularTurno() {
    // ... (El resto de la función simularTurno es la misma)
    // 1. Manejar procesos bloqueados
    procesos.forEach(p => {
        if (p.bloqueado) {
            p.tiempoBloqueoRestante--;
            if (p.tiempoBloqueoRestante <= 0) {
                p.bloqueado = false; // El proceso se desbloquea
            }
        }
    });

    const procesosActivos = procesos.filter(p => !p.completado && !p.bloqueado);
    if (procesosActivos.length === 0) {
        if (procesos.every(p => p.completado)) {
            console.log("Todos los procesos han terminado.");
            clearInterval(simulacionInterval);
            actualizarUI(-1, -1);
            return;
        }
    }

    // 2. Encontrar el siguiente proceso no terminado Y NO BLOQUEADO
    while (procesos[procesoIdxActual].completado || procesos[procesoIdxActual].bloqueado) {
        procesoIdxActual = (procesoIdxActual + 1) % NUM_PROCESOS;
    }
    
    let procesoActual = procesos[procesoIdxActual];
    
    let segmentoIdx = -1;
    for (let i = 0; i < procesoActual.entradas.length; i++) {
        if (procesoActual.progreso[i] < (procesoActual.entradas[i].fin - procesoActual.entradas[i].inicio + 1)) {
            segmentoIdx = i;
            break;
        }
    }
    
    actualizarUI(procesoIdxActual, segmentoIdx);

    let segmentoCompletado = false;

    if (segmentoIdx !== -1) {
        const entrada = procesoActual.entradas[segmentoIdx];
        const trabajoRestante = (entrada.fin - entrada.inicio + 1) - procesoActual.progreso[segmentoIdx];
        const trabajoEnTurno = Math.min(QUANTUM, trabajoRestante);
        
        procesoActual.progreso[segmentoIdx] += trabajoEnTurno;

        // Verificar si el segmento terminó en este turno
        if (procesoActual.progreso[segmentoIdx] >= (entrada.fin - entrada.inicio + 1)) {
             segmentoCompletado = true;
        }

        // Verificar si el proceso terminó por completo
        procesoActual.completado = procesoActual.entradas.every((e, i) => procesoActual.progreso[i] >= (e.fin - e.inicio + 1));
    }

    // 3. Bloquear el proceso si terminó un segmento y NO es el último segmento del proceso
    if (segmentoCompletado && !procesoActual.completado) {
        procesoActual.bloqueado = true;
        procesoActual.tiempoBloqueoRestante = LATENCIA_BLOQUEO;
    }

    procesoIdxActual = (procesoIdxActual + 1) % NUM_PROCESOS;
}

function actualizarUI(procesoEjecucionIdx, segmentoActivoIdx) {
    // ... (El resto de la función actualizarUI es la misma)
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

// Iniciar la simulación cuando la página esté lista
document.addEventListener('DOMContentLoaded', () => {
    renderizarInicial();
    simulacionInterval = setInterval(simularTurno, INTERVALO);
});