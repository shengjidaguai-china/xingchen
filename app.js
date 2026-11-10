'use strict';
const $=s=>document.querySelector(s),canvas=$('#scene');
const inkCanvas=$('#ink'),ink=inkCanvas.getContext('2d');let inkPoints=[],meteors=[],inkDirty=false;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t),TAU=Math.PI*2;
let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
let gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'default'});
let W=0,H=0,D=1,time=0,last=0,opening=0,targetOpening=0,morphVelocity=0,yaw=0,pitch=.12,targetYaw=0,targetPitch=.12,zoom=1.16,targetZoom=1.16,mode='auto',bodyIndex=0,transition=1,transitionStart=0,queuedBody=null,orbitAngle=0;
let detecting=false,cameraSession=0,recoveringTracker=false,trackingFrame=null,trackingTimer=null;
let cameraOn=false,stream,handTracker,lastDetect=0,lastSeen=0,primaryLabel=null,lastSwitch=-5000,lastSecondarySeen=0,swipeSamples=[],writing=false,inkLast=null,writingSince=0;
let swipeState=null,secondaryRestUntil=0,mainCenter=null,lastHandAssignment=null;
let toastTimer;function toast(t){$('#toast').textContent=t;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),5000);}
function status(t){$('#status').textContent=t;}
const frontView={yaw:.22,pitch:.30};
const basePitch=id=>id===1?.20:.12;
const bodies=[{name:'猎户云海',english:'The Orion Clouds',number:'01 / M42',closed:'完整星图',open:'旋转星尘'}, {name:'风车星系',english:'The Pinwheel Galaxy',number:'02 / M101',closed:'完整星图',open:'旋转星尘'}, {name:'星云之花',english:'The Celestial Bloom',number:'03 / DREAM',closed:'星云之花',open:'旋转星尘'}];
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(v,f){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
function buffer(data){let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b;}
function attr(p,name,b,n){const l=gl.getAttribLocation(p,name);if(l<0)return;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,n,gl.FLOAT,false,0,0);}
function useProgram(p){for(let i=0;i<8;i++)gl.disableVertexAttribArray(i);gl.useProgram(p);}
function uniform(p,name,...values){const l=gl.getUniformLocation(p,name);if(values.length===1)gl.uniform1f(l,values[0]);if(values.length===2)gl.uniform2f(l,...values);if(values.length===3)gl.uniform3f(l,...values);}
const transform=`vec3 rotate(vec3 p){float cy=cos(uView.x),sy=sin(uView.x),cx=cos(uView.y),sx=sin(uView.y);p=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);return vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);}vec4 project(vec3 p){float z=7.2-p.z;return vec4(p.x*1.9/uAspect,p.y*1.9,((z-1.)/12.*2.-1.)*z,z);}`;
const bgVS=`attribute vec2 aPosition;varying vec2 uv;void main(){uv=aPosition;gl_Position=vec4(aPosition,0.,1.);}`;
const bgFS=`precision highp float;varying vec2 uv;uniform float uTime,uAspect;uniform vec2 uView;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.04+3.;a*=.5;}return v;}
void main(){vec2 p=uv*vec2(uAspect,1.);p+=uView*.07;float t=uTime*.012;vec2 q=vec2(fbm(p*1.3+vec2(t,0)),fbm(p*1.3+4.-t));float f=fbm(p*2.+q*2.5+vec2(t,-t));float band=exp(-pow((p.y+.28*p.x+.17*sin(p.x*1.6))*.95,2.));vec3 col=vec3(.008,.016,.030);col+=vec3(.025,.088,.14)*pow(f,2.)*band;col+=vec3(.11,.035,.13)*pow(fbm(p*2.6+q-t+7.),3.)*.8;col+=vec3(.04,.09,.13)*exp(-dot(p-vec2(-.4,.1),p-vec2(-.4,.1))*.7)*.35;col*=1.-.32*dot(uv,uv);vec2 sp=(p+vec2(uTime*.0009,0.))*155.;vec2 cell=floor(sp),sf=fract(sp)-.5;float h=hash(cell);float st=exp(-dot(sf,sf)*48.)*step(.98,h);st+=exp(-abs(sf.x)*120.-abs(sf.y)*9.)*step(.998,h)*.45;col+=vec3(.55,.73,1.)*st*(.6+.4*sin(uTime*(.3+h)+h*100.));gl_FragColor=vec4(col*1.35,1.);}`;
// Both the cloud surface and its samples release at the same point in this field.
const releaseGLSL=`
 float releaseAt(vec2 uv) {
  vec2 p=uv*2.-1.;
  float flow=sin(p.x*8.+p.y*3.+2.15*sin(p.y*4.4-p.x*3.)+.7*sin(p.y*14.+p.x*3.));
  return .15+clamp(length(p*vec2(.89,1.))*.52,0.,.55)*.65+flow*.076+.032*sin((p.x+p.y)*23.);
 }
 vec3 driftAtlas(vec3 p, float time) {
  float a=.065*sin(time*.22),cs=cos(a),sn=sin(a);
  p.z+=sin(p.x*1.8+p.y*2.+time*.23)*.035;
  p.xy=mat2(cs,sn,-sn,cs)*p.xy*(1.+.009*sin(time*.28));
  return p;
 }`;
function releaseAt(u,v){
 const x=u*2-1,y=v*2-1;
 const flow=Math.sin(x*8+y*3+2.15*Math.sin(y*4.4-x*3)+.7*Math.sin(y*14+x*3));
 return .15+clamp(Math.hypot(x*.89,y)*.52,0,.55)*.65+flow*.076+.032*Math.sin((x+y)*23);
}
const particleVS=`precision highp float;
attribute vec3 aOpen,aClosed,aColor;
attribute vec2 aUV;
attribute vec4 aMeta;
uniform float uTime,uOpening,uAspect,uScale,uPixel,uOpacity,uOrbit,uIsStar;
uniform vec2 uView;
varying vec3 color;
varying float alpha,kind,streak;
varying vec2 tangent;
${transform}${releaseGLSL}
void main(){
 vec3 p=aClosed;
 float pointSize=aMeta.x;
 float light=aMeta.y;
 kind=aMeta.z; streak=0.; tangent=vec2(1.,0.);
 color=aColor;
 if(uIsStar<.5){
  float release=releaseAt(aUV);
  float lift=smoothstep(release-.07,.94,uOpening);
  float detached=smoothstep(release+.035,release+.18,uOpening);
  float rim=smoothstep(release-.08,release+.025,uOpening)*(1.-detached);
  float lane=sin(aMeta.w*2.);
  p=mix(driftAtlas(aClosed,uTime),aOpen,lift);
  float turn=(uOrbit*(1.+lane*.19)+length(aClosed.xy)*.24)*lift;
  float cs=cos(turn),sn=sin(turn);
  p.xy=mat2(cs,sn,-sn,cs)*p.xy;
  p.z+=sin(uTime*.48+aMeta.w)*.20*lift;
  tangent=normalize(vec2(-p.y,-p.x)+.0001);
  streak=step(.2,kind)*step(kind,.9)*lift;
  float shimmer=.92+.08*sin(uTime*1.9+aMeta.w*6.);
  light*=shimmer*(detached+rim*1.25);
  color=mix(aColor,vec3(1.,.94,.83),rim*.18);
  if(kind<.2) light*=.62+.38*lift;
  pointSize*=1.+rim*.32+streak*.72;
 }
 p=rotate(p)*uScale;
 gl_Position=project(p);
 float dist=max(.15,7.2-p.z);
 gl_PointSize=clamp(pointSize*uPixel*7.2/dist*uScale,1.,46.);
 alpha=light*uOpacity*smoothstep(.16,.95,dist);
}`;
const particleFS=`precision mediump float;
varying vec3 color;
varying float alpha,kind,streak;
varying vec2 tangent;
void main(){
 vec2 q=(gl_PointCoord-.5)*2.;
 float r=length(q);
 if(r>1.||alpha<.001)discard;
 float fade=1.-smoothstep(.65,1.,r);
 float halo=exp(-r*r*5.);
 float core=exp(-r*r*38.);
 if(kind<.2){gl_FragColor=vec4(color,halo*fade*alpha*.42);return;}
 if(kind>1.5)core+=exp(-abs(q.x)*33.-abs(q.y)*5.)*.22+exp(-abs(q.y)*33.-abs(q.x)*5.)*.22;
 float along=dot(q,tangent),crossing=dot(q,vec2(-tangent.y,tangent.x));
 float tail=exp(-crossing*crossing*110.-abs(along)*4.2)*streak;
 gl_FragColor=vec4(color*1.17,(halo*.20+core*.86+tail*.42)*fade*alpha);
}`;
let bg,particles,quad,starBuffers,bodyBuffers,previousBuffers,models=[],N=72000;
function makeModel(){return {open:new Float32Array(N*3),closed:new Float32Array(N*3),color:new Float32Array(N*3),uv:new Float32Array(N*2),meta:new Float32Array(N*4)};}
function put(m,i,o,c,col,size,alpha,kind){m.open.set(o,i*3);m.closed.set(c,i*3);m.color.set(col,i*3);m.meta.set([size,alpha,kind,random()*TAU],i*4);}
function upload(m){return {open:buffer(m.open),closed:buffer(m.closed),color:buffer(m.color),uv:m.uv?buffer(m.uv):null,meta:buffer(m.meta)};}
function initGL(){
 bg=program(bgVS,bgFS);particles=program(particleVS,particleFS);quad=buffer(new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]));
 let stars={open:[],closed:[],color:[],meta:[]};for(let i=0;i<2300;i++){let p=[(random()-.5)*27,(random()-.5)*17,-2-random()*7];stars.open.push(...p);stars.closed.push(...p);stars.color.push(.5+random()*.5,.65+random()*.35,.8+random()*.2);stars.meta.push(random()<.02?4.8:1+random()*1.3,.25+random()*.65,1,random()*TAU);}for(let k in stars)stars[k]=new Float32Array(stars[k]);starBuffers=upload(stars);
}
let modelBuffers=[];
function selectBody(i){i=(i+bodies.length)%bodies.length;if(!modelBuffers[i]){status('这张星图尚未就绪 · 稍后可重试');return;}if(transition<.999){queuedBody=i;return;}if(i===bodyIndex)return;previousBuffers=bodyBuffers;bodyIndex=i;bodyBuffers=modelBuffers[bodyIndex];transition=previousBuffers?0:1;transitionStart=time;targetYaw=0;targetPitch=basePitch(bodyIndex);swipeSamples=[];swipeState=null;lastSwitch=performance.now();
 const credits=[
  ['https://esahubble.org/images/heic0601a/', 'NASA, ESA, M. Robberto (Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team'],
  ['https://esahubble.org/images/heic0602a/', 'European Space Agency & NASA'],
  ['./素材来源.txt', '星云之花 · AI 生成']
 ];
 const credit=$('#photoCredit a');
 [credit.href,credit.textContent]=credits[bodyIndex];
 const b=bodies[bodyIndex];$('#objectName').textContent=b.name;$('#objectEnglish').textContent=b.english;$('#objectNumber').textContent=b.number;document.querySelectorAll('[data-body]').forEach(el=>{el.classList.toggle('active',+el.dataset.body===bodyIndex);el.setAttribute('aria-pressed',String(+el.dataset.body===bodyIndex));});toast(`0${bodyIndex+1} / ${b.name}`);
}
function showInitialObservation(){
 if(bodyBuffers)return;
 if(modelBuffers[0]){
  bodyBuffers=previousBuffers=modelBuffers[0];
  return;
 }
 const first=modelBuffers.findIndex(Boolean);
 if(first<0)throw Error('暂时无法加载星图，请重试');
 selectBody(first);
}
function updateTransition(){if(transition<1)transition=smooth(clamp((time-transitionStart)/2));if(transition>=1&&queuedBody!==null){const next=queuedBody;queuedBody=null;selectBody(next);}}
function advanceOpening(dt){
 // A critically damped motion keeps momentum when the hand reverses, without restarting the reveal.
 // A full gesture takes about 2.4 seconds to reach 95%; view tracking keeps its own fast response.
 const target=clamp(targetOpening),omega=2,error=opening-target,c=morphVelocity+omega*error,decay=Math.exp(-omega*dt);
 opening=clamp(target+(error+c*dt)*decay);morphVelocity=(morphVelocity-omega*c*dt)*decay;
 if(Math.abs(opening-target)<.001&&Math.abs(morphVelocity)<.005){opening=target;morphVelocity=0;}
}
function advanceMorph(dt){
 orbitAngle+=dt*.46*smooth(clamp((opening-.20)/.65));
 zoom=1.16+smooth(opening)*.29;
 updateTransition();
}
function common(p,scale=1){uniform(p,'uTime',time);uniform(p,'uAspect',W/H);uniform(p,'uView',yaw,pitch);uniform(p,'uScale',scale);uniform(p,'uOpening',opening);}
function drawPoints(current,count,scale,opacity){
 if(opacity<.001)return;
 const isStar=current===starBuffers;
 if(!isStar&&opening<.02)return;
 useProgram(particles);common(particles,scale);
 uniform(particles,'uPixel',D*H/850);
 uniform(particles,'uOpacity',opacity*(isStar?.75:1.95));
 uniform(particles,'uOrbit',orbitAngle);
 uniform(particles,'uIsStar',isStar?1:0);
 attr(particles,'aOpen',current.open,3);
 attr(particles,'aClosed',current.closed,3);
 attr(particles,'aColor',current.color,3);
 attr(particles,'aMeta',current.meta,4);
 if(current.uv)attr(particles,'aUV',current.uv,2);
 gl.drawArrays(gl.POINTS,0,count);
}
function bodyScale(id){return zoom*Math.min(1.17,.92*W/H+.22)*(id===2?1.28:1);}
function renderPhase(){
 $('#amount').textContent=String(Math.round(opening*100)).padStart(3,'0')+'%';
 $('#meter').style.width=opening*100+'%';
 $('#phase').textContent=opening<.10?bodies[bodyIndex].closed:opening<.44?'云层释光':opening<.81?'星尘离场':'星辰入轨';
 if(document.activeElement!==$('#aperture'))$('#aperture').value=opening*100;
}
function resize(){W=innerWidth;H=innerHeight;D=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(W*D);canvas.height=Math.round(H*D);if(gl)gl.viewport(0,0,canvas.width,canvas.height);inkCanvas.width=canvas.width;inkCanvas.height=canvas.height;}
function paintPrologue(sequence, drawBody){
 const savedOpening=opening,savedOrbit=orbitAngle;
 opening=sequence.opening;orbitAngle=sequence.orbit;
 drawBody(2,bodyScale(2)*sequence.scale,sequence.light);
 opening=savedOpening;orbitAngle=savedOrbit;
 if(sequence.reveal>0)drawBody(bodyIndex,bodyScale(bodyIndex),sequence.reveal);
}
function drawBody(id,scale,opacity){
 if(!modelBuffers[id])return;
 drawPhoto(id,scale,opacity);
 drawPoints(modelBuffers[id],N,scale,opacity);
}
function drawSky(){
 gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);useProgram(bg);attr(bg,'aPosition',quad,2);uniform(bg,'uTime',time);uniform(bg,'uAspect',W/H);uniform(bg,'uView',yaw,pitch);gl.drawArrays(gl.TRIANGLES,0,6);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);drawPoints(starBuffers,2300,1,1);
}
function frame(ms){let dt=Math.min((ms-last)/1000,.12);last=ms;time=ms/1000;let ease=1-Math.exp(-dt*(cameraOn?12:7));advanceOpening(dt);yaw=mix(yaw,clamp(targetYaw,-frontView.yaw,frontView.yaw),ease);pitch=mix(pitch,clamp(targetPitch,-.08,frontView.pitch),ease);advanceMorph(dt);
 if(prologue.waiting){requestAnimationFrame(frame);return;}
 const sequence=prologue.frame(ms);
 drawSky();
 if(sequence){
  paintPrologue(sequence,drawBody);
 }else if(bodyBuffers){
  const autoYaw=Math.sin(time*.13)*.055;
  yaw+=autoYaw;
  const oldId=Math.max(0,modelBuffers.indexOf(previousBuffers));
  if(oldId!==bodyIndex)drawBody(oldId,bodyScale(oldId),1-transition);
  drawBody(bodyIndex,bodyScale(bodyIndex),transition);
  yaw-=autoYaw;
 }
 if(!sequence)renderPhase();
 if(!gl.isContextLost())requestAnimationFrame(frame);
}
function mouse(e){if(cameraOn)return;mode='mouse';targetYaw=clamp((e.clientX/W-.5)*.40,-frontView.yaw,frontView.yaw);targetPitch=clamp(basePitch(bodyIndex)+(e.clientY/H-.5)*.22,-.08,frontView.pitch);status('滚轮或滑杆 · 星图化为旋转星尘');}
canvas.addEventListener('pointermove',mouse);canvas.addEventListener('pointerdown',e=>{if(cameraOn)return;canvas.setPointerCapture(e.pointerId);targetOpening=1;mouse(e);});function release(){if(!cameraOn&&mode!=='slider')targetOpening=0;}canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('wheel',e=>{e.preventDefault();if(!cameraOn){mode='slider';targetOpening=clamp(targetOpening-e.deltaY*.0009);status('滚轮 · 缩小还原星图，放大释放星尘');}},{passive:false});
$('#aperture').oninput=e=>{if(cameraOn)return;mode='slider';targetOpening=+e.target.value/100;status('星图 → 星尘 · 拖动滑杆观察渐变');};
document.querySelectorAll('[data-body]').forEach(b=>b.onclick=()=>selectBody(+b.dataset.body));$('#clean').onclick=()=>document.body.classList.toggle('clean');addEventListener('keydown',e=>{if(e.code==='KeyH')document.body.classList.toggle('clean');if(e.code==='ArrowRight'&&!['INPUT','BUTTON'].includes(e.target.tagName))selectBody((bodyIndex+1)%bodies.length);if(e.code==='Space'&&!cameraOn&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='INPUT'){e.preventDefault();mode='mouse';targetOpening=1;}});addEventListener('keyup',e=>{if(e.code==='Space'&&!cameraOn)targetOpening=0;});
const cameraFrame=$('#cameraFrame'),previewToggle=$('#toggleCameraPreview'),cameraButton=$('#start');
function setCameraPreview(visible){
 cameraFrame.hidden=!visible;
 previewToggle.hidden=!cameraOn;
 previewToggle.textContent=visible?'隐藏预览':'显示预览';
 previewToggle.setAttribute('aria-expanded',String(visible));
}
previewToggle.onclick=()=>setCameraPreview(cameraFrame.hidden);
$('#swapHands').onclick=swapHandRoles;

function stopCamera(){
 cameraOn=false;cameraSession++;stopTrackingLoop();
 stream?.getTracks().forEach(t=>t.stop());stream=null;$('#camera').srcObject=null;
 setCameraPreview(false);
 drawSkeleton([]);
 $('#handLabel').textContent='寻找主手';
 $('#gestureHint').textContent='副手侧挥切换 · 只伸食指写字';
 $('#gestureMeter i').style.width='0%';
 cameraButton.textContent='开启手掌交互 ↗';
 primaryLabel=null;mainCenter=null;lastHandAssignment=null;writing=false;writingSince=0;inkLast=null;resetSwipe();
 mode='auto';status('完整星图 · 滚轮放大化为旋转星尘');
}
cameraButton.onclick=async()=>{
 if(cameraOn){stopCamera();return;}
 cameraButton.disabled=true;
 let stage='model';
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('请用支持摄像头的浏览器打开 HTTPS 体验页');
  status('正在载入本地双手识别模型…');
  if(!handTracker)handTracker=await createHandTracker();
  stage='camera';status('请在浏览器提示中允许摄像头…');
  stream=await navigator.mediaDevices.getUserMedia({video:{
   width:{ideal:1280},height:{ideal:720},aspectRatio:{ideal:16/9},frameRate:{ideal:30,max:30},
   resizeMode:'crop-and-scale',facingMode:'user'
  },audio:false});
  const video=$('#camera');
  video.srcObject=stream;await video.play();
  cameraOn=true;mode='hand';primaryLabel=null;mainCenter=null;swipeState=null;secondaryRestUntil=0;
  lastSeen=performance.now();lastDetect=0;lastSwitch=-5000;
  setCameraPreview(true);startTrackingLoop();
  cameraButton.textContent='关闭摄像头';
  status('先伸出主手 · 捏合看星图，张开化为旋转星尘');
  toast('手势识别已开启 · 副手侧挥切换，食指写光字');
 }catch(e){
  stopCamera();
  let message=e.name==='NotAllowedError'?'摄像头未获许可：请点地址栏摄像头图标允许后重试':
   e.name==='NotFoundError'?'没有找到摄像头，请检查摄像头连接':
   e.name==='NotReadableError'?'摄像头被占用，请关闭其他使用摄像头的应用后重试':
   stage==='model'?'识别文件加载失败：请刷新体验页后重试':`摄像头启动失败：${e.message}`;
  status(message);toast(message);console.error('Hand interaction:',e);
 }finally{cameraButton.disabled=false;}
};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);const pinch=h=>dist(h[4],h[8])/Math.max(dist(h[5],h[17]),.035);
// Recognition consumes one fresh video frame after the previous result, independently of art rendering.
function stopTrackingLoop(){
 const video=$('#camera');if(trackingFrame!==null)video.cancelVideoFrameCallback?.(trackingFrame);
 clearTimeout(trackingTimer);trackingFrame=trackingTimer=null;
}
function startTrackingLoop(){
 stopTrackingLoop();const session=cameraSession;
 const schedule=()=>{
  if(!cameraOn||cameraSession!==session)return;
  const video=$('#camera');let fired=false;
  const tick=async()=>{if(fired)return;fired=true;if(trackingFrame!==null)video.cancelVideoFrameCallback?.(trackingFrame);clearTimeout(trackingTimer);trackingFrame=trackingTimer=null;if(!cameraOn||cameraSession!==session)return;await track(performance.now());schedule();};
  if(video.requestVideoFrameCallback){
   trackingFrame=video.requestVideoFrameCallback(()=>{trackingFrame=null;return tick();});
   // Hidden previews may stop compositor callbacks; continue recognition without a frame queue.
   trackingTimer=setTimeout(tick,100);
  }else trackingTimer=setTimeout(tick,33);
 };schedule();
}
function track(ts){
 const video=$('#camera');if(detecting||recoveringTracker||ts-lastDetect<30||video.readyState<2)return;
 lastDetect=ts;const session=cameraSession,inferenceStarted=performance.now();
 try{
  const result=handTracker.detectForVideo(video,ts);
  const apply=value=>{if(cameraOn&&cameraSession===session){canvas.dataset.trackingMs=String(Math.round(performance.now()-inferenceStarted));applyHandResult(value,ts);}};
  if(result&&typeof result.then==='function'){
   detecting=true;
   return result.then(apply).catch(e=>{if(cameraOn&&cameraSession===session)return handleTrackingError(e);}).finally(()=>{detecting=false;});
  }else apply(result);
 }catch(e){return handleTrackingError(e);}
}
async function handleTrackingError(error){
 if(recoveringTracker)return;console.error('Hand tracking:',error);
 if(handTracker?.kind!=='compatible'){
  recoveringTracker=true;status('正在切换兼容识别…');const session=cameraSession;
  try{
   try{handTracker?.close?.();}catch(_){}handTracker=null;
   const replacement=await createHandTracker(true);
   handTracker=replacement;
   if(cameraOn&&cameraSession===session)status('兼容识别已开启 · 请伸出主手');
  }catch(e){await stopCamera();status('识别启动失败，请刷新页面后重试');toast('识别启动失败，请刷新页面后重试');console.error(e);}
  finally{recoveringTracker=false;}
 }else{
  handTracker.close();handTracker=null;await stopCamera();
  status('手部识别中断，请刷新页面后重试');toast('手部识别中断，请刷新页面后重试');
 }
}
function applyHandResult(result,ts){
 const hands=result.landmarks||[],labels=(result.handedness||[]).map(a=>a[0].categoryName);if(!hands.length){lastHandAssignment=null;if(ts-lastSeen>700){status('暂未看到主手 · 请将手掌移回画面');$('#handLabel').textContent='等待主手';drawSkeleton([]);}if(ts-lastSecondarySeen>550){resetSwipe();writing=false;inkLast=null;writingSince=0;}return;}
 if(primaryLabel===null){primaryLabel=labels[0];toast('主手已锁定 · 副手侧挥切换，只伸食指写字');}
 let index=labels.indexOf(primaryLabel);
 // Follow the nearby palm through brief handedness flicker, without taking over a distant secondary hand.
 const centers=hands.map(h=>[0,5,9,13,17].reduce((v,k)=>({x:v.x+h[k].x/5,y:v.y+h[k].y/5}),{x:0,y:0}));
 if(mainCenter&&ts-lastSeen<500){let nearest=0;centers.forEach((c,i)=>{if(dist(c,mainCenter)<dist(centers[nearest],mainCenter))nearest=i;});if(dist(centers[nearest],mainCenter)<.20&&(index<0||dist(centers[nearest],mainCenter)+.08<dist(centers[index],mainCenter)))index=nearest;}
 const main=index>=0?hands[index]:null,secondaryIndex=hands.findIndex((h,i)=>i!==index&&(index>=0||labels[i]!==primaryLabel)),secondary=secondaryIndex>=0?hands[secondaryIndex]:null;
 lastHandAssignment=main&&secondary?{main,secondary,mainLabel:labels[index],secondaryLabel:labels[secondaryIndex],t:ts}:null;
 if(main){lastSeen=ts;let center=[0,5,9,13,17].reduce((v,k)=>({x:v.x+main[k].x/5,y:v.y+main[k].y/5}),{x:0,y:0});targetOpening=smooth(clamp((pinch(main)-.16)/1.25));targetYaw=clamp((.5-center.x)*.7,-frontView.yaw,frontView.yaw);targetPitch=clamp(basePitch(bodyIndex)+(center.y-.5)*.45,-.08,frontView.pitch);mainCenter=center;status(`主手${targetOpening<.25?'捏合 · 完整星图':'张开 · 旋转星尘'}${secondary?' / 副手侧挥切换，食指写字':''}`);}else{status('主手暂时离开 · 另一只手仍可切换天体');}
 processSecondary(secondary,ts);
 $('#handLabel').textContent=(main?'主手已识别':'主手离开')+(secondary?' + 副手':'');drawSkeleton(hands,labels,index);
}
function swapHandRoles(){
 if(!lastHandAssignment||performance.now()-lastHandAssignment.t>700){toast('请先让两只手都进入摄像头，再交换主副手');return false;}
 const roles=lastHandAssignment;primaryLabel=roles.secondaryLabel;mainCenter=[0,5,9,13,17].reduce((c,k)=>({x:c.x+roles.secondary[k].x/5,y:c.y+roles.secondary[k].y/5}),{x:0,y:0});lastSeen=roles.t;
 writing=false;writingSince=0;inkLast=null;secondaryRestUntil=0;resetSwipe();lastHandAssignment=null;toast('已交换 · 青蓝主手控制星云，金色副手侧挥切换');return true;
}
function isWriting(h){
 // Foreshortened straight fingers must not count as a curled writing hand.
 const reach=(tip,pip)=>dist(h[tip],h[0])/Math.max(.015,dist(h[pip],h[0]));
 return reach(8,6)>1.24&&[12,16,20].every(t=>reach(t,t-2)<.98);
}
function resetSwipe(){swipeState=null;swipeSamples=[];}
function processSecondary(h,ts){
 const hint=$('#gestureHint'),meter=$('#gestureMeter i');
 if(!h){writing=false;writingSince=0;inkLast=null;if(ts-lastSecondarySeen>550)resetSwipe();hint.textContent='寻找副手 · 另一只手侧挥切换';meter.style.width='0%';return;}
 lastSecondarySeen=ts;
 const c=[0,5,9,13,17].reduce((p,i)=>({x:p.x+h[i].x/5,y:p.y+h[i].y/5}),{x:0,y:0});
 if(isWriting(h)){
  if(!writingSince)writingSince=ts;
  // Enter writing only after a deliberate index pose, rather than one blurred wave frame.
  if(ts-writingSince>220){if(!writing)inkLast=null;writing=true;resetSwipe();secondaryRestUntil=ts+250;addInk((1-h[8].x)*W,h[8].y*H,ts);hint.textContent='流星光笔 · 收起食指抬笔';meter.style.width='100%';}return;
 }
 if(writing)secondaryRestUntil=ts+250;writing=false;writingSince=0;inkLast=null;
 if(ts<secondaryRestUntil||ts-lastSwitch<1800||transition<.99){resetSwipe();hint.textContent=transition<.99?'正在切换天体…':'已切换 · 稍停后可再次侧挥';meter.style.width='0%';return;}
 const fan=[5,8,9,12,13,16,17,20].reduce((p,i)=>({x:p.x+h[i].x/8,y:p.y+h[i].y/8}),{x:0,y:0});
 const video=$('#camera'),aspect=(video.videoWidth||1280)/(video.videoHeight||720);
 // Measure the required travel in palm lengths; a distant hand needs less screen travel.
 const palm=Math.hypot(h[0].x-h[9].x,(h[0].y-h[9].y)/aspect),threshold=clamp(palm*.55,.06,.105);
 swipeSamples=swipeSamples.filter(p=>ts-p.t<=900);if(swipeSamples.length&&ts-swipeSamples.at(-1).t>550)swipeSamples=[];
 const prev=swipeSamples.at(-1);if(prev&&dist(c,prev)>.38){resetSwipe();}
 swipeSamples.push({...c,fx:fan.x,fy:fan.y,t:ts});
 let movement=0,switched=false;
 // Palm translation and a wrist-led fan are both valid, including briefly missing landmarks.
 for(let i=0;i<swipeSamples.length-1;i++){
  const anchor=swipeSamples[i],elapsed=ts-anchor.t;
  for(const [x,y,required] of [['x','y',threshold],['fx','fy',threshold*1.35]]){
   const dx=swipeSamples.at(-1)[x]-anchor[x],dy=(swipeSamples.at(-1)[y]-anchor[y])/aspect;
   let path=0;for(let j=i+1;j<swipeSamples.length;j++)path+=Math.hypot(swipeSamples[j][x]-swipeSamples[j-1][x],(swipeSamples[j][y]-swipeSamples[j-1][y])/aspect);
   movement=Math.max(movement,Math.abs(dx)/required);
   if(elapsed>=45&&elapsed<=900&&Math.abs(dx)>required&&Math.abs(dx)>Math.abs(dy)*aspect*1.25&&Math.abs(dx)/(elapsed/1000)>.18&&Math.abs(dx)/Math.max(path,.001)>.70){switched=true;break;}
  }
  if(switched)break;
 }
 hint.textContent='副手已识别 · 轻侧挥切换';meter.style.width=clamp(movement)*100+'%';
 if(switched){selectBody((bodyIndex+1)%bodies.length);lastSwitch=ts;secondaryRestUntil=ts+1800;resetSwipe();hint.textContent='已切换 · 流星光笔随时可用';meter.style.width='0%';}
}
function addInk(x,y,t){
 let start=!inkLast,px=x/W,py=y/H;
 if(inkLast){const distance=Math.hypot(x-inkLast.x*W,y-inkLast.y*H);if(distance>Math.min(W,H)*.22||t-inkLast.t>240)start=true;else if(distance<1.5)return;else {px=mix(inkLast.x,px,.72);py=mix(inkLast.y,py,.72);}}
 const p={x:px,y:py,t,start};
 const prev=inkLast;inkPoints.push(p);inkLast=p;inkDirty=true;
 const length=prev&&!start?Math.hypot((p.x-prev.x)*W,(p.y-prev.y)*H):0,steps=Math.max(1,Math.ceil(length/14));
 for(let j=0;j<steps;j++)for(let k=0;k<2;k++){
  if(k&&random()<.3)continue;const f=(j+1)/steps,angle=2.23+(random()-.5)*.16,spread=k?44:14;
  const speed=620+random()*700;
  meteors.push({x:(prev&&!start?mix(prev.x,p.x,f):p.x)*W+(random()-.5)*spread,y:(prev&&!start?mix(prev.y,p.y,f):p.y)*H+(random()-.5)*spread,t:t+random()*110,angle,speed,length:speed*(.10+random()*.10),width:.45+random()*.55,life:.60+random()*.45,warm:random()<.18});
 }
 if(meteors.length>700)meteors.splice(0,meteors.length-700);
 if(inkPoints.length>2400)inkPoints.splice(0,inkPoints.length-2400);
}
let meteorSprites=null;
function makeMeteorSprites(){
 return ['#6edfff','#ffc989'].map(color=>{
  const c=document.createElement('canvas');c.width=256;c.height=24;const cc=c.getContext('2d'),g=cc.createLinearGradient(0,0,248,0);
  g.addColorStop(0,'transparent');g.addColorStop(.45,color+'28');g.addColorStop(.86,color+'c0');g.addColorStop(1,'#f5ffff');
  cc.strokeStyle=g;cc.shadowColor=color;cc.shadowBlur=5;cc.lineWidth=1.5;cc.beginPath();cc.moveTo(0,12);cc.lineTo(248,12);cc.stroke();cc.fillStyle='#f5ffff';cc.beginPath();cc.arc(248,12,1.8,0,TAU);cc.fill();return c;
 });
}
function drawInk(ms){
 if(!inkDirty&&!inkPoints.length&&!meteors.length)return;
 ink.clearRect(0,0,inkCanvas.width,inkCanvas.height);inkPoints=inkPoints.filter(p=>ms-p.t<14000);meteors=meteors.filter(p=>(ms-p.t)/1000<p.life);inkDirty=!!(inkPoints.length||meteors.length);
 if(!inkDirty)return;
 ink.save();ink.scale(D,D);ink.globalCompositeOperation='lighter';ink.lineCap='round';ink.lineJoin='round';
 // A thin, enduring constellation records the gesture under the loose meteor shower.
 ink.lineWidth=.7;ink.strokeStyle='#6edfff';ink.shadowBlur=3;ink.shadowColor='#43aaff';
 for(let second=0;second<14;second++){ink.globalAlpha=.36*(1-smooth(clamp((second*1000-6500)/7500)));ink.beginPath();let any=false;for(let i=1;i<inkPoints.length;i++){const p=inkPoints[i],prev=inkPoints[i-1];if(p.start||Math.floor((ms-p.t)/1000)!==second)continue;ink.moveTo(prev.x*W,prev.y*H);ink.lineTo(p.x*W,p.y*H);any=true;}if(any)ink.stroke();}
 ink.shadowBlur=0;if(!meteorSprites)meteorSprites=makeMeteorSprites();
 for(const m of meteors){
  const age=(ms-m.t)/1000;if(age<0)continue;
  const drift=age*m.speed,fade=smooth(clamp(age/.055))*(1-smooth(clamp((age/m.life-.50)/.50))),length=m.length*(.65+.35*smooth(clamp(age/.12)));
  ink.globalAlpha=fade*.9;ink.save();ink.translate(m.x+Math.cos(m.angle)*drift,m.y+Math.sin(m.angle)*drift);ink.rotate(m.angle);ink.drawImage(meteorSprites[m.warm?1:0],-length,-6*m.width,length,12*m.width);ink.restore();
 }
 ink.restore();
}
function drawSkeleton(hands,labels=[],mainIndex=-1){
 const c=$('#skeleton'),video=$('#camera'),vw=Math.min(video.videoWidth||1280,640),vh=Math.round(vw*(video.videoHeight||720)/(video.videoWidth||1280));
 if(c.width!==vw||c.height!==vh){c.width=vw;c.height=vh;}
 const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
 const chains=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]],unit=vw/960;
 hands.forEach((h,index)=>{
  const primary=index===mainIndex,color=primary?'#38e5ff':'#ffc75b';
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  // A dark underlay preserves contrast on both skin and bright backgrounds.
  for(const chain of chains){ctx.beginPath();chain.forEach((n,i)=>{const p=h[n];if(i)ctx.lineTo(p.x*vw,p.y*vh);else ctx.moveTo(p.x*vw,p.y*vh);});ctx.strokeStyle='#06141ed9';ctx.lineWidth=8*unit;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=3.5*unit;ctx.shadowColor=color;ctx.shadowBlur=7*unit;ctx.stroke();}
  h.forEach((p,i)=>{const x=p.x*vw,y=p.y*vh,tip=[4,8,12,16,20].includes(i),r=(tip?7:5.5)*unit;ctx.shadowBlur=9*unit;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#06212ee6';ctx.lineWidth=1.5*unit;ctx.stroke();ctx.fillStyle='#f5ffff';ctx.beginPath();ctx.arc(x,y,r*.42,0,TAU);ctx.fill();});
  ctx.restore();
 });
}
addEventListener('resize',resize);addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());});

async function boot(){
 try{
  if(!gl){
   await startCanvasUniverse();
  }else{
   initGL();resize();requestAnimationFrame(frame);
   photoProgram=program(photoVS,photoFS);
   const pinwheel=loadObservation(1,prologue.finished);
   const orion=loadObservation(0).then(loaded=>{if(loaded)showInitialObservation();return loaded;});
   const [homeReady,flowerReady]=await Promise.all([orion,loadObservation(2)]);
   if(!homeReady&&!flowerReady){
    prologue.close();
    await pinwheel;
   }
   showInitialObservation();
   if(prologue.waiting&&flowerReady){
    // Submit the photo and dust shaders under the loading overlay before timing the reveal.
    drawSky();
    paintPrologue({opening:.42,scale:1,orbit:0,light:1,reveal:.2},drawBody);
    gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
    await new Promise(requestAnimationFrame);
   }
   status('完整星图 · 张开手掌或滚轮放大，化为旋转星尘');
  }
  if(modelBuffers[2])await prologue.start();
  else prologue.close();
 }catch(e){
  prologue.close();
  status('画面加载失败：'+e.message);toast(e.message);let retry=document.createElement('button');retry.textContent='恢复宇宙画面 ↻';retry.className='recover-scene';retry.onclick=()=>location.reload();document.body.append(retry);console.error(e);
 }
}

addEventListener('error',e=>{status('画面异常：'+e.message);});

canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status('图形资源正在恢复，请稍候');});canvas.addEventListener('webglcontextrestored',()=>location.reload());

let lastInkPaint=-100;function animateInk(ms){if(ms-lastInkPaint>=32){lastInkPaint=ms;drawInk(ms);}requestAnimationFrame(animateInk);}requestAnimationFrame(animateInk);
