from random import randint
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import math

# Función para generar datos (sin cambios)
def entradas_salida(limite_superior):
    """Genera segmentos de trabajo para un proceso."""
    valores_generados = []
    limite_inferior_actual = 1
    if limite_superior < 10: limite_superior = 10
    
    for i in range(4):
        rango_disponible = limite_superior - limite_inferior_actual
        if rango_disponible < 2: break
        
        tamano_max_segmento = max(2, rango_disponible // (4 - i)) if (4 - i) > 0 else rango_disponible
        tamano_segmento = randint(1, tamano_max_segmento)
        fin_segmento = limite_inferior_actual + tamano_segmento
        
        if fin_segmento > limite_superior:
            fin_segmento = limite_superior
            
        valores_generados.append((limite_inferior_actual, fin_segmento))
        limite_inferior_actual = fin_segmento + 1
        
        if limite_inferior_actual > limite_superior: break
    
    print(f"Rango del proceso: {limite_superior}, Segmentos: {valores_generados}")
    return (limite_superior, valores_generados)

# --- Generación de Datos ---
resultados_totales = []
for i in range(10):
    limite_superior = randint(10, 20)
    resultado = entradas_salida(limite_superior)
    resultados_totales.append(resultado)

# --- Estructuras para Controlar el Estado ---
progreso_procesos = [[0] * len(entradas) for _, entradas in resultados_totales]
procesos_terminados = set()

# --- Configuración de la Animación ---
QUANTUM = 10
STEPS_POR_TURNO = 40
DURACION_TURNO_MS = 300 # Un poco más lento para ver mejor los números
INTERVALO = DURACION_TURNO_MS / STEPS_POR_TURNO

# --- Configuración del Gráfico ---
nombres_procesos = [f'Proceso {i+1}' for i in range(len(resultados_totales))]
fig, ax = plt.subplots(figsize=(15, 8))

colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']

for i, (limite, _) in enumerate(resultados_totales):
    ax.barh(nombres_procesos[i], limite, color='lightgrey', edgecolor='grey', height=0.6)
    ax.text(limite + 3, nombres_procesos[i], f'{limite}', va='center', ha='left', fontsize=9, color='darkgrey')

ax.set_xlabel('Unidades de Trabajo')
ax.set_ylabel('Procesos')
ax.set_title(f'Simulación de Planificador Round-Robin (Quantum = {QUANTUM})')
ax.invert_yaxis()
ax.set_xlim(0, max(lim for lim, _ in resultados_totales) * 1.25) # Más espacio para texto
plt.tight_layout(rect=[0, 0, 0.95, 1])

elementos_dinamicos = []

# --- Lógica del Planificador ---
proceso_idx_actual = 0
trabajo_total = sum(fin - inicio + 1 for _, entradas in resultados_totales for inicio, fin in entradas)
total_turnos = math.ceil(trabajo_total / QUANTUM)
total_frames = int(total_turnos * STEPS_POR_TURNO)

def update(frame):
    global proceso_idx_actual

    for elemento in elementos_dinamicos:
        elemento.remove()
    elementos_dinamicos.clear()

    proceso_idx_animando = proceso_idx_actual
    if len(procesos_terminados) < len(resultados_totales):
        while proceso_idx_animando in procesos_terminados:
            proceso_idx_animando = (proceso_idx_animando + 1) % len(resultados_totales)
            
    # Redibujar TODO el estado
    for i in range(len(resultados_totales)):
        # 1. Redibujar progreso completado
        _, entradas = resultados_totales[i]
        for j, (inicio, fin) in enumerate(entradas):
            progreso = progreso_procesos[i][j]
            if progreso > 0:
                bar = ax.barh(nombres_procesos[i], progreso, left=inicio - 1, color=colors[j % len(colors)], height=0.4, alpha=0.7)
                elementos_dinamicos.extend(bar)

        # 2. Dibujar texto de estado (Ejecución, Espera, Terminado)
        estado_actual, color_estado = '', 'black'
        if i in procesos_terminados:
            estado_actual, color_estado = 'Terminado', 'green'
        elif i == proceso_idx_animando and len(procesos_terminados) < len(resultados_totales):
            estado_actual, color_estado = 'En Ejecución', 'orange'
        else:
            estado_actual, color_estado = 'En Espera', 'grey'
        
        pos_x_estado = resultados_totales[i][0] + 15
        txt_estado = ax.text(pos_x_estado, i, estado_actual, va='center', ha='left', fontsize=9, color=color_estado, fontweight='bold')
        elementos_dinamicos.append(txt_estado)

    if len(procesos_terminados) == len(resultados_totales):
        if hasattr(ani, 'event_source') and ani.event_source is not None:
            ani.event_source.stop()
        return elementos_dinamicos

    # Encontrar segmento activo y animar el turno
    segmento_idx_activo = -1
    for j, (inicio, fin) in enumerate(resultados_totales[proceso_idx_animando][1]):
        if progreso_procesos[proceso_idx_animando][j] < (fin - inicio + 1):
            segmento_idx_activo = j
            break
    
    if segmento_idx_activo != -1:
        paso_animacion = frame % STEPS_POR_TURNO
        inicio, fin = resultados_totales[proceso_idx_animando][1][segmento_idx_activo]
        ancho_total_segmento = fin - inicio + 1
        progreso_previo = progreso_procesos[proceso_idx_animando][segmento_idx_activo]
        trabajo_restante_segmento = ancho_total_segmento - progreso_previo
        
        trabajo_en_turno = min(QUANTUM, trabajo_restante_segmento)
        ancho_animado = trabajo_en_turno * (paso_animacion + 1) / STEPS_POR_TURNO
        
        # Barra de la animación del quantum
        bar_anim = ax.barh(nombres_procesos[proceso_idx_animando], ancho_animado, 
                           left=inicio - 1 + progreso_previo, 
                           color=colors[segmento_idx_activo % len(colors)], 
                           height=0.4)
        elementos_dinamicos.extend(bar_anim)

        # --- NUEVO: Mostrar el contador de progreso numérico animado ---
        progreso_numerico_actual = progreso_previo + ancho_animado
        texto_progreso = f"{int(round(progreso_numerico_actual))}/{ancho_total_segmento}"
        
        # Posición del texto justo al final de la barra animada
        pos_x_texto = inicio - 1 + progreso_numerico_actual + 1.5
        
        txt_progreso = ax.text(pos_x_texto, proceso_idx_animando, texto_progreso,
                               va='center', ha='left', fontsize=8, color=colors[segmento_idx_activo % len(colors)], fontweight='bold')
        elementos_dinamicos.append(txt_progreso)
        
        # Al final del turno, actualizar el estado real
        if paso_animacion == STEPS_POR_TURNO - 1:
            progreso_procesos[proceso_idx_animando][segmento_idx_activo] += trabajo_en_turno

            # Verificar si el proceso terminó por completo
            if all(p >= (f - s + 1) for p, (s, f) in zip(progreso_procesos[proceso_idx_animando], resultados_totales[proceso_idx_animando][1])):
                procesos_terminados.add(proceso_idx_animando)

            # Pasar al siguiente proceso
            proceso_idx_actual = (proceso_idx_actual + 1) % len(resultados_totales)

    return elementos_dinamicos

# --- Creación y ejecución de la animación ---
ani = animation.FuncAnimation(fig, update, frames=total_frames, interval=INTERVALO, blit=False, repeat=False)
plt.show()