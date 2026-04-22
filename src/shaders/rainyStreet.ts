import { Scene, wrapShadertoy } from './types';

// "Rainy Lights" style by Martijn Steinrucken (BigWings).
// u_speed scales time, u_intensity scales rain drop presence,
// u_refraction scales camera-shake + drop refraction strength.

const body = /* glsl */ `
#define S_(x, y, z) smoothstep(x, y, z)
#define B_(a, b, edge, t) S_(a-edge, a+edge, t)*S_(b+edge, b-edge, t)
#define sat_(x) clamp(x,0.,1.)

#define streetLightCol vec3(1., .7, .3)
#define headLightCol   vec3(.8, .8, 1.)
#define tailLightCol   vec3(1., .1, .1)

#define CAM_SHAKE 1.
#define LANE_BIAS .5

vec3 g_ro; vec3 g_rd;

float rsN(float t){return fract(sin(t*10234.324)*123423.23512);}
vec3  rsN31(float p){
  vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x+p3.y)*p3.z,(p3.x+p3.z)*p3.y,(p3.y+p3.z)*p3.x));
}

float rsDistLine(vec3 ro, vec3 rd, vec3 p){return length(cross(p-ro, rd));}
vec3  rsClosestPoint(vec3 ro, vec3 rd, vec3 p){return ro + max(0., dot(p-ro, rd))*rd;}
float rsRemap(float a, float b, float c, float d, float t){return ((t-a)/(b-a))*(d-c)+c;}

float rsBokeh(vec3 ro, vec3 rd, vec3 p, float size, float blur){
  float d = rsDistLine(ro, rd, p);
  float m = S_(size, size*(1.-blur), d);
  m *= mix(.7, 1., S_(.8*size, size, d));
  return m;
}

float SawTooth(float t){return cos(t+cos(t))+sin(2.*t)*.2+sin(4.*t)*.02;}
float DeltaSawTooth(float t){return 0.4*cos(2.*t)+0.08*cos(4.*t)-(1.-sin(t))*sin(t+cos(t));}

vec2 GetDrops(vec2 uv, float seed, float m){
  float t = iTime*u_speed + m*30.;
  vec2 o = vec2(0.);
  uv.y += t*.05;
  uv *= vec2(10., 2.5)*2.;
  vec2 id = floor(uv);
  vec3 n = rsN31(id.x + (id.y+seed)*546.3524);
  vec2 bd = fract(uv) - .5;
  bd.y *= 4.;
  bd.x += (n.x-.5)*.6;
  t += n.z * 6.28;
  float slide = SawTooth(t);
  float ts = 1.5;
  vec2 trailPos = vec2(bd.x*ts, (fract(bd.y*ts*2.-t*2.)-.5)*.5);
  bd.y += slide*2.;
  float dropShape = bd.x*bd.x;
  dropShape *= DeltaSawTooth(t);
  bd.y += dropShape;
  float d = length(bd);
  float trailMask = S_(-.2, .2, bd.y);
  trailMask *= bd.y;
  float td = length(trailPos*max(.5, trailMask));
  float mainDrop = S_(.2, .1, d);
  float dropTrail = S_(.1, .02, td);
  dropTrail *= trailMask;
  o = mix(bd*mainDrop, trailPos, dropTrail);
  return o;
}

void rsCameraSetup(vec2 uv, vec3 pos, vec3 lookat, float zoom, float m){
  g_ro = pos;
  vec3 f = normalize(lookat-g_ro);
  vec3 r = cross(vec3(0.,1.,0.), f);
  vec3 u = cross(f, r);
  float t = iTime*u_speed;

  float dropScale = mix(0.6, 1.6, u_intensity);
  float x = (sin(t*.1)*.5+.5)*.5;
  x = -x*x;
  float s = sin(x); float c = cos(x);
  mat2 rot = mat2(c,-s,s,c);
  vec2 dropUv = uv*rot;
  dropUv.x += -sin(t*.1)*.5;

  vec2 offs = GetDrops(dropUv, 1., m);
  offs += GetDrops(dropUv*1.4, 10., m);
  offs += GetDrops(dropUv*2.4, 25., m);
  offs *= dropScale * (0.6 + u_refraction * 0.6);

  float ripple = sin(t+uv.y*3.1415*30.+uv.x*124.)*.5+.5;
  ripple *= .005;
  offs += vec2(ripple*ripple, ripple);

  vec3 center = g_ro + f*zoom;
  vec3 i = center + (uv.x-offs.x)*r + (uv.y-offs.y)*u;
  g_rd = normalize(i-g_ro);
}

vec3 HeadLights(float i, float t){
  float z = fract(-t*2.+i);
  vec3 p = vec3(-.3, .1, z*40.);
  float d = length(p-g_ro);
  float size = mix(.03,.05,S_(.02,.07,z))*d;
  float m = 0.; float blur = .1;
  m += rsBokeh(g_ro,g_rd,p-vec3(.08,0,0),size,blur);
  m += rsBokeh(g_ro,g_rd,p+vec3(.08,0,0),size,blur);
  m += rsBokeh(g_ro,g_rd,p+vec3(.1,0,0),size,blur);
  m += rsBokeh(g_ro,g_rd,p-vec3(.1,0,0),size,blur);
  float distFade = max(.01, pow(1.-z, 9.));
  blur = .8; size *= 2.5;
  float r = rsBokeh(g_ro,g_rd,p+vec3(-.09,-.2,0),size,blur)
          + rsBokeh(g_ro,g_rd,p+vec3(.09,-.2,0),size,blur);
  r *= distFade*distFade;
  return headLightCol*(m+r)*distFade;
}

vec3 TailLights(float i, float t){
  t = t*1.5+i;
  float id = floor(t)+i;
  vec3 n = rsN31(id);
  float laneId = S_(LANE_BIAS, LANE_BIAS+.01, n.y);
  float ft = fract(t);
  float z = 3.-ft*3.;
  laneId *= S_(.2,1.5,z);
  float lane = mix(.6,.3,laneId);
  vec3 p = vec3(lane,.1,z);
  float d = length(p-g_ro);
  float size = .05*d; float blur = .1;
  float m = rsBokeh(g_ro,g_rd,p-vec3(.08,0,0),size,blur)
          + rsBokeh(g_ro,g_rd,p+vec3(.08,0,0),size,blur);
  float bs = n.z*3.;
  float brake = S_(bs, bs+.01, z);
  brake *= S_(bs+.01, bs, z-.5*n.y);
  m += (rsBokeh(g_ro,g_rd,p+vec3(.1,0,0),size,blur)
      + rsBokeh(g_ro,g_rd,p-vec3(.1,0,0),size,blur))*brake;
  float refSize = size*2.5;
  m += rsBokeh(g_ro,g_rd,p+vec3(-.09,-.2,0), refSize, .8);
  m += rsBokeh(g_ro,g_rd,p+vec3(.09,-.2,0),  refSize, .8);
  vec3 col = tailLightCol*m*ft;
  float b = rsBokeh(g_ro,g_rd,p+vec3(.12,0,0),size,blur);
  b += rsBokeh(g_ro,g_rd,p+vec3(.12,-.2,0), refSize, .8)*.2;
  vec3 blinker = vec3(1.,.7,.2);
  blinker *= S_(1.5,1.4,z)*S_(.2,.3,z);
  blinker *= sat_(sin(t*200.)*100.);
  blinker *= laneId;
  col += blinker*b;
  return col;
}

vec3 StreetLights(float i, float t){
  float side = sign(g_rd.x);
  float offset = max(side,0.)*(1./16.);
  float z = fract(i-t+offset);
  vec3 p = vec3(2.*side, 2., z*60.);
  float d = length(p-g_ro);
  float distFade = rsRemap(1.,.7,.1,1.5, 1.-pow(1.-z,6.));
  distFade *= (1.-z);
  float m = rsBokeh(g_ro,g_rd,p,.05*d,.1)*distFade;
  return m*streetLightCol;
}

vec3 EnvironmentLights(float i, float t){
  float n = rsN(i+floor(t));
  float side = sign(g_rd.x);
  float offset = max(side,0.)*(1./16.);
  float z = fract(i-t+offset+fract(n*234.));
  float n2 = fract(n*100.);
  vec3 p = vec3((3.+n)*side, n2*n2*n2, z*60.);
  float distFade = rsRemap(1.,.7,.1,1.5, 1.-pow(1.-z,6.));
  float m = rsBokeh(g_ro,g_rd,p,.05*length(p-g_ro),.1);
  m *= distFade*distFade*.5;
  m *= 1.-pow(sin(z*6.28*20.*n)*.5+.5, 20.);
  vec3 randomCol = vec3(fract(n*-34.5), fract(n*4572.), fract(n*1264.));
  vec3 col = mix(tailLightCol, streetLightCol, fract(n*-65.42));
  col = mix(col, randomCol, n);
  return m*col*.2;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  float t = iTime * u_speed;
  vec3 col = vec3(0.);
  vec2 uv = fragCoord.xy / u_resolution.xy;
  uv -= .5;
  uv.x *= u_resolution.x/u_resolution.y;

  vec3 pos = vec3(.3, .15, 0.);
  float bt = t * 5.;
  float h1 = rsN(floor(bt));
  float h2 = rsN(floor(bt+1.));
  float bumps = mix(h1, h2, fract(bt))*.1;
  bumps = bumps*bumps*bumps * CAM_SHAKE;
  pos.y += bumps;
  float lookatY = pos.y + bumps;
  vec3 lookat  = vec3(0.3, lookatY, 1.);
  vec3 lookat2 = vec3(0.,  lookatY, .7);
  lookat = mix(lookat, lookat2, sin(t*.1)*.5+.5);
  uv.y += bumps*4.;
  rsCameraSetup(uv, pos, lookat, 2., 0.0);

  t *= .03;

  float stp = 1./8.;
  for(float i=0.; i<1.; i+=stp){ col += StreetLights(i, t); }
  for(float i=0.; i<1.; i+=stp){
    float n = rsN(i+floor(t));
    col += HeadLights(i+n*stp*.7, t);
  }
  stp = 1./32.;
  for(float i=0.; i<1.; i+=stp){ col += EnvironmentLights(i, t); }
  col += TailLights(0., t);
  col += TailLights(.5, t);
  col += sat_(g_rd.y)*vec3(.6, .5, .9);

  // u_fog dampens saturation and lifts blacks
  col = mix(col, vec3(dot(col, vec3(0.299,0.587,0.114))), u_fog*0.5);
  col += u_fog * vec3(0.04, 0.05, 0.07);

  fragColor = vec4(col, 1.0);
}
`;

export const rainyStreet: Scene = {
  id: 'rainy-street',
  name: 'Rainy Street',
  description: 'Night drive through rain — head and tail lights bloom through a wet windshield.',
  needsBackground: 'none',
  fragmentShader: wrapShadertoy(body),
};
