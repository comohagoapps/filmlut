// 1. Base de datos de tus LUTs organizados por categoría
const lutsDatabase = {
  negative_new: [
    { name: "Fuji 160 C", path: "negative_new/fuji_160c", thumb: "assets/previews/negative_new/fuji_160c.jpg" },
    { name: "Fuji 400H", path: "negative_new/fuji_400h", thumb: "assets/previews/negative_new/fuji_400h.jpg" },
    { name: "Fuji 800z", path: "negative_new/fuji_800z", thumb: "assets/previews/negative_new/fuji_800z.jpg" },
    { name: "Portra 400", path: "negative_new/kodak_portra_400", thumb: "assets/previews/negative_new/kodak_portra_400.jpg" }

  ],
  negative_old: [
    { name: "Kodak Gold 200", path: "negative_old/kodak_portra_400_vc", thumb: "assets/previews/negative_old/kodak_portra_400_nc.jpg" }
  ],
  bw: [
    { name: "Tri-X 400", path: "bw/agfa_apx_25", thumb: "assets/previews/bw/agfa_apx_25.jpg" },
    { name: "Ilhpord HP5", path: "bw/ilford_hp_5_plus_400", thumb: "assets/previews/bw/ilford_delta_3200.jpg" }
  ],
  colorslide: [
    { name: "Fuji Provia", path: "colorslide/fuji_provia_100f", thumb: "assets/previews/colorslide/fuji_provia_400f.jpg" }
  ],
  print: [
    { name: "Print Emulation", path: "print/fuji_3510_constlclip", thumb: "assets/previews/print/kodak_2383_constlclip.jpg" }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gl-canvas');
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, powerPreference: "high-performance" });
  if (!gl) return alert('WebGL 2 no soportado.');

  // Extensión para texturas float
  gl.getExtension('EXT_texture_float_linear') || gl.getExtension('OES_texture_float_linear');

  const imageInput = document.getElementById('image-input');
  const uploadBox = document.getElementById('upload-box');
  const downloadBtn = document.getElementById('download-btn');
  const resetBtn = document.getElementById('reset-btn');
  const presetsTrack = document.getElementById('presets-track');

  let currentImage = null;
  let currentLUTTexture = null;
  let activeCategory = 'negative_new';
  let activePresetPath = 'negative_new/kodak_portra_400';

  // Shaders (mismos de antes)
  const vsSource = `#version 300 es
    in vec2 a_position; in vec2 a_texCoord; out vec2 v_texCoord;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y); }`;
  
  const fsSource = `#version 300 es
    precision highp float; in vec2 v_texCoord; uniform sampler2D u_image; uniform highp sampler3D u_lut; out vec4 fragColor;
    void main() { vec4 color = texture(u_image, v_texCoord); vec3 graded = texture(u_lut, color.rgb).rgb; fragColor = vec4(graded, color.a); }`;

  const program = createProgram(gl, vsSource, fsSource);
  setupBuffers(gl, program);

  // 2. Función para renderizar el carrusel de forma dinámica con un bucle (for...of)
  function renderPresetCarousel(categoryKey) {
    presetsTrack.innerHTML = ''; // Limpiar carrusel actual
    const items = lutsDatabase[categoryKey];

    if (!items) return;

    for (let item of items) {
      const btn = document.createElement('button');
      btn.className = `preset-btn ${item.path === activePresetPath ? 'active' : ''}`;
      btn.setAttribute('data-path', item.path);
      
      btn.innerHTML = `
        <img src="${item.thumb}" alt="${item.name}">
        <span>${item.name}</span>
      `;

      // Evento al hacer clic en el preset del carrusel
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        activePresetPath = item.path;
        currentLUTTexture = await loadCubeLUT(`assets/luts/${activePresetPath}.cube`);
        renderImage();
      });

      presetsTrack.appendChild(btn);
    }
  }

  // 3. Eventos para cambiar de Categoría superior
  document.querySelectorAll('.cat-btn').forEach(catBtn => {
    catBtn.addEventListener('click', (e) => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      activeCategory = e.target.getAttribute('data-category');
      renderPresetCarousel(activeCategory); // Carga los Luts correspondientes en el carrusel
    });
  });

  // Cargar carrusel inicial por defecto y el primer LUT
  renderPresetCarousel(activeCategory);
  loadCubeLUT(`assets/luts/${activePresetPath}.cube`).then(tex => {
    currentLUTTexture = tex;
  });

  // Función para cargar el archivo .cube
  async function loadCubeLUT(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
      const text = await response.text();
      const lines = text.split('\n');
      
      let size = 0;
      const data = [];

      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        if (line.startsWith('LUT_3D_SIZE')) {
          size = parseInt(line.split(/\s+/)[1]);
          continue;
        }
        if (size > 0) {
          const parts = line.split(/\s+/).map(Number);
          if (parts.length === 3) data.push(parts[0], parts[1], parts[2]);
        }
      }

      const floatData = new Float32Array(data);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_3D, texture);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB32F, size, size, size, 0, gl.RGB, gl.FLOAT, floatData);
      return texture;
    } catch (error) {
      console.error("Error al cargar LUT:", error);
      return null;
    }
  }

  // Subir imagen del usuario
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      currentImage = new Image();
      currentImage.onload = () => {
        uploadBox.style.display = 'none';
        downloadBtn.disabled = false;
        resetBtn.style.display = 'block';
        renderImage();
      };
      currentImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // NUEVO: Botón de Reiniciar / Empezar de nuevo
  resetBtn.addEventListener('click', () => {
    currentImage = null;
    imageInput.value = ''; // Limpiar input file
    
    // Mostrar cuadro de carga y ocultar botones de acción
    uploadBox.style.display = 'flex';
    downloadBtn.disabled = true;
    resetBtn.style.display = 'none';

    // Limpiar el búfer de WebGL para borrar la imagen de la pantalla
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Reiniciar dimensiones del canvas
    canvas.width = 0;
    canvas.height = 0;
  });

  let imageTexture = null;
  function renderImage() {
    if (!currentImage || !currentLUTTexture) return;
    canvas.width = currentImage.naturalWidth;
    canvas.height = currentImage.naturalHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.useProgram(program);

    if (!imageTexture) imageTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, currentImage);
    gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, currentLUTTexture);
    gl.uniform1i(gl.getUniformLocation(program, "u_lut"), 1);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `filmsim-photo.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  });

  function createProgram(gl, vs, fs) {
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vs); gl.compileShader(vShader);
    const fShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fShader, fs); gl.compileShader(fShader);
    const prog = gl.createProgram();
    gl.attachShader(prog, vShader); gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    return prog;
  }

  function setupBuffers(gl) {
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 0,1, 1,0, 1,1]), gl.STATIC_DRAW);
    const texLoc = gl.getAttribLocation(program, "a_texCoord");
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
  }
});