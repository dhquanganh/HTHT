/* Hiệu ứng đội hình (cùng luật server/aura.mjs):
 *   PopupInformationAuraNew (1155): vòng hệ, "Các hiệu ứng hiện tại", bảng 1-6 thuyền viên cùng hệ (dòng đã đạt tô xanh),
 *   hiệu ứng riêng mỗi hệ (hệ có mặt tô xanh).
 *   wheel(): vòng BoxAuraInBattle gốc (aura_background trái / aura_background_2 phải + bgr_aura_new + 6 ô hệ theo thứ tự đội).
 */
(()=>{
 'use strict';
 const table=[[0,0],[.02,.015],[.05,.035],[.08,.055],[.11,.075],[.14,.095],[.18,.12]];
 const special={abyss:['damageReduction',.02],forest:['damageReduction',.02],fortress:['damageReduction',.02],shadow:['damageReduction',.02],dark:['debuffResist',.04],light:['debuffResist',.04]};
 const labels={maxHp:I2('LBL_BLOOD','Máu'),attack:'Công',debuffResist:'Miễn chống',damageReduction:'Giảm sát thương'};
 const factionIcon={abyss:'78a35568f2bcb2c4da9e7bf4e316fead_2',forest:'03febeb6e4c14c54f8f997d235058a15_2',fortress:'d78abaaee320fdc479c2348a6378d9e0_2',shadow:'7ac38e5c264dccb49b2f765aaf0ad869_2',light:'c1533442ee542c04592ff88312310b5a_2',dark:'d300068bd5f8ab04a8d65c3216362c86_2'};
 // Vị trí 6 ô hệ trong vòng (GroupFaction gốc, tâm vòng ở giữa): trên-phải, phải, dưới-phải, dưới-trái, trái, trên-trái.
 const spots=[[20,-34],[39,0],[19,34],[-19,34],[-39,0],[-19,-34]];
 let c=null;
 function of(factions){
  const count={};for(const f of factions)if(f)count[f]=(count[f]||0)+1;
  const out={maxHp:0,attack:0,debuffResist:0,damageReduction:0};
  for(const [f,n] of Object.entries(count)){const [hp,atk]=table[Math.min(6,n)];out.maxHp+=hp;out.attack+=atk;const s=special[f];if(s)out[s[0]]+=s[1]*n}
  return out;
 }
 const pct=v=>(Math.round(v*1000)/10).toLocaleString('vi-VN',{maximumFractionDigits:1});
 /** Dòng "+9% Máu  +6,5% Công  +12% Miễn chống  +2% Giảm sát thương" (chỉ các mục > 0). */
 const parts=factions=>{const a=of(factions);return Object.entries(labels).filter(([k])=>a[k]>0).map(([k,l])=>[`+${pct(a[k])}%`,l])};
 const line=factions=>parts(factions).map(([v,l])=>`<span class="aura-part"><b>${v}</b> ${l}</span>`).join('');
 const src=k=>c?.assetSrc(k)||'';
 function wheel(factions,side='ally',extra=''){
  const frame=side==='enemy'?'7245551fedc354744942b60f135fda04_2':'48b097902e7796b44a5c15578869ae6c_2';
  return `<div class="aura-wheel ${side}">${side==='none'?'':`<img class="frame" src="${src(frame)}" alt="">`}<img class="hub" src="${src('9b7e5f42e4585b04380c933dc60dc160_2')}" alt="">${spots.map(([x,y])=>`<img class="hole" style="left:calc(50% + ${x}px);top:calc(50% + ${y}px)" src="${src('13e9b23f8941b504e83c884c0751a379_2')}" alt="">`).join('')}${spots.map(([x,y],i)=>{const f=factions[i];return f?`<img class="slot ${f.fallen?'fallen':''}" style="left:calc(50% + ${x}px);top:calc(50% + ${y}px)" src="${src(factionIcon[f.id||f])}" alt="">`:''}).join('')}${extra}</div>`;
 }
 async function open(factions){
  const list=factions.filter(Boolean),count={};for(const f of list)count[f]=(count[f]||0)+1;const best=Math.max(0,...Object.values(count));
  const el=document.createElement('div');el.className='aura-popup';
  el.innerHTML=`<section role="dialog" aria-modal="true" aria-label="Hiệu ứng đội hình" style="border-image:url('${src('edc52d9e2a6630e4fadf339ed3b9a765_2')}') 46 fill / 46px stretch">
   <h2 style="background-image:url('${src('8d2cda4e0194288409e3a2d7e92fe1e0_2')}')">Hiệu ứng đội hình</h2>
   <button class="aura-close" aria-label="Đóng"><img src="${src('7fce1b55a004a5d4da54d0de239b0f2a_2')}" alt=""></button>
   <div class="aura-now">${wheel(list,'none')}<div><p>Các hiệu ứng hiện tại :</p><div class="aura-now-box" style="border-image:url('${src('c58755562a490a34ab598a6f743e5a1f_2')}') 10 fill / 10px stretch">${line(list)||'<span class="aura-part">Chưa có thuyền viên</span>'}</div></div></div>
   <p class="aura-desc">Thiết lập các thuyền viên cùng hệ trong đội hình để kích hoạt hiệu ứng :</p>
   <ol class="aura-rows">${table.slice(1).map(([hp,atk],i)=>`<li class="${best>=i+1?'on':''}">${i+1} Thuyền viên cùng một hệ: +${(hp*100).toFixed(1)}% Máu +${(atk*100).toFixed(1)}% Công</li>`).join('')}</ol>
   <div class="aura-buffs">${['abyss','forest','dark','fortress','shadow','light'].map(f=>`<span class="${count[f]?'on':''}"><img src="${src(factionIcon[f])}" alt="">+${special[f][1]*100}% ${labels[special[f][0]]}</span>`).join('')}</div>
  </section>`;
  const close=()=>el.remove();el.onclick=e=>{if(e.target===el||e.target.closest('.aura-close'))close()};
  document.querySelector('#game-layer').appendChild(el);
 }
 window.AuraUI={init(ctx){c=ctx},of,line,wheel,open,icon:f=>factionIcon[f]};
})();
