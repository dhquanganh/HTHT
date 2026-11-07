from pathlib import Path
import cv2
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]/'extracted/reference'
cap=cv2.VideoCapture(str(root/'video.mp4'))
for page,start in enumerate(range(0,520,160)):
 sheet=Image.new('RGB',(1280,4*204),'#172330');draw=ImageDraw.Draw(sheet)
 for i,t in enumerate(range(start,min(start+160,520),10)):
  cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,frame=cap.read()
  if not ok:continue
  im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB));im.thumbnail((320,180))
  x=(i%4)*320;y=(i//4)*204;sheet.paste(im,(x,y+22));draw.text((x+5,y+3),f'{t//60:02}:{t%60:02}',fill='white')
 sheet.save(root/f'contact-{page}.jpg',quality=92)
cap.release()
