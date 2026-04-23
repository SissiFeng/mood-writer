import { Scene, wrapShadertoy } from './types';

const body = /* glsl */ `
#define S(a, b, t) smoothstep(a, b, t)

vec3 N13(float p) {
   vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787));
   p3 += dot(p3, p3.yzx + 19.19);
   return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
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
    float x = (n - .5) * .8;
    x += (.4 - abs(x)) * sin(3. * w) * pow(sin(w), 6.) * .45;
    float y = -Saw(.85, fract(t*.2));
    vec2 dropPos = (gv-vec2(x,y));
    float d = length(dropPos);

    float mainDrop = S(.4, .0, d);

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
    vec2 staticUV = uv * 40.;
    vec2 sId = floor(staticUV);
    vec2 sfv = fract(staticUV) - 0.5;
    vec3 sRnd = N13(sId.x * 107.45 + sId.y * 3527.4);
    float sn = sRnd.x;
    vec2 sp = (sRnd.yz - 0.5) * 0.7;
    float sd = length(sfv - sp);
    float sFade = Saw(0.025, fract(t + sn));
    float sMask = S(0.3, 0., sd) * sFade * l0;
    vec2 sDistort = sMask * (sfv - sp);

    vec2 m1 = DropLayer2(uv, t) * l1;
    vec2 m2 = DropLayer2(uv * 1.85 + 7.54, t) * l2;
    return sDistort + m1 + m2;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * u_resolution.xy) / u_resolution.y;
    vec2 UV = fragCoord / u_resolution.xy;
    float t = iTime * 0.2 * u_speed;

    float staticIntensity = S(0.2, 0.7, u_intensity) * 1.5;
    float movingIntensity = S(0.0, 1.0, u_intensity);

    vec2 distortion = Drops(uv, t, staticIntensity, movingIntensity, movingIntensity * 0.5);
    vec2 offset = distortion * u_refraction;
    vec2 focus = UV + offset;

    vec4 col;
    if (u_has_background) {
        vec2 f = aspectCoverUV(focus);
        if (u_fog > 0.0) {
            float blur = u_fog * 0.015;
            col = vec4(0);
            col += texture(u_background, f + vec2(-blur, -blur));
            col += texture(u_background, f + vec2(blur, -blur));
            col += texture(u_background, f + vec2(-blur, blur));
            col += texture(u_background, f + vec2(blur, blur));
            col += texture(u_background, f) * 4.0;
            col /= 8.0;
        } else {
            col = texture(u_background, f);
        }
    } else {
        vec2 bg_uv = focus;
        vec3 color1 = vec3(0.05, 0.1, 0.4);
        vec3 color2 = vec3(0.5, 0.2, 0.6);
        vec3 sky = mix(color1, color2, bg_uv.y + bg_uv.x * 0.3 + sin(iTime * 0.1) * 0.1);
        col = vec4(sky, 1.0);
    }

    float d = length(uv);
    col.rgb *= S(1.5, 0.5, d);
    float rainMask = length(distortion) * 5.0;
    col.rgb += rainMask * 0.1 * movingIntensity;

    fragColor = col;
}
`;

export const heartfelt: Scene = {
  id: 'heartfelt',
  name: 'Heartfelt Rain',
  description: 'Raindrops on a window, refracting the world behind. Default mood writer scene.',
  needsBackground: 'optional',
  fragmentShader: wrapShadertoy(body),
};
