'use strict';

// Tasks Vision still needs a graphics context for preprocessing, even with its
// CPU delegate. Keep a separate, entirely WASM/CPU path for these browsers.
async function createHandTracker(compatible=false){
 if(!compatible&&gl&&!gl.isContextLost()){
  try{
   const {FilesetResolver,HandLandmarker}=await import('./vendor/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks('./vendor/wasm');
   const tracker=await HandLandmarker.createFromOptions(files,{
    baseOptions:{modelAssetPath:'./vendor/hand_landmarker.task',delegate:'CPU'},
    runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minTrackingConfidence:.55
   });
   tracker.kind='tasks';return tracker;
  }catch(error){console.warn('Using compatible hand tracking:',error);}
 }
 return createCompatibleHandTracker();
}

function createCompatibleHandTracker(){
 return new Promise((resolve,reject)=>{
  const worker=new Worker('./hand-worker.js?v=4.4');
  const capture=document.createElement('canvas');
  const context=capture.getContext('2d',{willReadFrequently:true});
  let pending=null,ready=false,closed=false;
  const timeout=setTimeout(()=>fail(new Error('识别模型加载超时')),45000);
  function fail(error){
   if(closed)return;closed=true;clearTimeout(timeout);worker.terminate();
   if(!ready)reject(error);pending?.reject(error);pending=null;
  }
  worker.onerror=event=>fail(new Error(event.message||'识别进程无法启动'));
  worker.onmessage=({data})=>{
   if(data.type==='ready'){
    ready=true;clearTimeout(timeout);
    resolve({kind:'compatible',
     detectForVideo(video){
      if(closed)return Promise.reject(new Error('识别进程已关闭'));
      if(pending)return Promise.reject(new Error('上一帧尚未完成'));
      const width=Math.min(384,video.videoWidth),height=Math.round(width*video.videoHeight/video.videoWidth);
      if(capture.width!==width||capture.height!==height){capture.width=width;capture.height=height;}
      context.drawImage(video,0,0,width,height);
      const frame=context.getImageData(0,0,width,height);
      return new Promise((resolve,reject)=>{
       pending={resolve,reject};
       worker.postMessage({type:'frame',width,height,pixels:frame.data},[frame.data.buffer]);
      });
     },
     close(){fail(new Error('识别进程已关闭'));}
    });
   }else if(data.type==='result'){
    const job=pending;pending=null;job?.resolve(data.result);
   }else if(data.type==='error')fail(new Error(data.message));
  };
 });
}
