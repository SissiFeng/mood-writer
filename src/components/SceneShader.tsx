import React, { useRef, useEffect } from 'react';
import type { Scene } from '../shaders';

interface Props {
  scene: Scene;
  intensity: number;
  fog: number;
  refraction: number;
  speed: number;
  backgroundTexture?: HTMLImageElement | HTMLVideoElement | null;
}

const VS_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

interface GLState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  positionBuffer: WebGLBuffer;
  texture: WebGLTexture;
  uniforms: Record<string, WebGLUniformLocation | null>;
  vs: WebGLShader;
  fs: WebGLShader;
}

function buildProgram(gl: WebGL2RenderingContext, fragmentSource: string): GLState | null {
  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, VS_SOURCE);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error('[SceneShader] VERTEX compile error:', gl.getShaderInfoLog(vs));
    return null;
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, fragmentSource);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error('[SceneShader] FRAGMENT compile error:', gl.getShaderInfoLog(fs));
    return null;
  }

  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[SceneShader] LINK error:', gl.getProgramInfoLog(program));
    return null;
  }

  const positionBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // seed with a single black pixel so sampling doesn't read garbage before upload
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

  const uniforms = {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    time: gl.getUniformLocation(program, 'u_time'),
    intensity: gl.getUniformLocation(program, 'u_intensity'),
    fog: gl.getUniformLocation(program, 'u_fog'),
    refraction: gl.getUniformLocation(program, 'u_refraction'),
    speed: gl.getUniformLocation(program, 'u_speed'),
    background: gl.getUniformLocation(program, 'u_background'),
    hasBackground: gl.getUniformLocation(program, 'u_has_background'),
  };

  return { gl, program, vao, positionBuffer, texture, uniforms, vs, fs };
}

function disposeState(s: GLState) {
  const { gl } = s;
  try { gl.deleteBuffer(s.positionBuffer); } catch {}
  try { gl.deleteVertexArray(s.vao); } catch {}
  try { gl.deleteTexture(s.texture); } catch {}
  try { gl.deleteShader(s.vs); } catch {}
  try { gl.deleteShader(s.fs); } catch {}
  try { gl.deleteProgram(s.program); } catch {}
}

const SceneShader: React.FC<Props> = ({ scene, intensity, fog, refraction, speed, backgroundTexture }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GLState | null>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(Date.now());
  const lastTexRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);

  // keep latest props without re-triggering the render loop
  const paramsRef = useRef({ intensity, fog, refraction, speed, backgroundTexture });
  paramsRef.current = { intensity, fog, refraction, speed, backgroundTexture };

  // Build / rebuild program when scene changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl = stateRef.current?.gl;
    if (!gl) {
      gl = canvas.getContext('webgl2', { preserveDrawingBuffer: false, alpha: false }) ?? undefined;
      if (!gl) {
        console.error('[SceneShader] WebGL2 not available');
        return;
      }
    }
    // dispose previous program but keep gl context
    if (stateRef.current) disposeState(stateRef.current);
    const built = buildProgram(gl, scene.fragmentShader);
    if (!built) {
      stateRef.current = null;
      return;
    }
    stateRef.current = built;
    // force texture re-upload on next frame
    lastTexRef.current = null;
  }, [scene]);

  // single continuous render loop
  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      const s = stateRef.current;
      if (!canvas || !s) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      const { gl, program, vao, texture, uniforms } = s;

      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.bindVertexArray(vao);

      const t = (Date.now() - startRef.current) / 1000;
      const p = paramsRef.current;
      gl.uniform2f(uniforms.resolution!, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(uniforms.time!, t);
      gl.uniform1f(uniforms.intensity!, p.intensity);
      gl.uniform1f(uniforms.fog!, p.fog);
      gl.uniform1f(uniforms.refraction!, p.refraction);
      gl.uniform1f(uniforms.speed!, p.speed);

      const bg = p.backgroundTexture;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (bg) {
        const isVideo = bg instanceof HTMLVideoElement;
        if (isVideo || lastTexRef.current !== bg) {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bg);
            lastTexRef.current = bg;
          } catch (e) {
            /* ignore: image may not be ready yet */
          }
        }
        gl.uniform1i(uniforms.background!, 0);
        gl.uniform1i(uniforms.hasBackground!, 1);
      } else {
        gl.uniform1i(uniforms.background!, 0);
        gl.uniform1i(uniforms.hasBackground!, 0);
        lastTexRef.current = null;
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // full teardown on unmount
  useEffect(() => {
    return () => {
      if (stateRef.current) {
        disposeState(stateRef.current);
        stateRef.current = null;
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block touch-none"
      id="scene-canvas"
    />
  );
};

export default SceneShader;
