// Photographs retain their full silhouette; sampled colours disperse into deep particle orbits.
function photoShape(u,v,id,l=.4){
 const x=u*2-1,y=v*2-1,r=Math.hypot(x,y),a=Math.atan2(y,x),envelope=Math.sqrt(Math.max(0,1-r*r));
 if(id===2){const petal=.95+.07*Math.cos(a*7);return [[x*3.2*petal,y*2.14*petal,Math.sin(a*7+r*4)*.32*r+Math.sin(r*3)*.35+(l-.4)*.25]];}
 if(id===0)return [[x*2.85,y*2.85,(.46*Math.sin(a*5+r*6)*r+(l-.4)*1.05)*envelope]];
 return [[x*3.5,y*2.74,(.27*Math.sin(a*2+r*4)*r*r+(l-.3)*.55)*envelope]];
}
// A very slow front-facing roll and breathing relief keep the intact atlas alive.
function driftingPhotoPose(p,t){const a=.065*Math.sin(t*.22),cs=Math.cos(a),sn=Math.sin(a),breath=1+.009*Math.sin(t*.28);return [(p[0]*cs-p[1]*sn)*breath,(p[0]*sn+p[1]*cs)*breath,p[2]+Math.sin(p[0]*1.8+p[1]*2+t*.23)*.035];}
const volumeShape=`vec3 shape(vec2 uv,float luminance){
 vec2 q=uv*2.-1.;float r=length(q),a=atan(q.y,q.x),envelope=sqrt(max(0.,1.-r*r));
 if(uBody>1.5){float petal=.95+.07*cos(a*7.);return vec3(q.x*3.2*petal,q.y*2.14*petal,sin(a*7.+r*4.)*.32*r+sin(r*3.)*.35+(luminance-.4)*.25);}
 if(uBody<.5)return vec3(q*2.85,(.46*sin(a*5.+r*6.)*r+(luminance-.4)*1.05)*envelope);
 return vec3(q.x*3.5,q.y*2.74,(.27*sin(a*2.+r*4.)*r*r+(luminance-.3)*.55)*envelope);
}`;
const photoVS=`precision highp float;
 attribute vec3 aPhoto;
 uniform float uAspect,uScale,uOpening,uBody,uTime;
 uniform vec2 uView;
 varying vec2 uv;
 ${transform}${volumeShape}${releaseGLSL}
 void main(){uv=aPhoto.xy;gl_Position=project(rotate(driftAtlas(shape(uv,aPhoto.z),uTime))*uScale);}
`;
const photoFS=`precision highp float;
 varying vec2 uv;
 uniform sampler2D uTexture;
 uniform float uOpacity,uOpening,uTime;
 ${releaseGLSL}
 void main(){
  vec3 c=texture2D(uTexture,uv).rgb;
  float luminance=max(c.r,max(c.g,c.b));
  float border=1.-smoothstep(.66,1.,length((uv-.5)*2.));
  float edge=uOpening-releaseAt(uv);
  float surface=1.-smoothstep(-.025,.115,edge);
  float glow=smoothstep(-.085,.055,edge)*(1.-smoothstep(.055,.12,edge));
  float mask=smoothstep(.012,.09,luminance)*border;
  gl_FragColor=vec4(c*(1.12+glow*.32),mask*uOpacity*surface);
 }`;
let photoProgram,photoModels=[],photoImages=[];
async function createPhotoModel(image,id){
 const side=768,c=document.createElement('canvas');c.width=side;c.height=Math.round(side*image.height/image.width);const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,c.width,c.height);const data=ctx.getImageData(0,0,c.width,c.height).data;
 const pixel=(u,v)=>{const x=Math.round(u*(c.width-1)),y=Math.round((1-v)*(c.height-1));return (y*c.width+x)*4;};
 const sample=(u,v)=>{const k=pixel(u,v);return [data[k]/255,data[k+1]/255,data[k+2]/255];};
 const m=makeModel();m.volume=[];let sliceStarted=performance.now();
 for(let i=0;i<N;i++){
  if(i%2048===0&&performance.now()-sliceStarted>9){await new Promise(requestAnimationFrame);sliceStarted=performance.now();}
  let u,v,col,l,r;for(let k=0;k<80;k++){u=random();v=random();col=sample(u,v);l=Math.max(...col);r=Math.hypot(u*2-1,v*2-1);if(r<.98&&random()<l*l*.9+.001)break;}
  const [origin]=photoShape(u,v,id,l);
  const edge=Math.sqrt(Math.max(0,1-r*r));
  const depth=(random()-.5)*(id===1?1.25:2.25)*edge;
  const closed=[origin[0],origin[1],origin[2]+depth*.10];
  if(i%24===0)m.volume.push({open:closed,color:col,depth,size:12+random()*24,alpha:.045+l*.065,release:releaseAt(u,v)});
  const radius=Math.hypot(origin[0],origin[1]),angle=Math.atan2(origin[1],origin[0]);
  const trail=Math.sin(angle*4+radius*2.3);
  const radial=radius*(1.05+random()*.52)+Math.abs(depth)*.48;
  const orbit=angle+.18+radius*.14+trail*.13+(random()-.5)*.28;
  const expanded=[Math.cos(orbit)*radial,Math.sin(orbit)*radial,origin[2]+depth*1.75+trail*.42];
  const type=random();
  const kind=type<.035?0:type<.052?.6:type<.062?2:1;
  const size=kind===0?8+random()*18:kind===.6?3.1+random()*3.5:kind===2?4.2+random()*4:1.05+random()*2.2;
  const alpha=kind===0?.12+l*.15:.28+l*.55;
  const color=col.map(c=>Math.min(1,c*(1.10+.23*(1-l))));
  m.uv.set([u,v],i*2);
  put(m,i,expanded,closed,color,size,alpha,kind);
 }
 if(!gl)return m;
 const verts=new Float32Array(192*128*18);
 let offset=0;
 const vertex=(u,v)=>{
  const k=pixel(u,v);
  verts[offset++]=u;verts[offset++]=v;
  verts[offset++]=Math.max(data[k],data[k+1],data[k+2])/255;
 };
 for(let j=0;j<128;j++)for(let i=0;i<192;i++){let u=i/192,v=j/128,uu=(i+1)/192,vv=(j+1)/128;vertex(u,v);vertex(uu,v);vertex(u,vv);vertex(u,vv);vertex(uu,v);vertex(uu,vv);}
 const texCanvas=document.createElement('canvas'),texScale=Math.min(1,2048/Math.max(image.width,image.height));texCanvas.width=Math.round(image.width*texScale);texCanvas.height=Math.round(image.height*texScale);texCanvas.getContext('2d').drawImage(image,0,0,texCanvas.width,texCanvas.height);
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texCanvas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);photoModels[id]={vertices:buffer(verts),count:verts.length/3,texture:tex};return m;
}
function particlePose(m,i,amount,angle,t,release){
 const j=i*3,phase=m.meta[i*4+3];
 const lift=smooth(clamp((amount-release+.07)/(1.01-release)));
 const start=driftingPhotoPose([m.closed[j],m.closed[j+1],m.closed[j+2]],t);
 const x=mix(start[0],m.open[j],lift),y=mix(start[1],m.open[j+1],lift);
 const z=mix(start[2],m.open[j+2],lift)+Math.sin(t*.48+phase)*.20*lift;
 const turn=(angle*(1+Math.sin(phase*2)*.19)+Math.hypot(m.closed[j],m.closed[j+1])*.24)*lift;
 const cs=Math.cos(turn),sn=Math.sin(turn);
 return [x*cs-y*sn,x*sn+y*cs,z];
}
function drawPhoto(id,scale,opacity){if(opacity<.001)return;let m=photoModels[id];useProgram(photoProgram);common(photoProgram,scale);uniform(photoProgram,'uBody',id);uniform(photoProgram,'uOpacity',opacity);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.texture);gl.uniform1i(gl.getUniformLocation(photoProgram,'uTexture'),0);attr(photoProgram,'aPhoto',m.vertices,3);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.clear(gl.DEPTH_BUFFER_BIT);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,m.count);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);}
const observationSources=[
 ['orion.webp','orion-full.jpg'],
 ['spiral.webp','spiral-full.jpg'],
 ['nebula-flower.webp','nebula-flower.png']
];
async function loadObservation(id, after){
 for(const url of observationSources[id]){
  const image=new Image();
  image.fetchPriority=id===1?'low':'high';
  image.src='./assets/'+url;
  try{await image.decode();}catch{continue;}
  try{
   if(after)await after;
   const model=await createPhotoModel(image,id);
   modelBuffers[id]=gl?upload(model):{};
   photoImages[id]=image;
   models[id]=model;
   return true;
  }catch(error){
   console.warn('星图构建失败',url,error);
   return false;
  }
 }
 console.warn('星图加载失败',observationSources[id][0]);
 return false;
}

boot();
