# AudioLab — Visor de Análisis de Audio

AudioLab es un visor web local orientado a la exploración visual del audio desde el procesamiento digital de señales, la acústica y la física de ondas.

Permite cargar un archivo de audio y analizarlo mediante representaciones en el dominio del tiempo (forma de onda) y, en versiones futuras, en el dominio de la frecuencia.

---

## Objetivo del proyecto

El objetivo de este proyecto es construir una herramienta didáctica e interactiva que permita:

- visualizar señales de audio de forma intuitiva,
- comprender la relación entre tiempo y frecuencia,
- explorar cómo se representa una canción desde la física,
- y facilitar la interpretación básica de características acústicas.

Este visor no busca realizar clasificación automática (ej. emociones), sino servir como herramienta de análisis y exploración.

---

## Funcionalidades actuales (V1)

Actualmente, el visor permite:

- Cargar archivos de audio (`.wav`, `.mp3`, `.ogg`)
- Visualizar metadatos:
  - nombre del archivo
  - duración (formato mm:ss)
  - frecuencia de muestreo
  - número de canales
- Mostrar la forma de onda en el dominio del tiempo
- Navegar la señal mediante una **ventana temporal**:
  - definir inicio de vista
  - definir duración visible
- Visualizar ejes:
  - eje temporal (segundos)
  - amplitud normalizada (-1 a 1)

---

## Arquitectura del proyecto

El proyecto está construido con una arquitectura simple y modular:

### Backend
- Python + Flask
- Renderizado de plantillas HTML

### Frontend
- HTML + CSS (estructura y estilos)
- JavaScript (lógica de interacción)

### Procesamiento de audio
- Web Audio API (navegador)
- Decodificación de audio en `AudioBuffer`

---

## Flujo de uso

1. Ingresar al visor
2. Ir a la pestaña **Análisis**
3. Cargar un archivo de audio
4. Presionar **Procesar audio**
5. Ajustar la ventana temporal:
   - inicio de vista
   - duración visible
6. Analizar la forma de onda resultante

---

## Decisiones técnicas 

- Se utiliza Web Audio API para evitar procesamiento innecesario en backend
- Se trabaja con un solo archivo por análisis
- Se usa únicamente el canal 0 (mono) para simplificar la visualización
- La señal no se muestra completa siempre, sino mediante ventanas temporales
- Se utiliza reducción de datos por min/max por píxel para representar la señal

---

## Limitaciones actuales

- No se ha implementado aún la FFT
- No hay zoom interactivo con mouse
- No hay reproducción de audio sincronizada
- No hay selección gráfica de fragmentos
- No hay espectrograma

---

## Roadmap (V2)

Futuras mejoras planificadas:

-  Implementación de FFT (dominio de frecuencia)
-  Slider de navegación temporal
-  Zoom interactivo sobre la señal
-  Reproducción de audio sincronizada con la gráfica
-  Espectrograma
-  Métricas adicionales (energía, centroid espectral, etc.)
-  Interpretación asistida de resultados

---

##  Estructura del proyecto

    acustica/
    │
    ├── app.py
    ├── templates/
    │   ├── base.html
    │   ├── inicio.html
    │   ├── analisis.html
    │   ├── interpretacion.html
    │   └── acerca.html
    │
    └── static/
        ├── css/
        │   └── styles.css
        └── js/
            └── script.js

---

##  Ejecución local

1. Ejecutar en terminal:

    python app.py

2. Abrir en navegador:

    http://127.0.0.1:5000/

---

##  Enfoque conceptual

Este proyecto se basa en la idea de que el sonido puede ser analizado desde múltiples perspectivas:

- como señal temporal (amplitud vs tiempo),
- como composición frecuencial (FFT),
- y como fenómeno físico asociado a la percepción auditiva.

La herramienta busca servir como puente entre:

**acústica + procesamiento de señales + visualización + experiencia de usuario**

---

##  Estado del proyecto

 En desarrollo — versión V1 en construcción

---

##  Autor

Juan David Acosta Rodríguez, Universidad Distrital Francisco José de Caldas,

Proyecto desarrollado como parte de un proceso de exploración en:

- procesamiento digital de señales
- análisis acústico
- visualización interactiva de datos