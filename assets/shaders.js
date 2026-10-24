window.CX = window.CX || {};
// GLSL (WebGL1) fragment shaders for the procedural boards. Each theme body defines theme(); board-bg.js prepends CX.SHADERS.common.
// uv: screen 0..1, top-left origin. q: board-anchored (follows a flip). f: position inside the square. L: 1 on light squares.
CX.SHADERS = {
  common: `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float t;
uniform vec2 res;
uniform float flip;
uniform vec3 cL;
uniform vec3 cD;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 h22(vec2 p){float n=h21(p);return vec2(n,h21(p+n+17.1));}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float edge(vec2 f){return min(min(f.x,1.-f.x),min(f.y,1.-f.y));}
// Voronoi border distance (F2-F1) with slowly drifting cells.
float vor(vec2 p,float tt){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=h22(i+g);o=.5+.4*sin(tt+6.2831*o);
    float d=length(g+o-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
  return d2-d1;}
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell);
void main(){
  vec2 uv=gl_FragCoord.xy/res;uv.y=1.-uv.y;
  vec2 b=uv*8.;vec2 cell=floor(b);
  float L=1.-mod(cell.x+cell.y,2.);
  vec2 q=flip>.5?1.-uv:uv;
  gl_FragColor=vec4(clamp(theme(uv,q,fract(b),L,cell),0.,1.),1.);
}
`,

  galaxy: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec2 p=q*2.6+vec2(t*.012,-t*.007);
  float n=fbm(p+1.6*fbm(p*1.4+vec2(t*.015,0.)));
  vec3 neb=mix(vec3(.03,.02,.10),vec3(.42,.17,.70),smoothstep(.35,.85,n));
  neb=mix(neb,vec3(.15,.38,.85),smoothstep(.5,.95,fbm(p*1.7+vec2(4.,-t*.01)))*.55);
  vec2 sp=(q+vec2(t*.002,0.))*28.;vec2 si=floor(sp);float r=h21(si);
  vec2 so=fract(sp)-.5-(h22(si)-.5)*.6;
  float star=(smoothstep(.07,0.,length(so))+.35*smoothstep(.22,0.,length(so)))*step(.86,r)*(.55+.45*sin(t*1.7+r*80.));
  vec3 c=L>.5?mix(neb*1.15,cL,.52):mix(neb*.8,cD,.45);
  return c+star*vec3(.85,.88,1.)*(L>.5?.35:.95);
}`,

  aurora: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec3 sky=mix(vec3(.02,.04,.10),vec3(.01,.07,.09),uv.y);
  vec3 ac=vec3(0.);
  for(int i=0;i<2;i++){float fi=float(i);
    float y=.38+.3*fi+.08*sin(uv.x*2.4+t*.1+fi*2.)+.12*(fbm(vec2(uv.x*1.6+t*.02,fi*3.))-.5);
    float dy=uv.y-y;
    float band=dy>0.?exp(-dy*dy*120.):exp(-dy*dy*7.);
    float rays=.45+.55*fbm(vec2(uv.x*18.+t*.05+fi*5.,uv.y*.8));
    ac+=band*rays*(1.-.35*fi)*mix(vec3(.15,.95,.6),vec3(.55,.35,1.),clamp(-dy*2.2,0.,1.));}
  vec2 sp=q*26.;vec2 si=floor(sp);float sr=h21(si+5.);
  sky+=vec3(.8,.9,1.)*smoothstep(.08,0.,length(fract(sp)-.5-(h22(si)-.5)*.6))*step(.9,sr)*(.5+.5*sin(t*1.3+sr*70.))*.6;
  vec3 bg=sky+ac*.9;
  return L>.5?mix(bg,cL,.5)+ac*.18:mix(sky+ac*.45,cD,.6)+ac*.1;
}`,

  lava: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec2 p=q*3.5;
  float n=fbm(p+vec2(t*.04,t*.025)+1.8*fbm(p*1.3-vec2(t*.03,0.)));
  vec3 molten=mix(vec3(.45,.04,0.),vec3(1.,.45,.06),smoothstep(.35,.8,n));
  molten=mix(molten,vec3(1.,.78,.35),smoothstep(.72,.95,n)*.5);
  if(L>.5){
    float s=fbm(q*14.);
    return mix(cL*(.85+.3*s),molten,.28);
  }
  float cr=vor(q*5.,t*.15);
  float glow=smoothstep(.16,.0,cr);
  float pulse=.7+.3*sin(t*.6+n*6.);
  vec3 crust=cD*(.75+.5*fbm(q*22.));
  return crust+molten*glow*pulse*.85;
}`,

  ocean: `
float caustic(vec2 uv,float tt){
  vec2 p=mod(uv*6.28318,6.28318)-250.;vec2 i=p;float c=1.;float inten=.005;
  for(int n=0;n<4;n++){float ts=tt*(1.-(3.5/float(n+1)));
    i=p+vec2(cos(ts-i.x)+sin(ts+i.y),sin(ts-i.y)+cos(ts+i.x));
    c+=1./length(vec2(p.x/(sin(i.x+ts)/inten),p.y/(cos(i.y+ts)/inten)));}
  c/=4.;c=1.17-pow(c,1.4);return pow(abs(c),8.);
}
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  float cs=caustic(q*1.5,t*.35+23.);
  vec3 water=mix(vec3(.02,.18,.32),vec3(.05,.42,.58),fbm(q*3.+t*.03));
  vec3 c=L>.5?mix(water,cL,.62):mix(water,cD,.55);
  return c+cs*(L>.5?vec3(.2,.3,.3):vec3(.16,.38,.45));
}`,

  synthwave: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec3 bg=mix(vec3(.30,.06,.36),vec3(.05,.02,.16),uv.y);
  float z=1.2/(uv.y+.18);
  float gz=abs(fract(z*1.4+t*.18)-.5)/(z*.9);
  float gx=abs(fract((uv.x-.5)*z*5.)-.5)/(z*1.6);
  float grid=smoothstep(.06,0.,min(gz,gx)*1.6)*smoothstep(0.,.5,uv.y);
  vec3 neon=mix(vec3(1.,.25,.75),vec3(.2,.85,1.),uv.y);
  float sun=smoothstep(.8,0.,length(vec2((uv.x-.5)*1.2,uv.y+.15)));
  bg+=vec3(1.,.45,.25)*sun*.25;
  vec3 c=L>.5?mix(bg,cL,.62):mix(bg,cD,.5);
  return c+neon*grid*(L>.5?.25:.55);
}`,

  plasma: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec2 p=q*4.2;
  float v=sin(p.x*1.3+t*.35)+sin(p.y*1.6-t*.28)+sin((p.x+p.y)*1.1+t*.22)
    +sin(length(p-vec2(1.5+sin(t*.17),1.5+cos(t*.13)))*2.4-t*.45);
  vec3 pl=mix(vec3(0.,.85,1.),vec3(1.,.15,.8),smoothstep(-.8,.8,sin(v*1.6)));
  pl=mix(pl,vec3(.35,.12,.9),.2+.15*sin(v*.7+1.));
  float e=edge(f);
  vec3 c=L>.5?mix(pl*.85,cL,.4):cD+pl*.13;
  float rim=smoothstep(.045,.0,e);
  return c+pl*rim*(L>.5?.15:.5);
}`,

  matrix: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec2 g=uv*vec2(40.,40.);vec2 gi=floor(g),gf=fract(g);
  float sp=.6+h21(vec2(gi.x,3.))*1.1;
  float head=mod(t*sp*3.+h21(vec2(gi.x,9.))*80.,64.)-8.;
  float d=head-gi.y;
  float tr=d>=0.&&d<16.?pow(1.-d/16.,1.6):0.;
  vec2 bp=floor(gf*vec2(3.,5.));
  float on=step(.45,h21(gi*13.1+bp+floor(t*1.5+h21(gi)*10.)));
  float inside=step(.15,gf.x)*step(gf.x,.85)*step(.1,gf.y)*step(gf.y,.9);
  float glyph=on*inside;
  float isHead=step(d,.99)*step(0.,d);
  vec3 rain=glyph*(vec3(.15,.95,.4)*tr+vec3(.65,1.,.75)*isHead);
  vec3 c=L>.5?cL*(.85+.3*fbm(q*6.+t*.05)):cD;
  return c+rain*(L>.5?.4:.55);
}`,

  sakura: `
float petal(vec2 p){p.x*=1.7;float d=length(p)-.5;return max(d,-(length(p-vec2(0.,.62))-.2));}
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  float w=fbm(q*2.5+t*.02);
  vec3 c=L>.5?cL*(.97+.06*w):cD*(.93+.14*w);
  for(int k=0;k<2;k++){float fk=float(k);
    float sc=5.+fk*2.5;
    vec2 p=uv*sc+vec2(sin(t*.25+uv.y*3.+fk)*.35-t*.06*(1.+fk),-t*(.22+.1*fk));
    vec2 id=floor(p);vec2 lp=fract(p)-.5;
    float r=h21(id+fk*31.);
    if(r>.42)continue;
    lp-=(h22(id)-.5)*.4;
    float a=t*(.4+r)+r*20.;mat2 m=mat2(cos(a),-sin(a),sin(a),cos(a));
    lp=m*lp;lp.y*=1.+.5*sin(t*1.2+r*9.);
    float d=petal(lp*(2.1-fk*.3));
    float s=smoothstep(.04,-.04,d);
    vec3 pc=mix(vec3(.96,.5,.68),vec3(1.,.9,.94),smoothstep(-.45,.05,d));
    c*=1.-.12*smoothstep(.12,-.1,petal(lp*(2.1-fk*.3)+vec2(-.05,.07)));
    c=mix(c,pc,s*(.9-fk*.25));}
  return c;
}`,

  marble: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec2 p=q*4.+cell*1.7;
  float w=fbm(p*1.2+4.*fbm(p*.7));
  float vein=pow(1.-abs(sin((p.x+p.y)*1.5+w*7.)),12.);
  float fine=pow(1.-abs(sin((p.x-p.y)*3.+fbm(p*2.)*9.)),30.);
  vec3 c;
  if(L>.5) c=cL*(.95+.08*w)-vec3(.28,.27,.25)*vein-vec3(.1)*fine;
  else c=cD*(.85+.3*w)+vec3(.55,.42,.16)*vein*.55+vec3(.16,.13,.06)*fine;
  float sheen=exp(-pow((uv.x+uv.y-mod(t*.06,4.)+1.)*2.2,2.));
  return c+vec3(1.,.95,.85)*sheen*.07;
}`,

  wood: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec2 p=q*8.;
  if(mod(cell.x+cell.y+1.,2.)<.5)p=p.yx;
  p+=h21(cell)*13.;
  float g=fbm(vec2(p.x*.25,p.y*1.6))*2.5+p.y*.9;
  float ring=smoothstep(.2,1.,.5+.5*sin(g*6.2831));
  float fine=noise(vec2(p.x*.6,p.y*24.));
  vec3 c=L>.5?cL*(.93+.06*ring+.03*fine):cD*(.88+.13*ring+.05*fine);
  float sheen=exp(-pow((uv.x*.6+uv.y-mod(t*.05,3.)+.5)*2.5,2.));
  float e=edge(f);
  c*=1.-.12*smoothstep(.04,0.,e);
  return c+vec3(1.,.9,.7)*sheen*.06;
}`,

  glass: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec3 bg=vec3(.12,.14,.28);
  vec2 c1=vec2(.3+.2*sin(t*.11),.3+.2*cos(t*.09));
  vec2 c2=vec2(.7+.2*cos(t*.07),.6+.25*sin(t*.12));
  vec2 c3=vec2(.5+.3*sin(t*.05+2.),.85+.1*cos(t*.1));
  bg+=vec3(.1,.7,.8)*exp(-dot(uv-c1,uv-c1)*5.)*.9;
  bg+=vec3(.75,.35,.9)*exp(-dot(uv-c2,uv-c2)*4.)*.9;
  bg+=vec3(1.,.55,.4)*exp(-dot(uv-c3,uv-c3)*7.)*.5;
  float frost=noise(gl_FragCoord.xy*.7)*.04;
  vec3 c=L>.5?mix(bg,cL,.6)+frost:mix(bg,cD,.66)+frost*.5;
  float hi=smoothstep(.035,0.,min(f.x,f.y));
  float lo=smoothstep(.035,0.,min(1.-f.x,1.-f.y));
  return c+vec3(1.)*hi*.12-vec3(.08)*lo;
}`,

  ember: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  float smoke=fbm(q*3.+vec2(0.,t*.05));
  vec3 c=(L>.5?cL:cD)*(.8+.35*smoke);
  vec3 em=vec3(0.);
  for(int i=0;i<3;i++){float fi=float(i);
    vec2 p=q*vec2(9.,6.)*(1.+fi*.4)+vec2(fi*7.3,t*(.25+fi*.08));
    vec2 id=floor(p);float r=h21(id+fi*11.);
    vec2 o=fract(p)-.5-(h22(id)-.5)*.6;
    em+=smoothstep(.12,0.,length(o))*step(.82,r)*(.5+.5*sin(t*3.+r*50.))*mix(vec3(1.,.35,.05),vec3(1.,.8,.3),r);}
  return c+em*.9+vec3(.6,.15,.02)*smoothstep(0.,1.,uv.y)*.25;
}`,

  ice: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  float crack=smoothstep(.05,0.,vor(q*6.,t*.05));
  float frost=fbm(q*8.+t*.01);
  vec3 c=L>.5?cL*(.92+.12*frost):cD*(.85+.3*frost);
  float shine=pow(max(0.,sin((q.x+q.y)*3.-t*.4)),24.)*.35;
  return c+vec3(.75,.9,1.)*(crack*(L>.5?.18:.35)+shine);
}`,

  cyber: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec2 g=q*32.;vec2 gi=floor(g),gf=fract(g);
  float r=h21(gi);
  float line=(r>.5?smoothstep(.09,0.,abs(gf.y-.5)):smoothstep(.09,0.,abs(gf.x-.5)))*step(.35,h21(gi+3.));
  float node=smoothstep(.2,.05,length(gf-.5))*step(.93,h21(gi+7.));
  float p=pow(.5+.5*sin(gi.x*.7+gi.y*.5-t*1.6+r*6.),6.);
  vec3 neon=mix(vec3(0.,.9,.7),vec3(.1,.5,1.),h21(floor(gi/4.)));
  vec3 c=L>.5?cL:cD;
  return c+neon*(line*(.12+.6*p)+node*.6)*(L>.5?.55:1.);
}`,

  prism: `
vec3 hue(float h){return clamp(abs(fract(h+vec3(0.,.6667,.3333))*6.-3.)-1.,0.,1.);}
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec3 rb=hue(fbm(q*2.+t*.03)+q.x*.4+t*.02);
  float shine=pow(max(0.,sin((q.x-q.y)*4.+t*.3)),16.)*.25;
  return (L>.5?mix(cL,rb,.3):mix(cD,rb*.65,.4))+shine;
}`,

  storm: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  float cl=fbm(q*2.5+vec2(t*.03,0.)+fbm(q*3.-t*.02));
  vec3 sky=mix(vec3(.02,.03,.07),vec3(.42,.45,.58),smoothstep(.3,.75,cl));
  sky+=vec3(.25,.15,.4)*smoothstep(.6,.9,fbm(q*1.5-t*.01))*.5;
  float k=floor(t*3.);
  float fl=step(.985,h21(vec2(k,1.)))*(1.-fract(t*3.));
  float bx=.25+.5*h21(vec2(floor(t*.5),2.));
  float x=bx+.06*(noise(vec2(q.y*12.,k))-.5)+.03*(noise(vec2(q.y*40.,k+3.))-.5);
  float bolt=smoothstep(.006,0.,abs(q.x-x))*fl*step(q.y,.85);
  vec3 c=L>.5?mix(sky,cL,.45):mix(sky*.55,cD,.45);
  return c+vec3(.75,.8,1.)*(fl*.25+bolt*2.);
}`,

  gold: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec2 p=q*3.;
  float n=fbm(p+vec2(t*.03,t*.02)+1.5*fbm(p*1.5-t*.02));
  float spec=pow(smoothstep(.45,.75,n),3.);
  vec3 gold=mix(vec3(.45,.3,.05),vec3(1.,.82,.35),n)+vec3(1.,.95,.8)*spec*.6;
  return L>.5?mix(cL,gold,.45):mix(cD,gold*.5,.4);
}`,

  forest: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  float leaves=fbm(q*5.+vec2(sin(t*.1)*.2,0.));
  vec3 c=L>.5?cL*(.85+.3*leaves):cD*(.8+.4*leaves);
  float ray=pow(max(0.,sin((uv.x*1.2-uv.y*.6)*9.+t*.15+fbm(uv*2.)*2.)),8.)*(1.-uv.y)*.3;
  vec2 sp=q*10.+vec2(sin(t*.3),t*.05);vec2 si=floor(sp);float r=h21(si);
  float ff=smoothstep(.15,0.,length(fract(sp)-.5-(h22(si)-.5)*.5))*step(.9,r)*(.5+.5*sin(t*2.+r*40.));
  return c+vec3(1.,.95,.6)*ray+vec3(.8,1.,.4)*ff*.7;
}`,

  deepsea: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec3 deep=mix(vec3(0.,.03,.08),vec3(0.,.12,.2),fbm(q*2.+t*.02));
  vec3 c=L>.5?mix(deep,cL,.55):mix(deep,cD,.45);
  vec3 b=vec3(0.);
  for(int i=0;i<2;i++){float fi=float(i);
    vec2 p=q*(7.+fi*5.)+vec2(sin(t*.2+fi)*.5,-t*(.06+fi*.03));
    vec2 id=floor(p);float r=h21(id+fi*9.);
    float d=length(fract(p)-.5-(h22(id)-.5)*.7);
    b+=smoothstep(.18,0.,d)*step(.8,r)*(.4+.6*sin(t*1.5+r*60.))*mix(vec3(0.,1.,.8),vec3(.3,.5,1.),r);}
  return c+b*.8;
}`,

  rain: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  vec3 c=(L>.5?cL:cD)*(.82+.18*fbm(q*3.+vec2(0.,t*.03)));
  float s=0.;
  for(int i=0;i<3;i++){float fi=float(i);
    vec2 p=vec2(q.x*(24.+fi*9.),q.y*(5.+fi*2.)-t*(2.+fi*.6));
    float col=floor(p.x),r=h21(vec2(col,fi+3.));
    float y=fract(p.y+r*7.);
    s+=smoothstep(.07,0.,abs(fract(p.x)-.5))*smoothstep(0.,.08,y)*smoothstep(.3,.1,y)*step(.6,r)*(.3+fi*.05);}
  vec2 dp=q*10.;vec2 id=floor(dp);float k=floor(t*.25+h21(id)*4.);
  float dr=h21(id+k*.37),dd=length(fract(dp)-.5-(h22(id+k)-.5)*.6);
  float drop=smoothstep(.15,.04,dd)*step(.84,dr);
  return c+vec3(.55,.7,.95)*s+vec3(.75,.88,1.)*drop*.45;
}`,

  sunset: `
vec3 theme(vec2 uv,vec2 q,vec2 f,float L,vec2 cell){
  float sh=fbm(vec2(q.x*4.,q.y*8.-t*.25))*.02;
  vec2 p=q+vec2(sh,0.);
  float dune=sin(p.x*7.+t*.05+fbm(p*2.)*3.)*.5+.5;
  vec3 sky=mix(vec3(1.,.62,.3),vec3(.75,.24,.32),p.y);
  vec3 c=mix(sky,L>.5?cL:cD,.68);
  c*=.88+.12*smoothstep(.3,.9,dune);
  float glow=smoothstep(.55,0.,length((p-vec2(.5,.35))*vec2(1.,1.6)));
  return c+vec3(1.,.55,.2)*glow*.18;
}`,
};
