# AudioLab — Visor web local de análisis de audio

AudioLab es un visor web local orientado a la exploración visual e interpretativa de señales de audio. Su propósito es permitir que un usuario cargue un archivo sonoro y observe, de manera progresiva y comprensible, cómo se comporta una señal en el dominio del tiempo y en el dominio de la frecuencia.

El proyecto articula conceptos de:

- física de ondas
- acústica
- procesamiento digital de señales
- visualización interactiva
- interpretación pedagógica de resultados

Más que reinventar algoritmos existentes, AudioLab pone el foco en:

- cómo se visualiza la señal
- cómo se explica lo que ocurre
- cómo se interpreta el resultado
- cómo interactúa el usuario con el análisis

---

## Objetivo del proyecto

Construir una herramienta web local que permita:

- cargar un archivo de audio
- visualizar su forma de onda
- calcular y mostrar su espectro mediante DFT
- detectar frecuencias dominantes
- convertir frecuencias principales a notas musicales aproximadas
- resumir la distribución entre graves, medios y agudos
- generar una interpretación automática básica y prudente

---

## Estructura del proyecto

    AudioLab/
    │
    ├── run.py
    ├── config.py
    ├── requirements.txt
    ├── README.md
    │
    ├── app/
    │   ├── __init__.py
    │   ├── routes.py
    │   │
    │   ├── templates/
    │   │   ├── base.html
    │   │   ├── inicio.html
    │   │   ├── analisis.html
    │   │   ├── interpretacion.html
    │   │   └── acerca.html
    │   │
    │   └── static/
    │       ├── css/
    │       │   └── styles.css
    │       │
    │       └── js/
    │           ├── main.js
    │           ├── analysis.js
    │           ├── interpretation-ui.js
    │           └── audio-utils.js

---

## Pestañas del visor

### Inicio
Introduce el marco conceptual del análisis de audio:

- sonido como onda
- dominio del tiempo vs. frecuencia
- qué es una DFT
- por qué analizar música
- relación sonido–percepción

### Análisis
Es la parte operativa del sistema:

- carga de audio
- visualización de forma de onda
- navegación temporal
- cálculo espectral
- detección de picos
- interpretación automática básica

### Interpretación
Explica cómo leer los resultados:

- significado del espectro
- picos dominantes
- bandas de frecuencia
- limitaciones del análisis

### Acerca
Contexto del proyecto:

- decisiones metodológicas
- alcance y limitaciones
- referencias bibliográficas

---

## Funcionalidades implementadas (V1)

### Carga de audio
Formatos soportados:

- `.wav` (recomendado)
- `.mp3`
- `.ogg`

### Metadatos
Se muestran:

- nombre
- duración
- frecuencia de muestreo
- canales

### Procesamiento
Se utiliza:

- Web Audio API
- acceso a `AudioBuffer`

### Canal de análisis
Se usa únicamente:

- canal 0, como simplificación válida en V1

### Forma de onda
Se renderiza mediante:

- reducción min/max por columna
- optimización visual para no dibujar cada muestra de forma individual

### Ventana temporal
Control del usuario sobre:

- inicio
- duración visible
- navegación con slider

### DFT manual
Se implementa una:

- Transformada Discreta de Fourier (O(N²))

Motivo:

- claridad didáctica
- control del proceso
- suficiente para esta etapa del proyecto

### Ventana de Hann
Se aplica para:

- reducir discontinuidades
- mejorar la lectura del espectro

### Espectro
Se muestra:

- frecuencia (Hz)
- magnitud relativa
- rango configurable

### Detección de picos
Basada en:

- máximos locales
- umbral relativo
- separación mínima
- límite de picos

### Conversión a notas
Ejemplos:

- 440 Hz → A4
- 261 Hz → C4

### Interpretación automática
Resume:

- distribución espectral
- predominio de bandas
- relación entre pico principal y banda predominante

---

## Enfoque interpretativo

El sistema distingue entre:

### Pico principal
Frecuencia puntual con mayor magnitud.

### Banda predominante
Zona del espectro con mayor energía relativa:

- graves
- medios
- agudos

No necesariamente coinciden, y esa diferencia forma parte de la interpretación.

---

## Decisiones metodológicas

- procesamiento local
- uso de Web Audio API
- DFT manual
- ventana de Hann
- análisis monocanal
- reglas simples de interpretación
- enfoque pedagógico

---

## Qué sí hace la V1

- carga audio
- visualiza forma de onda
- calcula espectro
- detecta picos
- resalta pico principal
- clasifica bandas
- genera interpretación básica

---

## Qué NO hace la V1

- FFT optimizada
- espectrograma
- aprendizaje automático
- identificación automática de instrumentos
- clasificación emocional automática
- análisis multicanal avanzado

---

## Caso de estudio

Referencia utilizada:

**"A Day in the Life" — The Beatles**

Permite observar:

- cambios en el espectro
- variaciones de densidad
- comportamiento dinámico

---

## UX del sistema

- navegación superior
- panel de análisis reorganizado
- visualización simultánea de espectro, picos e interpretación

Colores por bandas:

- azul → graves
- verde → medios
- rojo → agudos

---

## Tecnologías utilizadas

- Python
- Flask
- HTML
- CSS
- JavaScript
- Web Audio API
- Canvas API

---

## Ejecución del proyecto

### 1. Clonar el repositorio

    git clone https://github.com/64david64/AudioLab.git
    cd AudioLab

### 2. Crear un entorno virtual

    python -m venv venv

### 3. Activar el entorno virtual

#### En Windows

    venv\Scripts\activate

#### En macOS / Linux

    source venv/bin/activate

### 4. Instalar dependencias

    pip install -r requirements.txt

---

### 5. Ejecutar la aplicación

    python run.py

---

### 6. Abrir en el navegador

    http://127.0.0.1:5000/

---

## Mejoras futuras

- FFT optimizada
- espectrograma
- sincronización audio–visual
- análisis multicanal
- exportación de resultados
- features espectrales avanzadas

---

## Referencias

Web Audio API  
https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

Fourier  
https://numpy.org/doc/stable/reference/routines.fft.html

Ventana de Hann  
https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.windows.hann.html

DSP avanzado  
https://librosa.org

---

## Estado del proyecto

**Versión:** V1  
**Estado:** funcional

---

## Autor

Juan David Acosta Rodríguez  
Universidad Distrital Francisco José de Caldas