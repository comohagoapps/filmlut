class LUTRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2');
    if (!this.gl) console.error("WebGL 2 no soportado en este navegador.");
    
    this.initShaders();
  }

  initShaders() {
    const gl = this.gl;

    // Shader de Vértices
    const vsSource = `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
      }`;

    // Shader de Fragmentos (Aplica el Hald CLUT 3D)
    const fsSource = `#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform sampler2D u_lut;
      out vec4 fragColor;

      void main() {
        vec4 color = texture(u_image, v_texCoord);
        float lutSize = 8.0; // Dimensión del Hald CLUT (ej. 512x512 px)

        // Cálculo de mapeo de color RGB a coordenadas dentro de la textura LUT
        float blueCell = color.b * (lutSize * lutSize - 1.0);
        vec2 cellOffset = vec2(floor(mod(blueCell, lutSize)), floor(blueCell / lutSize));
        
        vec2 lutPos = (cellOffset * lutSize + color.rg * (lutSize - 1.0) + 0.5) / (lutSize * lutSize);
        vec4 gradedColor = texture(u_lut, lutPos);

        fragColor = vec4(gradedColor.rgb, color.a);
      }`;

    this.program = this.createProgram(gl, vsSource, fsSource);
    // Configurar buffers de pantalla plana (triángulos para renderizar la imagen)
    this.setupBuffers();
  }

  createProgram(gl, vsSource, fsSource) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return program;
  }

  setupBuffers() {
    const gl = this.gl;
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,  1, 0,  0, 1,
      0, 1,  1, 0,  1, 1,
    ]), gl.STATIC_DRAW);
  }

  render(sourceImage, lutImage) {
    const gl = this.gl;
    
    // Ajustar resolución del canvas a la foto
    this.canvas.width = sourceImage.width;
    this.canvas.height = sourceImage.height;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(this.program);

    // Activar textura de la Foto
    this.createTexture(gl, sourceImage, gl.TEXTURE0);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_image"), 0);

    // Activar textura del LUT
    this.createTexture(gl, lutImage, gl.TEXTURE1);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_lut"), 1);

    // Dibujar
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  createTexture(gl, image, textureUnit) {
    gl.activeTexture(textureUnit);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }
}