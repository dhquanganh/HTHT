import {Store} from './server/store.mjs';
import {createApp} from './server/app.mjs';

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
  const app=await getApp();
  return app(req,res);
}
