import express from 'express';
import {Store} from './server/store.mjs';
import {createApp} from './server/app.mjs';

void express;
let appPromise;

function getApp(){
  const uri=process.env.MONGODB_URI?.trim();
  if(!uri)throw new Error('Thiếu biến môi trường MONGODB_URI trên Vercel.');
  if(!/^mongodb(?:\+srv)?:\/\//.test(uri))throw new Error('MONGODB_URI phải bắt đầu bằng mongodb:// hoặc mongodb+srv://.');
  if(!appPromise){
    const store=new Store(uri,process.env.MONGODB_DB||'haitacphucsinh_local');
    appPromise=store.connect()
      .then(()=>createApp(store))
      .catch(error=>{appPromise=undefined;throw error});
  }
  return appPromise;
}

export default async function handler(req,res){
  try{
    const app=await getApp();
    return app(req,res);
  }catch(error){
    console.error(JSON.stringify({
      event:'vercel_initialization_failed',
      name:error.name,
      code:error.code||null,
      message:error.message
    }));
    if(!res.headersSent)res.status(500).json({error:{code:'FUNCTION_INITIALIZATION_FAILED',message:'Không thể khởi động máy chủ. Kiểm tra Function Logs và Environment Variables trên Vercel.'}});
  }
}
