"""Crop bs-attack-strip.webp to the bounding box of all frames. Run after bake-item-effect.cjs."""
from pathlib import Path
from PIL import Image
path=Path(__file__).resolve().parents[1]/'dist/assets/bs-attack-strip.webp'
image=Image.open(path).convert('RGBA');cell=image.height;count=image.width//cell
boxes=[b for b in (image.crop((i*cell,0,(i+1)*cell,cell)).getbbox() for i in range(count)) if b]
left,top,right,bottom=min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)
side=max(right-left,bottom-top)+4;x=(left+right)//2-side//2;y=(top+bottom)//2-side//2
out=Image.new('RGBA',(side*count,side))
for i in range(count):out.paste(image.crop((i*cell+x,y,i*cell+x+side,y+side)),(i*side,0))
out.save(path,'WEBP',quality=90);print(count,'frames',side,'px')
