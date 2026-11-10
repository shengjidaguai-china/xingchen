'use strict';

// All dependencies and both models are local. No camera pixels leave the device.
let detector;
async function initialize(){
 importScripts('./vendor/tfjs/tf.min.js','./vendor/tfjs/tf-backend-wasm.min.js','./vendor/tfjs/hand-pose-detection.min.js');
 tf.wasm.setWasmPaths(new URL('./vendor/tfjs/wasm/',self.location.href).href);
 try{await tf.setBackend('wasm');await tf.ready();}
 catch(error){console.warn('WASM unavailable, using CPU:',error);await tf.setBackend('cpu');}
 detector=await handPoseDetection.createDetector(handPoseDetection.SupportedModels.MediaPipeHands,{
  runtime:'tfjs',modelType:'lite',maxHands:2,
  detectorModelUrl:new URL('./vendor/tfjs/models/palm/model.json',self.location.href).href,
  landmarkModelUrl:new URL('./vendor/tfjs/models/landmark/model.json',self.location.href).href
 });
 // Warm up before opening the camera so initialization errors stay actionable.
 const blank=tf.zeros([240,320,3],'int32');
 try{await detector.estimateHands(blank,{flipHorizontal:false});}finally{blank.dispose();}
 self.postMessage({type:'ready'});
}
self.onmessage=async({data})=>{
 if(data.type!=='frame')return;
 let tensor;
 try{
  // Tensor input avoids DOM/WebGL pixel conversion, including inside Workers.
  tensor=tf.tidy(()=>tf.tensor3d(data.pixels,[data.height,data.width,4],'int32').slice([0,0,0],[-1,-1,3]));
  const hands=await detector.estimateHands(tensor,{flipHorizontal:false});
  self.postMessage({type:'result',result:{
   landmarks:hands.map(hand=>hand.keypoints.map(p=>({x:p.x/data.width,y:p.y/data.height,z:(p.z||0)/data.width}))),
   handedness:hands.map(hand=>[{categoryName:hand.handedness,score:hand.score}])
  }});
 }catch(error){self.postMessage({type:'error',message:error.message});}
 finally{tensor?.dispose();}
};
initialize().catch(error=>self.postMessage({type:'error',message:error.message}));
