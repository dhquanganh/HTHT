import {Store} from './store.mjs';
import {createApp} from './app.mjs';

let appPromise;

async function getApp(){
 if(!process.env.MONGODB_URI)throw new Error('MONGODB_URI is not configured');
 if(!appPromise){
  const store=new Store(process.env.MONGODB_URI,process.env.MONGODB_DB||'haitacphucsinh');
  appPromise=store.connect().then(()=>createApp(store)).catch(error=>{
   appPromise=undefined;
   throw error;
  });
 }
 return appPromise;
}

export default async function handler(req,res){
 try{
  const app=await getApp();
  return app(req,res);
 }catch(error){
  console.error(JSON.stringify({event:'vercel_startup_error',name:error.name,code:error.code||null}));
  if(!res.headersSent)res.statusCode=500;
  if(!res.headersSent)res.setHeader('Content-Type','application/json; charset=utf-8');
  if(!res.headersSent)res.end(JSON.stringify({error:{code:'SERVER_STARTUP_ERROR',message:'Không thể khởi động máy chủ.'}}));
 }
}
