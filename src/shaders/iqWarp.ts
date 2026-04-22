import { Scene, wrapShadertoy } from './types';

// Adapted from Inigo Quilez' domain warping examples.
// u_speed drives temporal animation, u_intensity pushes color saturation,
// u_refraction amplifies the warp depth.

const body = /* glsl */ `
const mat2 m = mat2( 0.80,  0.60, -0.60,  0.80 );

float noise_( in vec2 p ) { return sin(p.x)*sin(p.y); }

float fbm4( vec2 p ) {
    float f = 0.0;
    f += 0.5000*noise_( p ); p = m*p*2.02;
    f += 0.2500*noise_( p ); p = m*p*2.03;
    f += 0.1250*noise_( p ); p = m*p*2.01;
    f += 0.0625*noise_( p );
    return f/0.9375;
}

float fbm6( vec2 p ) {
    float f = 0.0;
    f += 0.500000*(0.5+0.5*noise_( p )); p = m*p*2.02;
    f += 0.250000*(0.5+0.5*noise_( p )); p = m*p*2.03;
    f += 0.125000*(0.5+0.5*noise_( p )); p = m*p*2.01;
    f += 0.062500*(0.5+0.5*noise_( p )); p = m*p*2.04;
    f += 0.031250*(0.5+0.5*noise_( p )); p = m*p*2.01;
    f += 0.015625*(0.5+0.5*noise_( p ));
    return f/0.96875;
}

vec2 fbm4_2( vec2 p ) { return vec2(fbm4(p), fbm4(p+vec2(7.8))); }
vec2 fbm6_2( vec2 p ) { return vec2(fbm6(p+vec2(16.8)), fbm6(p+vec2(11.5))); }

float func( vec2 q, out vec4 ron ) {
    float T = iTime * u_speed;
    q += 0.03*sin( vec2(0.27,0.23)*T + length(q)*vec2(4.1,4.3));
    vec2 o = fbm4_2( 0.9*q );
    o += 0.04*sin( vec2(0.12,0.14)*T + length(o));
    float warpBoost = 1.0 + u_refraction * 0.6;
    vec2 n = fbm6_2( 3.0*o * warpBoost );
    ron = vec4( o, n );
    float f = 0.5 + 0.5*fbm4( 1.8*q + 6.0*n );
    return mix( f, f*f*f*3.5, f*abs(n.x) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 p = (2.0*fragCoord - u_resolution.xy) / u_resolution.y;
    float e = 2.0/u_resolution.y;

    vec4 on = vec4(0.0);
    float f = func(p, on);

    vec3 col = vec3(0.0);
    col = mix( vec3(0.2,0.1,0.4), vec3(0.3,0.05,0.05), f );
    col = mix( col, vec3(0.9,0.9,0.9), dot(on.zw,on.zw) );
    col = mix( col, vec3(0.4,0.3,0.3), 0.2 + 0.5*on.y*on.y );
    col = mix( col, vec3(0.0,0.2,0.4), 0.5*smoothstep(1.2,1.3,abs(on.z)+abs(on.w)) );
    col = clamp( col*f*2.0, 0.0, 1.0 );

    vec4 kk;
    vec3 nor = normalize( vec3( func(p+vec2(e,0.0),kk)-f,
                                2.0*e,
                                func(p+vec2(0.0,e),kk)-f ) );

    vec3 lig = normalize( vec3( 0.9, 0.2, -0.4 ) );
    float dif = clamp( 0.3+0.7*dot( nor, lig ), 0.0, 1.0 );
    vec3 lin = vec3(0.70,0.90,0.95)*(nor.y*0.5+0.5) + vec3(0.15,0.10,0.05)*dif;
    col *= 1.2*lin;
    col = 1.0 - col;
    col = 1.1*col*col;

    // u_intensity drives saturation/vibrance of the final image
    float sat = mix(0.6, 1.25, u_intensity);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, sat);

    // u_fog adds an atmospheric white haze
    col = mix(col, vec3(0.85, 0.88, 0.95), u_fog * 0.35);

    fragColor = vec4( col, 1.0 );
}
`;

export const iqWarp: Scene = {
  id: 'iq-warp',
  name: 'Abstract Warp',
  description: 'Flowing painterly noise by Inigo Quilez — dreamy color currents.',
  needsBackground: 'none',
  fragmentShader: wrapShadertoy(body),
};
