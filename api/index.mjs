import {Store} from '../server/store.mjs';
import {createApp} from '../server/app.mjs';

let appPromise;

function getApp(){
  if(!process.env.MONGODB_URI)throw new Error('Thiếu biến môi trường MONGODB_URI trên Vercel.');
  if(!appPromise){
    const store=new Store(process.env.MONGODB_URI,process.env.MONGODB_DB||'haitacphucsinh_local');
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
