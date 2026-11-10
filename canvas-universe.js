// Keep the same photographic cloud surfaces when WebGL is unavailable.
// Each tile carries its original colour through the same open/closed 3D shape.
async function startCanvasUniverse(){
 resize();const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('请重新打开页面以恢复画面');
 status('正在唤醒蓝金云气…');await loadObservations();
 const stars=Array.from({length:1600},()=>({x:random(),y:random(),r:.3+random()*.9,t:random()*TAU}));
 const cols=24,rows=16,reliefs=[];
 const textures=photoImages.map(image=>{
  const c=document.createElement('canvas'),size=1600;c.width=size;c.height=Math.round(size*image.height/image.width);
  const cc=c.getContext('2d',{willReadFrequently:true});cc.drawImage(image,0,0,c.width,c.height);
  const im=cc.getImageData(0,0,c.width,c.height),data=im.data;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
   const k=(y*c.width+x)*4,r=Math.hypot(x/c.width*2-1,y/c.height*2-1),l=Math.max(data[k],data[k+1],data[k+2])/255;
   data[k+3]=255*(1-smooth(clamp((r-.66)/.34)))*smooth(clamp((l-.012)/.078));
   for(let j=0;j<3;j++)data[k+j]=Math.min(255,data[k+j]*1.12);
  }
  const relief=[];
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){const k=(Math.min(c.height-1,Math.round(y/rows*(c.height-1)))*c.width+Math.min(c.width-1,Math.round(x/cols*(c.width-1))))*4;relief.push(Math.max(data[k],data[k+1],data[k+2])/255);}
  reliefs.push(relief);cc.putImageData(im,0,0);return c;
 });
 // Feather the release field in texture space before projecting the mesh.
 // Fading individual triangles would expose the grid underneath the photograph.
 const maskSize=192,mask=document.createElement('canvas');
 mask.width=mask.height=maskSize;
 const maskContext=mask.getContext('2d'),maskPixels=maskContext.createImageData(maskSize,maskSize);
 const releases=Float32Array.from({length:maskSize*maskSize},(_,i)=>releaseAt((i%maskSize+.5)/maskSize,1-(Math.floor(i/maskSize)+.5)/maskSize));
 const maskedTextures=textures.map(texture=>{
  const c=document.createElement('canvas');c.width=texture.width;c.height=texture.height;
  return {canvas:c,context:c.getContext('2d'),opening:-1};
 });
 function fadingTexture(id){
  const source=textures[id],target=maskedTextures[id];
  if(opening<.035)return source;
  if(Math.abs(target.opening-opening)<.005)return target.canvas;
  target.opening=opening;
  for(let i=0;i<releases.length;i++){
   maskPixels.data[i*4+3]=255*(1-smooth(clamp((opening-releases[i]+.025)/.14)));
  }
  maskContext.putImageData(maskPixels,0,0);
  target.context.globalCompositeOperation='copy';
  target.context.drawImage(source,0,0);
  target.context.globalCompositeOperation='destination-in';
  target.context.drawImage(mask,0,0,source.width,source.height);
  return target.canvas;
 }
 function shape(u,v,id,l){return driftingPhotoPose(photoShape(u,v,id,l)[0],time);}
 function surface(id,scale,alpha){
  if(alpha<.001||opening>.79)return;
  const tex=fadingTexture(id),viewYaw=yaw+Math.sin(time*.13)*.055,cy=Math.cos(viewYaw),sy=Math.sin(viewYaw),cx=Math.cos(pitch),sx=Math.sin(pitch),f=H*.95;
  const points=[];
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
   const p=shape(x/cols,1-y/rows,id,reliefs[id][y*(cols+1)+x]),xx=p[0]*cy+p[2]*sy,zz=-p[0]*sy+p[2]*cy,yy=p[1]*cx-zz*sx,z=(p[1]*sx+zz*cx)*scale,d=7.2-z;
   points.push([W/2+xx*scale*f/d,H/2-yy*scale*f/d,z]);
  }
  const triangles=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const a=y*(cols+1)+x,b=a+1,c=a+cols+1,d=c+1;
   triangles.push({v:[a,b,c],x,y,lower:false,z:(points[a][2]+points[b][2]+points[c][2])/3},{v:[c,b,d],x,y,lower:true,z:(points[c][2]+points[b][2]+points[d][2])/3});
  }
  triangles.sort((a,b)=>a.z-b.z);ctx.globalAlpha=alpha;
  const tw=tex.width/cols,th=tex.height/rows;
  for(const t of triangles){
   const A=points[t.v[0]],B=points[t.v[1]],C=points[t.v[2]],x=t.x*tw,y=t.y*th;
   // Map a small image tile instead of redrawing the entire photograph.
   let a,b,c,d,e,f;
   if(!t.lower){a=(B[0]-A[0])/tw;b=(B[1]-A[1])/tw;c=(C[0]-A[0])/th;d=(C[1]-A[1])/th;e=A[0];f=A[1];}
   else{a=(C[0]-A[0])/tw;b=(C[1]-A[1])/tw;c=(C[0]-B[0])/th;d=(C[1]-B[1])/th;e=A[0]-c*th;f=A[1]-d*th;}
   ctx.save();ctx.beginPath();const mx=(A[0]+B[0]+C[0])/3,my=(A[1]+B[1]+C[1])/3;
   [A,B,C].forEach((p,i)=>{const px=mx+(p[0]-mx)*1.025,py=my+(p[1]-my)*1.025;if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);});ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,e,f);ctx.drawImage(tex,x-2,y-2,tw+4,th+4,-2,-2,tw+4,th+4);ctx.restore();
  }
 }
 const cloudSprites=new Map();
 function cloudSprite(color){
  const rgb=color.map(c=>Math.round(clamp(c)*7)*255/7|0),key=rgb.join(',');if(cloudSprites.has(key))return cloudSprites.get(key);
  const c=document.createElement('canvas');c.width=c.height=48;const cc=c.getContext('2d'),g=cc.createRadialGradient(24,24,0,24,24,24);
  g.addColorStop(0,`rgba(${key},.85)`);g.addColorStop(.35,`rgba(${key},.32)`);g.addColorStop(1,`rgba(${key},0)`);cc.fillStyle=g;cc.fillRect(0,0,48,48);cloudSprites.set(key,c);return c;
 }
 const volumes=models.map(m=>m.volume.filter((_,i)=>i%4===0).map(p=>({...p,alpha:p.alpha*3.6,sprite:cloudSprite(p.color)})));
 function cloudVolume(id,scale,alpha,front){
  if(alpha<.001||opening>.79)return;
  const viewYaw=yaw+Math.sin(time*.13)*.055,cy=Math.cos(viewYaw),sy=Math.sin(viewYaw),cx=Math.cos(pitch),sx=Math.sin(pitch),f=H*.95;
  ctx.globalCompositeOperation='screen';
  for(const p of volumes[id]){
   if((p.depth>0)!==front)continue;
   const [x,y,z]=driftingPhotoPose(p.open,time);
   const xx=x*cy+z*sy,zz=-x*sy+z*cy,yy=y*cx-zz*sx,depth=(y*sx+zz*cx)*scale,d=7.2-depth,size=p.size*H/850*scale*7.2/d;
   ctx.globalAlpha=alpha*p.alpha*(front?.8:1.2)*(1-smooth(clamp((opening-p.release+.025)/.16)));ctx.drawImage(p.sprite,W/2+xx*scale*f/d-size/2,H/2-yy*scale*f/d-size/2,size,size);
  }
  ctx.globalCompositeOperation='source-over';
 }
 const dustSprites=new Map();
 function dustSprite(color,kind){
  const rgb=color.map(c=>Math.round(clamp(c*1.22)*7)*255/7|0),key=rgb.join(',')+':'+kind;if(dustSprites.has(key))return dustSprites.get(key);
  const c=document.createElement('canvas');c.width=c.height=24;const cc=c.getContext('2d'),g=cc.createRadialGradient(12,12,0,12,12,12),rgbText=rgb.join(',');
  g.addColorStop(0,`rgba(${rgbText},1)`);g.addColorStop(.15,`rgba(${rgbText},.95)`);g.addColorStop(.35,`rgba(${rgbText},.24)`);g.addColorStop(1,`rgba(${rgbText},0)`);cc.fillStyle=g;cc.fillRect(0,0,24,24);
  if(kind>1){cc.fillStyle=`rgba(${rgbText},.8)`;if(kind===2){cc.fillRect(11.5,3,1,18);cc.fillRect(3,11.5,18,1);}else{cc.beginPath();cc.moveTo(12,8);cc.lineTo(15,12);cc.lineTo(12,16);cc.lineTo(9,12);cc.fill();}}
  dustSprites.set(key,c);return c;
 }
 const particleCount=11000;
 const dust=models.map(m=>Array.from({length:particleCount},(_,n)=>{
  const i=Math.floor(n*N/particleCount),color=Array.from(m.color.slice(i*3,i*3+3));
  return {i,sprite:dustSprite(color,m.meta[i*4+2]),size:m.meta[i*4],alpha:m.meta[i*4+1],
   release:releaseAt(m.uv[i*2],m.uv[i*2+1])};
 }));
 function particlesVolume(id,scale,alpha){
  if(alpha<.001||opening<.02)return;
  const viewYaw=yaw+Math.sin(time*.13)*.055;
  const cy=Math.cos(viewYaw),sy=Math.sin(viewYaw),cx=Math.cos(pitch),sx=Math.sin(pitch),f=H*.95,m=models[id];
  ctx.globalCompositeOperation='lighter';
  for(const p of dust[id]){
   const edge=opening-p.release;
   if(edge<-.08)continue;
   const detached=smooth(clamp((edge-.035)/.145));
   const rim=smooth(clamp((edge+.08)/.105))*(1-detached);
   const [x,y,z]=particlePose(m,p.i,opening,orbitAngle,time,p.release);
   const xx=x*cy+z*sy,zz=-x*sy+z*cy,yy=y*cx-zz*sx,depth=(y*sx+zz*cx)*scale,d=7.2-depth;
   if(d<1.4)continue;
   const px=W/2+xx*scale*f/d,py=H/2-yy*scale*f/d,size=Math.max(1.7,p.size*H/700*scale*7.2/d*1.6);
   if(px< -size||px>W+size||py< -size||py>H+size)continue;
   ctx.globalAlpha=clamp(alpha*p.alpha*(detached+rim*1.25)*1.35);
   ctx.drawImage(p.sprite,px-size/2,py-size/2,size,size);
  }
  ctx.globalCompositeOperation='source-over';
 }
 function celestialBody(id,scale,alpha){
  cloudVolume(id,scale,alpha,false);
  surface(id,scale,alpha);
  cloudVolume(id,scale,alpha,true);
  particlesVolume(id,scale,alpha);
 }
 status('完整星图 · 张开手掌或滚轮放大，化为旋转星尘');
 let painted=-100;
 function render(ms){
  if(ms-painted<33){requestAnimationFrame(render);return;}painted=ms;const renderStarted=performance.now();
  const sequence=prologue.frame(ms);
  const dt=Math.min((ms-last)/1000,.12),ease=1-Math.exp(-dt*(cameraOn?12:7));last=ms;time=ms/1000;
  advanceOpening(dt);yaw=mix(yaw,clamp(targetYaw,-frontView.yaw,frontView.yaw),ease);pitch=mix(pitch,clamp(targetPitch,-.08,frontView.pitch),ease);advanceMorph(dt);
  ctx.setTransform(D,0,0,D,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#030811';ctx.fillRect(0,0,W,H);
  const bg=ctx.createRadialGradient(W*(.48+.08*Math.sin(time*.03)),H*.48,0,W*.5,H*.5,W*.65);bg.addColorStop(0,'#0a1928');bg.addColorStop(.6,'#080e1c');bg.addColorStop(1,'#02050b');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  for(const s of stars){ctx.globalAlpha=.16+.4*(.5+.5*Math.sin(time*.5+s.t));ctx.fillStyle='#b4d8ff';ctx.fillRect((s.x*W+time*.6)%W,s.y*H,s.r,s.r);}
  if(sequence){
   paintPrologue(sequence,celestialBody);
  }else{
   const oldId=Math.max(0,modelBuffers.indexOf(previousBuffers));
   if(oldId!==bodyIndex)celestialBody(oldId,bodyScale(oldId),1-transition);
   celestialBody(bodyIndex,bodyScale(bodyIndex),transition);
   renderPhase();
  }
  ctx.globalAlpha=1;
  canvas.dataset.renderMs=String(Math.round(performance.now()-renderStarted));requestAnimationFrame(render);
 }
 requestAnimationFrame(render);
}
