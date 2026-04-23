import { Scene, wrapShadertoy } from './types';

// Raindrop ripples on an image.
// If u_has_background, ripples distort the user's uploaded texture.
// Otherwise we synthesize a procedural night-sky image so the effect is still
// visible without an upload.
// u_intensity drives ripple strength, u_refraction scales the distortion.
// Common-tab defines supplied here: MAX_RADIUS=2, DOUBLE_HASH=1.

const body = /* glsl */ `
#define MAX_RADIUS 2
#define DOUBLE_HASH 1

#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031, .1030, .0973)

float hash12(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * HASHSCALE3);
    p3 += dot(p3, p3.yzx+19.19);
    return fract((p3.xx+p3.yz)*p3.zy);
}

// Procedural fallback "image" when no user background is uploaded.
vec3 proceduralBg(vec2 uv) {
    vec3 deep  = vec3(0.04, 0.06, 0.18);
    vec3 warm  = vec3(0.35, 0.18, 0.42);
    vec3 sky   = mix(deep, warm, smoothstep(0.0, 1.0, uv.y*0.9 + uv.x*0.15));
    float stars = pow(hash12(floor(uv*800.0)), 120.0);
    sky += stars * vec3(0.8, 0.85, 1.0) * 0.8;
    float glow = exp(-4.0 * length(uv - vec2(0.7, 0.6)));
    sky += vec3(0.8, 0.45, 0.3) * glow * 0.3;
    return sky;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    float resolution = mix(6.0, 14.0, 1.0 - u_intensity); // higher intensity → smaller tile scale → bigger ripples feel
    vec2 uv = fragCoord.xy / u_resolution.y * resolution;
    vec2 p0 = floor(uv);

    vec2 circles = vec2(0.);
    for (int j = -MAX_RADIUS; j <= MAX_RADIUS; ++j) {
        for (int i = -MAX_RADIUS; i <= MAX_RADIUS; ++i) {
            vec2 pi = p0 + vec2(i, j);
            #if DOUBLE_HASH
            vec2 hsh = hash22(pi);
            #else
            vec2 hsh = pi;
            #endif
            vec2 p = pi + hash22(hsh);

            float t = fract(0.3*iTime*u_speed + hash12(hsh));
            vec2 v = p - uv;
            float d = length(v) - (float(MAX_RADIUS) + 1.)*t;

            float h = 1e-3;
            float d1 = d - h;
            float d2 = d + h;
            float p1 = sin(31.*d1) * smoothstep(-0.6, -0.3, d1) * smoothstep(0., -0.3, d1);
            float p2 = sin(31.*d2) * smoothstep(-0.6, -0.3, d2) * smoothstep(0., -0.3, d2);
            circles += 0.5 * normalize(v) * ((p2 - p1) / (2. * h) * (1. - t) * (1. - t));
        }
    }
    circles /= float((MAX_RADIUS*2+1)*(MAX_RADIUS*2+1));

    float intensity = mix(0.015, 0.22, smoothstep(0.1, 0.6, abs(fract(0.05*iTime*u_speed + 0.5)*2.-1.)));
    intensity *= (0.5 + u_refraction * 0.8) * mix(0.6, 1.3, u_intensity);

    vec3 n = vec3(circles, sqrt(max(0.0, 1. - dot(circles, circles))));

    vec2 sampleUv = fragCoord.xy / u_resolution.xy - intensity*n.xy;

    vec3 base;
    if (u_has_background) {
        base = texture(u_background, aspectCoverUV(sampleUv)).rgb;
    } else {
        base = proceduralBg(sampleUv);
    }

    float highlight = 5.0 * pow(clamp(dot(n, normalize(vec3(1., 0.7, 0.5))), 0., 1.), 6.);
    vec3 color = base + highlight;

    // u_fog lifts and desaturates
    color = mix(color, vec3(dot(color, vec3(0.299,0.587,0.114))), u_fog*0.4);
    color = mix(color, vec3(0.78, 0.82, 0.9), u_fog * 0.2);

    fragColor = vec4(color, 1.0);
}
`;

export const ripples: Scene = {
  id: 'ripples',
  name: 'Ripples',
  description: 'Raindrop ripples distort the image beneath. Upload a background for full effect.',
  needsBackground: 'optional',
  fragmentShader: wrapShadertoy(body),
};
