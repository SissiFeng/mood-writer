export interface Scene {
  id: string;
  name: string;
  description: string;
  needsBackground: 'none' | 'optional' | 'required';
  fragmentShader: string;
}

/**
 * Wraps Shadertoy-style `mainImage(out vec4, in vec2)` body into a complete
 * WebGL 2.0 GLSL ES 3.00 fragment shader with standardized uniforms.
 *
 * The `body` must define `mainImage` but not declare `out vec4 outColor` or
 * any of the standard uniforms (they're provided by the wrapper).
 */
export function wrapShadertoy(body: string): string {
  return `#version 300 es
precision highp float;
precision highp sampler2D;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
uniform float u_fog;
uniform float u_refraction;
uniform float u_speed;
uniform sampler2D u_background;
uniform bool u_has_background;
uniform float u_bg_aspect;  // background width / height; 0 if no image

// Shadertoy compat
#define iTime u_time
#define iResolution vec3(u_resolution.x, u_resolution.y, 1.0)
#define iMouse vec4(0.0)
#define iChannel0 u_background

in vec2 v_texCoord;
out vec4 outColor;

// object-fit: cover — remap uv so the image fills the viewport without distortion.
// uv is in [0..1]. Works for any aspect ratios.
vec2 aspectCoverUV(vec2 uv) {
  if (u_bg_aspect <= 0.0) return uv;
  float vpAspect = u_resolution.x / u_resolution.y;
  vec2 out_uv = uv;
  if (u_bg_aspect > vpAspect) {
    // image wider than viewport — crop horizontally
    float s = vpAspect / u_bg_aspect;
    out_uv.x = (uv.x - 0.5) * s + 0.5;
  } else {
    // image taller than viewport — crop vertically
    float s = u_bg_aspect / vpAspect;
    out_uv.y = (uv.y - 0.5) * s + 0.5;
  }
  return out_uv;
}

${body}

void main() {
  vec4 fc;
  mainImage(fc, gl_FragCoord.xy);
  outColor = fc;
}
`;
}
