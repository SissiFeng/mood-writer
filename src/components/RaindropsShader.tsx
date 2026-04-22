import React, { useRef, useEffect, useMemo } from 'react';

interface RaindropsShaderProps {
  intensity: number; // 0 to 1
  fog: number; // 0 to 1
  refraction: number; // 0 to 2
  speed: number; // 0 to 2
  backgroundTexture?: HTMLImageElement | HTMLVideoElement | null;
}

const RaindropsShader: React.FC<RaindropsShaderProps> = ({
  intensity,
  fog,
  refraction,
  speed,
  backgroundTexture
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const lastTextureRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);

  const vertexShaderSource = `#version 300 es
    in vec2 a_position;
    out vec2 v_texCoord;
    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

    const fragmentShaderSource = `#version 300 es
    precision highp float;
    
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_intensity;
    uniform float u_fog;
    uniform float u_refraction;
    uniform float u_speed;
    uniform sampler2D u_background;
    uniform bool u_has_background;

    in vec2 v_texCoord;
    out vec4 outColor;

    // "Heartfelt" by Martijn Steinrucken (BigWings) - 2017
    // Ported to WebGL 2.0 for React

    #define S(a, b, t) smoothstep(a, b, t)

    vec3 N13(float p) {
       vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787));
       p3 += dot(p3, p3.yzx + 19.19);
       return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
    }

    vec4 N14(float p) {
       vec4 p4 = fract(vec4(p) * vec4(.1031, .11369, .13787, .09987));
       p4 += dot(p4, p4.wzxy + 19.19);
       return fract(vec4((p4.x + p4.y) * p4.z, (p4.x + p4.z) * p4.y, (p4.y + p4.z) * p4.w, (p4.z + p4.w) * p4.x));
    }

    float N(float t) {
        return fract(sin(t*12345.567)*4567.89);
    }

    float Saw(float b, float t) {
        return S(0., b, t)*S(1., b, t);
    }

    vec2 DropLayer2(vec2 uv, float t) {
        vec2 UV = uv;
        
        uv.y += t*0.75;
        vec2 gv = fract(uv*6.0)-0.5;
        vec2 id = floor(uv*6.0);
        
        float n = N(id.x*35.2+id.y*2376.1);
        t += n*6.2831;
        
        float w = UV.y * 10.0;
        float x = (n - .5) * .8;               // drop influence area
        x += (.4 - abs(x)) * sin(3. * w) * pow(sin(w), 6.) * .45;
        float y = -Saw(.85, fract(t*.2));
        vec2 dropPos = (gv-vec2(x,y));
        float d = length(dropPos);
        
        float mainDrop = S(.4, .0, d);
        
        float r = fract(sin((id.x*11.7+id.y)*924.5)*5588.7);
        float trail = S(-.05, .05, dropPos.x);
        trail *= S(-.23, .15, dropPos.y);
        trail *= S(.5, y, gv.y);
        trail *= S(.3, 0., abs(dropPos.x));
        
        float fogTrail = S(-.05, .05, dropPos.x)*S(.5, y, gv.y);
        fogTrail *= S(.05, .0, abs(dropPos.x));
        
        vec2 off = mainDrop * dropPos + vec2(0., fogTrail * .5);
        
        return off;
    }

    vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
        // Return accumulated distortion (XY offset)
        
        // Static moisture layer
        vec2 staticUV = uv * 40.;
        vec2 sId = floor(staticUV);
        vec2 sfv = fract(staticUV) - 0.5;
        float sn = N(sId.x * 107.45 + sId.y * 3527.4);
        vec2 sp = (sn - 0.5) * 0.7;
        float sd = length(sfv - sp);
        float sFade = Saw(0.025, fract(t + sn));
        float sMask = S(0.3, 0., sd) * sFade * l0;
        vec2 sDistort = sMask * (sfv - sp);
        
        // Moving layers
        vec2 m1 = DropLayer2(uv, t) * l1;
        vec2 m2 = DropLayer2(uv * 1.85 + 7.54, t) * l2;
        
        return sDistort + m1 + m2;
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        vec2 UV = v_texCoord;
        float t = u_time * 0.2 * u_speed;
        
        // Intensity mapping to original logic
        float staticIntensity = S(0.2, 0.7, u_intensity) * 1.5;
        float movingIntensity = S(0.0, 1.0, u_intensity);
        
        vec2 distortion = Drops(uv, t, staticIntensity, movingIntensity, movingIntensity * 0.5);
        
        // Refraction vector
        vec2 offset = distortion * u_refraction;
        vec2 focus = UV + offset;
        
        vec4 col;
        if (u_has_background) {
            // Simple sampling for verification
            if (u_fog > 0.0) {
                float blur = u_fog * 0.015;
                col = vec4(0);
                col += texture(u_background, focus + vec2(-blur, -blur));
                col += texture(u_background, focus + vec2(blur, -blur));
                col += texture(u_background, focus + vec2(-blur, blur));
                col += texture(u_background, focus + vec2(blur, blur));
                col += texture(u_background, focus) * 4.0;
                col /= 8.0;
            } else {
                col = texture(u_background, focus);
            }
        } else {
            // Default procedural background - Night scene vibe (more distinct)
            vec2 bg_uv = focus;
            vec3 color1 = vec3(0.05, 0.1, 0.4); 
            vec3 color2 = vec3(0.5, 0.2, 0.6);
            vec3 sky = mix(color1, color2, bg_uv.y + bg_uv.x * 0.3 + sin(u_time * 0.1) * 0.1);
            col = vec4(sky, 1.0);
        }

        // Add some post-effects for that "cinematic" feel
        float d = length(uv);
        col.rgb *= S(1.5, 0.5, d); // Vignette
        
        // Final rain highlight - reflective glint
        // Use the mask part of the distortion if we had one, otherwise just intensity
        float rainMask = length(distortion) * 5.0;
        col.rgb += rainMask * 0.1 * movingIntensity;

        outColor = col;
    }
  `;

  const programRef = useRef<WebGLProgram | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const vaoRef = useRef<WebGLVertexArrayObject | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, alpha: false });
    if (!gl) return;
    glRef.current = gl;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vertexShaderSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragmentShaderSource);
    gl.compileShader(fs);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    programRef.current = program;

    uniformsRef.current = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      intensity: gl.getUniformLocation(program, 'u_intensity'),
      fog: gl.getUniformLocation(program, 'u_fog'),
      refraction: gl.getUniformLocation(program, 'u_refraction'),
      speed: gl.getUniformLocation(program, 'u_speed'),
      background: gl.getUniformLocation(program, 'u_background'),
      hasBackground: gl.getUniformLocation(program, 'u_has_background'),
    };

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    vaoRef.current = vao;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    textureRef.current = texture;

    return () => {
      gl.deleteBuffer(positionBuffer);
      gl.deleteVertexArray(vao);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    };
  }, []);

  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const vao = vaoRef.current;
    const texture = textureRef.current;
    const uniforms = uniformsRef.current;
    if (!gl || !program || !vao || !texture) return;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.bindVertexArray(vao);

      const time = (Date.now() - startTimeRef.current) / 1000.0;

      gl.uniform2f(uniforms.resolution!, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(uniforms.time!, time);
      gl.uniform1f(uniforms.intensity!, intensity);
      gl.uniform1f(uniforms.fog!, fog);
      gl.uniform1f(uniforms.refraction!, refraction);
      gl.uniform1f(uniforms.speed!, speed);

      if (backgroundTexture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        if (backgroundTexture instanceof HTMLVideoElement || (backgroundTexture instanceof HTMLImageElement && lastTextureRef.current !== backgroundTexture)) {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, backgroundTexture);
          lastTextureRef.current = backgroundTexture;
        }
        
        gl.uniform1i(uniforms.background!, 0);
        gl.uniform1i(uniforms.hasBackground!, 1);
      } else {
        gl.uniform1i(uniforms.hasBackground!, 0);
        lastTextureRef.current = null;
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(requestRef.current);
  }, [intensity, fog, refraction, speed, backgroundTexture]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full block touch-none"
      id="raindrops-canvas"
    />
  );
};

export default RaindropsShader;
