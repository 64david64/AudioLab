# AudioLab 2.0

**AudioLab** es una aplicación web local desarrollada con **Flask** para la visualización, análisis, simulación e interpretación pedagógica de fenómenos ondulatorios asociados al sonido y a la óptica básica.

La versión **2.0** consolida el proyecto como un laboratorio interactivo orientado al aprendizaje visual. No se limita a mostrar gráficas: busca que el usuario pueda **construir señales, analizarlas, escucharlas, modificarlas, simular fenómenos acústicos y relacionar conceptos de ondas con fenómenos ópticos**.

---

## Objetivo del proyecto

AudioLab tiene como propósito apoyar la comprensión de fenómenos físicos y de procesamiento digital de señales mediante una experiencia web interactiva, clara y progresiva.

El proyecto integra tres enfoques:

1. **Representación visual del sonido**
   - forma de onda;
   - espectro de frecuencias;
   - espectrograma;
   - bandas graves, medias y agudas.

2. **Experimentación sonora**
   - síntesis de ondas;
   - suma de armónicos;
   - reproducción de señales;
   - uso de audio cargado por el usuario;
   - modificación de intensidad y tono percibido.

3. **Simulación de fenómenos ondulatorios**
   - efecto Doppler;
   - intensidad sonora;
   - lectura conceptual del espectro;
   - reflexión;
   - refracción;
   - difracción.

---

## Características principales de AudioLab 2.0

### Inicio

La pestaña de inicio presenta una introducción pedagógica al proyecto y a los conceptos básicos del sonido como fenómeno ondulatorio.

Incluye explicaciones sobre:

- sonido como onda;
- amplitud;
- frecuencia;
- dominio del tiempo;
- dominio de la frecuencia;
- relación entre percepción y análisis sonoro.

---

### Síntesis sonora

Este módulo permite construir señales sonoras simples y observar su comportamiento visual y auditivo.

Incluye:

- onda senoidal;
- onda cuadrada;
- onda triangular;
- onda diente de sierra;
- suma de ondas;
- control de frecuencia;
- control de amplitud;
- control de armónicos;
- reproducción de la señal generada;
- visualización de forma de onda;
- visualización de espectro armónico;
- presets pedagógicos;
- opción para compartir la señal generada con otros módulos.

Este módulo permite comprender cómo los armónicos modifican la forma de onda, el espectro y la percepción del sonido.

---

### Análisis de audio

El módulo de análisis permite cargar un archivo de audio local y estudiar su comportamiento en el tiempo, en frecuencia y en tiempo-frecuencia.

Incluye:

- carga de audio local en formatos comunes como `.wav`, `.mp3` y `.ogg`;
- lectura de metadatos básicos;
- visualización de forma de onda;
- barra temporal fija para seleccionar el fragmento analizado;
- cálculo de DFT manual;
- aplicación de ventana de Hann;
- detección de frecuencias dominantes;
- conversión aproximada de frecuencias a notas musicales;
- clasificación por bandas: graves, medios y agudos;
- espectrograma;
- interpretación automática del fragmento analizado;
- carga de audio compartido desde el módulo de síntesis.

El módulo está pensado para que el usuario observe cómo cambia el contenido espectral al modificar la ventana temporal de análisis.

---

### Interpretación

Esta pestaña funciona como una guía conceptual para leer correctamente los resultados del análisis.

Explica:

- cómo interpretar una forma de onda;
- qué representa un espectro;
- qué significa un pico de frecuencia;
- cómo leer un espectrograma;
- cómo entender las bandas graves, medias y agudas;
- qué precauciones se deben tener al interpretar señales reales.

Su objetivo es evitar lecturas absolutas o incorrectas de las gráficas, reforzando una interpretación pedagógica y cuidadosa.

---

### Simulación acústica

Este módulo permite estudiar de forma visual y auditiva fenómenos acústicos como el efecto Doppler y la variación de intensidad sonora con la distancia.

Incluye:

- fuente sonora móvil;
- observador fijo;
- frentes de onda independientes;
- animación dinámica de propagación;
- rastro visual del emisor;
- cambio de frecuencia percibida;
- cambio de intensidad relativa;
- lámpara de intensidad;
- espectro conceptual Doppler;
- reproducción de tono sintético;
- uso de audio cargado o generado en otros módulos;
- control manual de intensidad;
- control manual de tono percibido;
- conexión entre movimiento, sonido y espectro;
- presets pedagógicos.

La simulación busca relacionar visualmente:

```text
movimiento del emisor → compresión/expansión de ondas → frecuencia percibida → espectro → percepción sonora
```

---

### Óptica

La pestaña de óptica amplía el enfoque del proyecto hacia fenómenos ondulatorios asociados a la luz.

Incluye una parte conceptual y un simulador básico para:

- reflexión;
- refracción;
- difracción.

El módulo permite modificar parámetros como:

- fenómeno óptico;
- ángulo de incidencia;
- índice de refracción del medio 1;
- índice de refracción del medio 2;
- longitud de onda visual;
- abertura.

Este módulo no pretende ser una simulación física avanzada, sino una herramienta visual para introducir fenómenos ópticos fundamentales desde una perspectiva pedagógica.

---

### Acerca

La pestaña Acerca resume el propósito, alcance y enfoque pedagógico de AudioLab 2.0.

---

## Arquitectura del proyecto

La aplicación mantiene una arquitectura modular basada en Flask:

```text
AudioLab/
├── run.py
├── config.py
├── requirements.txt
├── README.md
└── app/
    ├── __init__.py
    ├── routes.py
    ├── templates/
    │   ├── base.html
    │   ├── inicio.html
    │   ├── sintesis.html
    │   ├── analisis.html
    │   ├── interpretacion.html
    │   ├── simulacion.html
    │   ├── optica.html
    │   └── acerca.html
    └── static/
        ├── css/
        │   └── styles.css
        └── js/
            ├── main.js
            ├── audio-utils.js
            ├── audio-store.js
            ├── synthesis.js
            ├── analysis.js
            ├── interpretation-ui.js
            ├── doppler-simulation.js
            └── optics.js
```

---

## Tecnologías utilizadas

- Python
- Flask
- HTML5
- CSS3
- JavaScript
- Canvas API
- Web Audio API
- MathJax

---

## Instalación

### 1. Clonar o descargar el proyecto

```bash
git clone <url-del-repositorio>
cd AudioLab
```

También puedes descargar el proyecto como `.zip` y extraerlo localmente.

---

### 2. Crear un entorno virtual

En Windows:

```bash
python -m venv venv
venv\Scripts\activate
```

En Linux o macOS:

```bash
python3 -m venv venv
source venv/bin/activate
```

---

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

---

### 4. Ejecutar la aplicación

```bash
python run.py
```

Luego abrir en el navegador:

```text
http://127.0.0.1:5000
```

---

## Uso recomendado

Para explorar AudioLab 2.0 de forma progresiva se recomienda seguir este orden:

1. Entrar a **Inicio** para revisar los conceptos generales.
2. Usar **Síntesis sonora** para construir una señal simple.
3. Compartir la señal generada con **Análisis**.
4. Observar la forma de onda, el espectro y el espectrograma.
5. Revisar la pestaña **Interpretación** para entender los resultados.
6. Enviar o cargar una señal en **Simulación acústica**.
7. Observar el efecto Doppler y los cambios de intensidad.
8. Explorar **Óptica** para relacionar el comportamiento de ondas con reflexión, refracción y difracción.

---

## Alcance de la versión 2.0

AudioLab 2.0 es una versión funcional, pedagógica e integrada. Su alcance principal es educativo y visual.

La versión actual permite:

- construir señales;
- analizar audio cargado por el usuario;
- visualizar contenido temporal y frecuencial;
- representar cambios tiempo-frecuencia mediante espectrograma;
- simular el efecto Doppler;
- relacionar intensidad sonora con distancia;
- usar audio compartido entre módulos;
- explorar fenómenos básicos de óptica.

---

## Limitaciones actuales

AudioLab 2.0 no pretende reemplazar herramientas profesionales de análisis de audio, acústica, óptica o procesamiento digital de señales.

Algunas limitaciones de esta versión son:

- la DFT se calcula de forma manual con fines pedagógicos, no como motor de alto rendimiento;
- el espectrograma está optimizado para visualización educativa, no para análisis profesional avanzado;
- la modificación de tono en audios reales se aproxima mediante cambios en la velocidad de reproducción;
- el espectro Doppler es conceptual y busca apoyar la interpretación visual;
- el módulo de óptica es introductorio y no modela todos los detalles físicos de propagación;
- los resultados deben interpretarse como apoyo didáctico, no como mediciones instrumentales certificadas.

---

## Ruta futura

Posibles mejoras futuras:

- módulo de filtros digitales;
- comparación antes/después de señales filtradas;
- exportación de gráficas;
- grabación desde micrófono;
- análisis en tiempo real;
- más presets pedagógicos;
- ejercicios guiados;
- modo docente o modo presentación;
- documentación con capturas de pantalla;
- optimización de rendimiento para audios largos.

---

## Enfoque pedagógico

AudioLab 2.0 se basa en una idea central:

```text
ver → escuchar → modificar → interpretar
```

El objetivo es que el usuario pueda conectar las representaciones visuales con la percepción sonora y con los fenómenos físicos que explican el comportamiento de las ondas.

---

## Estado del proyecto

Versión oficial actual:

```text
AudioLab 2.0
```

Esta versión corresponde a la consolidación del laboratorio interactivo con módulos de síntesis, análisis, interpretación, simulación acústica y óptica básica.

## Autor

Juan David Acosta Rodríguez - Universidad Distrital Francisco José de Caldas
