"""Synthetic sidebar-label fixture, never market data. Requires Pillow."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import io, json, base64
root=Path(__file__).resolve().parent
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(font_path,25)
small=ImageFont.truetype(font_path,18)
image=Image.new('RGB',(1200,760),'#111827');d=ImageDraw.Draw(image)
d.text((30,25),'CLOE SYNTHETIC · TEST/USD · 4H · NOT MARKET DATA',font=font,fill='white')
d.text((30,70),'Price labels are on the right. One drawn line has no label.',font=small,fill='#cbd5e1')
for y in [130,270,420,610]:
 d.line((40,y,1035,y),fill='#253043')
for i in range(14):
 x=65+i*65;y=260+(i%4)*28
 d.line((x,y-35,x,y+40),fill='#4ade80',width=2)
 d.rectangle((x-7,y-15,x+7,y+20),fill='#4ade80')
for y,color,text in [(200,'#38bdf8','104.25'),(350,'#a78bfa',None),(500,'#fbbf24','101.50')]:
 d.line((45,y,1035,y),fill=color,width=3)
 if text:
  d.rounded_rectangle((1045,y-23,1193,y+23),radius=3,fill=color)
  box=d.textbbox((0,0),text,font=font);d.text((1054,y-(box[3]-box[1])/2-box[1]),text,font=font,fill='#0b1220')
d.text((1060,115),'110.00',font=small,fill='#aabbcc')
d.text((1060,595),'95.00',font=small,fill='#aabbcc')
d.text((30,705),'OCR does not determine support, resistance or current quotes.',font=small,fill='white')
b=io.BytesIO();image.save(b,'PNG',optimize=True)
(root/'fixtures'/'axis-labels.json').write_text(json.dumps({'synthetic':True,'imagePngBase64':base64.b64encode(b.getvalue()).decode(),'expected':{'width':1200,'height':760,'lines':[{'y':200,'label':'104.25','price':104.25},{'y':350,'label':None,'price':None},{'y':500,'label':'101.50','price':101.5}]}},indent=2)+'\n')
preview=root.parent.parent/'gateway-check'/'axis-labels.png';preview.parent.mkdir(exist_ok=True);image.save(preview)
print(preview)
