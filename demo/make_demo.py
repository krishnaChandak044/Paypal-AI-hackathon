from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import subprocess, math, wave
ROOT=Path(__file__).resolve().parent.parent; OUT=ROOT/'demo'; A=OUT/'assets'; W,H=1920,1080
REG='/System/Library/Fonts/Supplemental/Arial.ttf'; BOLD='/System/Library/Fonts/Supplemental/Arial Bold.ttf'; SER='/System/Library/Fonts/Supplemental/Georgia.ttf'; SERB='/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
NAVY=(9,19,35); WHITE=(245,248,246); MUTED=(171,191,201); TEAL=(48,210,183); BLUE=(72,155,240); AMBER=(255,188,103); RED=(238,119,112)
def F(n,b=False,s=False): return ImageFont.truetype(SERB if s and b else SER if s else BOLD if b else REG,n)
def rr(d,box,r=18,fill=(255,255,255),outline=None,w=1): d.rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=w)
def wrap(d,t,f,mw):
 out=[]; line=''
 for w in t.split():
  test=(line+' '+w).strip()
  if d.textbbox((0,0),test,font=f)[2]<=mw: line=test
  else:
   if line: out.append(line)
   line=w
 if line: out.append(line)
 return out
def tb(d,t,x,y,f,c,mw,sp=8):
 for line in wrap(d,t,f,mw): d.text((x,y),line,font=f,fill=c); y+=f.size+sp
 return y
_BG_CACHE=None
def bg():
 global _BG_CACHE
 if _BG_CACHE is not None: return _BG_CACHE.copy()
 im=Image.new('RGB',(W,H)); p=im.load()
 for y in range(H):
  for x in range(W):
   k=(x/W*.58+y/H*.42)*.30; g=max(0,1-math.sqrt(((x-W*.86)/(W*.78))**2+((y-H*.10)/(H*.8))**2))
   p[x,y]=tuple(int(NAVY[i]*(1-k)+[15,37,57][i]*k+TEAL[i]*g*.07) for i in range(3))
 d=ImageDraw.Draw(im,'RGBA')
 for x in range(65,W,48):
  for y in range(55,H,48): d.ellipse((x,y,x+2,y+2),fill=(131,190,194,18))
 d.arc((1370,-200,2100,570),20,170,fill=(61,197,184,42),width=3)
 _BG_CACHE=im
 return im.copy()
def brand(d,i,n):
 rr(d,(78,66,118,106),12,(18,49,70),outline=(48,210,183,130),w=2); d.line((88,93,98,78,108,93),fill=TEAL,width=4)
 d.text((136,71),'RELIEFRAIL',font=F(20,True),fill=WHITE); d.text((1460,77),'PAYPAL SANDBOX PROTOTYPE',font=F(14,True),fill=MUTED)
 d.line((80,1000,1840,1000),fill=(146,188,193,58),width=1); d.text((82,1022),'A clearer trail from approved need to confirmed outcome',font=F(14),fill=MUTED)
 rr(d,(1548,1028,1838,1037),5,(39,62,77)); rr(d,(1548,1028,1548+int(290*i/n),1037),5,TEAL)
def heading(d,k,t,b,maxw=700):
 d.text((100,180),k.upper(),font=F(17,True),fill=TEAL); y=tb(d,t,100,227,F(50,True,True),WHITE,maxw,5)+22; tb(d,b,100,y,F(24),MUTED,maxw,8)
def arrow(d,a,b,c=TEAL,w=4):
 d.line((a,b),fill=c,width=w); ang=math.atan2(b[1]-a[1],b[0]-a[0]); L=15; d.polygon([b,(b[0]-L*math.cos(ang-.5),b[1]-L*math.sin(ang-.5)),(b[0]-L*math.cos(ang+.5),b[1]-L*math.sin(ang+.5))],fill=c)
def card(d,box,title,body,accent=TEAL):
 x,y,w,h=box; rr(d,(x,y,x+w,y+h),20,(17,38,56),outline=(140,190,197,55)); rr(d,(x+20,y+20,x+29,y+h-20),4,accent); d.text((x+52,y+22),title,font=F(21,True),fill=WHITE); tb(d,body,x+52,y+60,F(17),MUTED,w-80,6)
def screen(im,path,box,crop,caption):
 x,y,w,h=box; src=Image.open(path).convert('RGB').crop(crop); iw,ih=src.size; scale=min(w/iw,h/ih); src=src.resize((int(iw*scale),int(ih*scale)),Image.Resampling.LANCZOS); padded=Image.new('RGB',(w,h),(237,244,246)); padded.paste(src,((w-src.width)//2,(h-src.height)//2)); src=padded
 sh=Image.new('RGBA',(w+40,h+40)); ImageDraw.Draw(sh).rounded_rectangle((15,15,w+25,h+25),radius=18,fill=(0,0,0,130)); sh=sh.filter(ImageFilter.GaussianBlur(14)); im.paste(sh,(x-15,y-10),sh)
 mask=Image.new('L',(w,h)); ImageDraw.Draw(mask).rounded_rectangle((0,0,w,h),radius=18,fill=255); im.paste(src,(x,y),mask); d=ImageDraw.Draw(im,'RGBA'); d.rounded_rectangle((x,y,x+w,y+h),radius=18,outline=(199,224,226),width=2); rr(d,(x+18,y+h-52,x+w-18,y+h-16),12,(7,18,31,230)); d.text((x+35,y+h-46),caption,font=F(16,True),fill=WHITE)
def chip(d,x,y,t,c=TEAL):
 w=d.textbbox((0,0),t,font=F(16,True))[2]+34; rr(d,(x,y,x+w,y+42),18,(18,49,70),outline=(*c,150)); d.text((x+17,y+11),t,font=F(16,True),fill=c)
OV=ROOT/'web/public/screenshots/overview.png'; TRI=ROOT/'web/public/screenshots/ai-triage.png'; GAP=ROOT/'web/public/screenshots/gap-board.png'
S=[
('COMMUNITY RELIEF • PAYPAL SANDBOX','ReliefRail','', 'cover','After a disaster, help arrives from many directions. The hard part is making every decision and every movement of money easy to follow.'),
('THE COORDINATION GAP','Good intentions need a clear operating trail.','Requests, approvals, contributions, payouts, and receipts often live in different places. Coordinators need one view of what is approved, funded, reserved, and still waiting.','problem','ReliefRail brings that workflow into one place. It helps a response team see what has been requested, what has been approved, and what the shared pool can actually cover.'),
('ONE REVIEWABLE WORKFLOW','From a request to a reconciled outcome.','ReliefRail connects intake, coordinator review, a shared contribution pool, a controlled payout path, and receipt follow-up.','loop','The product is designed around a simple principle: show the state of each step, and keep the decision with the people responsible for the response.'),
('01 • PRODUCT WALKTHROUGH','The supporter view.','','product_01_supporter','The supporter view introduces the community pool. It shows confirmed money separately from available money and gives supporters a clear way to start a PayPal Sandbox contribution.'),
('02 • AI REVIEW','The coordinator queue.','','product_03_triage','Next, coordinators see fictional requests in one queue. On a synthetic case, AI can draft itemized needs and questions. A human reviews and approves each proposal.'),
('03 • SIMILARITY REVIEW','Possible overlap, human judgment.','','product_04_similarity','The similarity view highlights two fictional requests that may describe the same household. Its keyword and address signals are prompts for review, not fraud or eligibility decisions.'),
('04 • GAP BOARD','Approved need versus available cash.','','product_02_gap_board','On the gap board, approved needs are costed and compared with confirmed pool funds. The empty sandbox pool here makes the funding gap honest and visible.'),
('04 • PAYPAL SANDBOX CONTRIBUTION','A real integration, in a test environment.','The prototype creates a PayPal Sandbox order, waits for buyer approval, captures on the server, verifies signed webhook events, and applies each event once.','payment','This demonstrates the payment plumbing without claiming live donations. Pool credit follows a confirmed capture. A retry does not create a second ledger credit for the same provider event.'),
('AUDITABLE POOL ACCOUNTING','Every amount has a distinct meaning.','Contributions, reserves, spends, releases, and provider refunds or reversals are recorded separately in integer minor units.','ledger','If a payout is confirmed successful, the reserve becomes a spend. If it fails, the reservation is released. If the provider state is unclear, the amount stays reserved while reconciliation checks again.'),
('05 • GUARDIAN PLANNING','Recurring support stays a projection.','','product_07_guardian','The guardian view shows how recurring support could help plan the next response. Its projections are clearly separate from spendable cash until PayPal confirms actual subscription payments.'),
('06 • RECEIPT REVIEW','A synthetic receipt, reviewed line by line.','','product_08_receipt_result','The receipt screen extracts a built-in synthetic sample and checks its line items against an approved need. A coordinator must inspect the result before applying any spend.'),
('07 • SEEK AID','A simple way to request help.','','product_06_seek_aid','The public intake lets a person describe what they need without installing a new app. The request joins the coordinator queue for human review.'),
('THE BOUNDARY IS PART OF THE PRODUCT','Trust comes from showing the limits.','Sandbox payments. Synthetic demonstrations. Human approval. Provider-backed status. No claims of eligibility, fraud detection, merchant checkout, or emergency-response readiness.','limits','The scope is deliberate: make a complex relief workflow more reviewable, while keeping sensitive decisions with people and reporting only what the system can verify.'),
('RELIEFRAIL','Make the trail visible.','AI-assisted coordination. Human-led relief.','close','ReliefRail turns a shared pool into a clearer path from an approved need to a confirmed outcome. Thank you.')]
def draw_scene(i,row):
 k,t,b,kind,voice=row; im=bg(); d=ImageDraw.Draw(im,'RGBA'); brand(d,i,len(S))
 if kind=='cover':
  d.text((105,205),k,font=F(18,True),fill=TEAL); d.text((105,290),t,font=F(90,True,True),fill=WHITE); tb(d,'When every hour matters, make every funding decision easier to follow.',105,405,F(37),MUTED,800,12); chip(d,105,625,'AI ASSISTS • PEOPLE DECIDE'); chip(d,410,625,'PAYPAL SANDBOX',BLUE); d.text((105,800),'A coordination prototype for transparent community emergency pools',font=F(22),fill=WHITE)
  for j,lab in enumerate(['NEED','REVIEW','POOL','OUTCOME']):
   y=255+j*145; rr(d,(1190,y,1745,y+82),20,(18,42,62),outline=(48,210,183,100),w=2); d.ellipse((1220,y+27,1248,y+55),fill=TEAL); d.text((1275,y+24),lab,font=F(24,True),fill=WHITE)
   if j<3: arrow(d,(1460,y+88),(1460,y+130))
 elif kind.startswith('product_'):
  shot=A/'product'/(kind[len('product_'):]+'.png')
  src=Image.open(shot).convert('RGB').resize((W,H),Image.Resampling.LANCZOS)
  im.paste(src,(0,0))
  d=ImageDraw.Draw(im,'RGBA')
  rr(d,(64,116,1120,229),18,(8,23,38,226))
  d.text((90,132),k,font=F(16,True),fill=TEAL)
  d.text((90,162),t,font=F(38,True,True),fill=WHITE)
  rr(d,(1460,110,1838,154),17,(8,23,38,218))
  d.text((1482,123),'SYNTHETIC APP WALKTHROUGH',font=F(15,True),fill=WHITE)
 elif kind=='problem':
  heading(d,k,t,b,700)
  for j,(a,bb) in enumerate([('MESSAGES','Requests'),('SPREADSHEETS','Approvals'),('PAYMENT TOOLS','Transfers'),('RECEIPTS','Proof')]):
   x=910+j*220; y=390; rr(d,(x,y,x+190,y+110),18,(18,42,62),outline=(130,180,195,70)); d.text((x+18,y+20),a,font=F(13,True),fill=TEAL); d.text((x+18,y+55),bb,font=F(20,True),fill=WHITE)
   if j<3: arrow(d,(x+193,y+55),(x+214,y+55),AMBER,3)
  card(d,(920,720,850,150),'The visibility gap','Who approved this need? Is the money available? Did the payment settle?',AMBER)
 elif kind=='loop':
  heading(d,k,t,b,680); nodes=['REQUEST','HUMAN REVIEW','SHARED POOL','CONFIRM + RECEIPT','PAYPAL SANDBOX','RESERVE']
  for j,lab in enumerate(nodes):
   rowi=j//3; col=j%3; x=825+col*315; y=295+rowi*210; rr(d,(x,y,x+285,y+110),20,(18,42,62),outline=(48,210,183,130),w=2); d.ellipse((x+22,y+38,x+48,y+64),fill=TEAL); d.text((x+68,y+39),lab,font=F(20,True),fill=WHITE)
   if rowi==0 and col<2: arrow(d,(x+288,y+55),(x+312,y+55))
   if rowi==1 and col>0: arrow(d,(x-3,y+55),(x-25,y+55))
  arrow(d,(1590,410),(1590,480)); d.text((990,682),'Every transition has a visible state and a human owner.',font=F(20,True),fill=WHITE)
 elif kind in ('triage','ai'):
  d.text((100,155),k.upper(),font=F(17,True),fill=TEAL); d.text((100,200),t,font=F(45,True,True),fill=WHITE); crop=(200,680,1810,1210) if kind=='triage' else (800,550,1710,1270); cap='Synthetic request • coordinator review' if kind=='triage' else 'AI draft panel • synthetic scenario'; screen(im,TRI,(100,315,1720,620),crop,cap)
 elif kind=='human':
  heading(d,k,t,b,670); card(d,(870,285,420,180),'AI proposes','Items • estimates • questions',BLUE); arrow(d,(1305,375),(1390,375)); card(d,(1410,285,420,180),'Coordinator decides','Review • edit • approve',TEAL); card(d,(870,560,960,210),'Boundary by design','No automated eligibility decision. No fraud verdict. No payment authorization by the model.',AMBER)
 elif kind=='pool':
  d.text((100,155),k.upper(),font=F(17,True),fill=TEAL); d.text((100,200),t,font=F(45,True,True),fill=WHITE); screen(im,GAP,(100,315,1720,620),(220,390,1790,1020),'Illustrative needs and funding gap')
 elif kind=='payment':
  heading(d,k,t,b,680)
  for j,lab in enumerate(['Create order','Buyer approves','Server captures','Signed event verified','Pool credited once']):
   y=255+j*130; rr(d,(870,y,1735,y+82),18,(18,42,62),outline=(76,172,191,75)); d.ellipse((895,y+18,943,y+66),fill=TEAL); d.text((910,y+26),str(j+1),font=F(20,True),fill=NAVY); d.text((975,y+25),lab,font=F(22,True),fill=WHITE)
   if j<4: arrow(d,(920,y+85),(920,y+120))
  chip(d,100,770,'SANDBOX FLOW • NO LIVE MONEY CLAIM',AMBER)
 elif kind=='ledger':
  heading(d,k,t,b,680)
  for j,(lab,desc,col) in enumerate([('CONTRIBUTION','+ confirmed capture',TEAL),('RESERVE','held for approved need',BLUE),('SPEND','confirmed provider success',AMBER),('RELEASE','failed or cancelled reserve',TEAL),('REFUND / REVERSAL','provider event recorded',RED)]):
   y=230+j*135; rr(d,(870,y,1770,y+100),18,(18,42,62),outline=(*col,110)); d.text((900,y+18),lab,font=F(18,True),fill=col); d.text((900,y+53),desc,font=F(19),fill=WHITE)
 elif kind=='limits':
  heading(d,k,t,b,680); card(d,(870,240,430,170),'Sandbox','PayPal test environment',BLUE); card(d,(1340,240,430,170),'Synthetic examples','No real recipient data',TEAL); card(d,(870,470,900,180),'Human responsibility','People approve needs, initiate payouts, and review receipts.',AMBER); card(d,(870,710,900,145),'Honest scope','A coordination prototype, not a response operator or custody service.',RED)
 elif kind=='receipt':
  heading(d,k,t,b,680); rr(d,(880,220,1770,810),26,(247,249,248),outline=(255,255,255,65),w=2); d.text((930,270),'RECEIPT REVIEW',font=F(15,True),fill=(30,93,108)); d.text((930,315),'Local supply purchase',font=F(30,True,True),fill=(19,39,54)); d.text((930,365),'SYNTHETIC DEMO SAMPLE',font=F(15,True),fill=(36,131,117)); d.line((930,420,1710,420),fill=(207,220,221),width=2)
  for j,(a,bb) in enumerate([('Water and hygiene kit','$42.00'),('Tax','$2.10'),('Total','$44.10')]):
   y=455+j*70; d.text((950,y),a,font=F(20,j==2),fill=(29,47,61)); d.text((1600,y),bb,font=F(20,j==2),fill=(29,47,61))
  rr(d,(930,690,1700,750),18,(224,241,235)); d.text((957,708),'Needs human review before reconciliation',font=F(18,True),fill=(33,103,82)); chip(d,100,770,'SYNTHETIC IMAGE ONLY')
 elif kind=='map':
  heading(d,k,t,b,650); pts=[(900,390,'NORTH','100%',TEAL),(1130,310,'VALLEY','59%',BLUE),(1335,420,'RIVER','68%',AMBER),(1540,300,'MILL','38%',AMBER),(1750,405,'PINE','72%',TEAL)]
  d.line([(p[0],p[1]) for p in pts],fill=(48,210,183,180),width=5); d.line((1130,310,1140,640,1350,760),fill=(72,155,240,150),width=4)
  for x,y,l,pct,col in pts:
   d.ellipse((x-16,y-16,x+16,y+16),fill=col); rr(d,(x-65,y+35,x+100,y+102),13,(16,39,58),outline=(*col,130)); d.text((x-48,y+45),l,font=F(12,True),fill=MUTED); d.text((x-48,y+67),pct,font=F(20,True),fill=WHITE)
  card(d,(900,745,860,130),'Illustrative only','Synthetic zones • no live locations • no privacy certification claim',AMBER)
 elif kind=='close':
  d.text((105,225),'RELIEFRAIL',font=F(19,True),fill=TEAL); d.text((105,310),'Make the trail',font=F(72,True,True),fill=WHITE); d.text((105,397),'visible.',font=F(82,True,True),fill=TEAL); tb(d,'From a community contribution to a confirmed outcome, every step should be easier to review.',105,535,F(30),MUTED,900,10); chip(d,105,745,'PEOPLE DECIDE • LEDGER SHOWS THE FLOW'); d.text((1200,380),'ReliefRail',font=F(58,True,True),fill=WHITE); d.text((1205,460),'AI-assisted coordination.',font=F(24),fill=MUTED); d.text((1205,500),'Human-led relief.',font=F(24),fill=MUTED)
 ImageDraw.Draw(im,'RGBA').rectangle((0,0,W-1,H-1),outline=(130,189,197,24),width=2); im.save(A/f'scene_{i:02d}.png')
for i,row in enumerate(S,1): draw_scene(i,row)
# TTS paragraphs and transcript.
voice=OUT/'voice'; voice.mkdir(exist_ok=True); parts=[]
for i,row in enumerate(S,1):
 txt=row[4]; text_path=voice/f'{i:02d}.txt'; changed=not text_path.exists() or text_path.read_text().strip()!=txt
 text_path.write_text(txt+'\n'); aiff=voice/f'{i:02d}.aiff'; wav=voice/f'{i:02d}.wav'
 if changed or not wav.exists():
  subprocess.run(['say','-v','Samantha','-r','150','-o',str(aiff),txt],check=True)
  subprocess.run(['ffmpeg','-y','-v','error','-i',str(aiff),'-ac','1','-ar','48000','-af','highpass=f=90,lowpass=f=10000,loudnorm=I=-18:TP=-2:LRA=7',str(wav)],check=True)
 parts.append(wav)
with wave.open(str(voice/'narration.wav'),'wb') as o:
 o.setnchannels(1); o.setsampwidth(2); o.setframerate(48000); silence=b'\0\0'*int(48000*.4)
 for j,p in enumerate(parts):
  with wave.open(str(p),'rb') as w: o.writeframes(w.readframes(w.getnframes()))
  if j<len(parts)-1:o.writeframes(silence)
def duration(p):
 with wave.open(str(p),'rb') as w:return w.getnframes()/w.getframerate()
raw=[duration(p)+.65 for p in parts]; total=sum(raw)
if total>176:
 scale=(176-len(raw)*.22)/(total-len(raw)*.22); raw=[(x-.22)*scale+.22 for x in raw]
raw[-1]+=max(0,176.8-sum(raw)); clips=[]
for i,sec in enumerate(raw,1):
 frames=round(sec*30); inp=A/f'scene_{i:02d}.png'; out=A/f'clip_{i:02d}.mp4'; fade=max(0,sec-.25)
 vf=f"scale=1920:1080,format=yuv420p,fade=t=in:st=0:d=0.25,fade=t=out:st={fade:.3f}:d=0.25"
 subprocess.run(['ffmpeg','-y','-v','error','-loop','1','-i',str(inp),'-frames:v',str(frames),'-vf',vf,'-r','30','-an','-c:v','libx264','-preset','ultrafast','-crf','20',str(out)],check=True); clips.append(out)
concat=A/'concat.txt'; concat.write_text(''.join(f"file '{p.resolve()}'\n" for p in clips)); sec=sum(raw)
# Original low-volume ambient bed (synthesized; no licensed music).
subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i',f'sine=frequency=110:sample_rate=48000:duration={sec:.3f}','-f','lavfi','-i',f'sine=frequency=164.81:sample_rate=48000:duration={sec:.3f}','-f','lavfi','-i',f'sine=frequency=220:sample_rate=48000:duration={sec:.3f}','-filter_complex',f'[0:a]volume=0.020,lowpass=f=240[a0];[1:a]volume=0.012,lowpass=f=320[a1];[2:a]volume=0.008,lowpass=f=420[a2];[a0][a1][a2]amix=inputs=3:normalize=0,afade=t=in:st=0:d=3,afade=t=out:st={max(0,sec-4):.3f}:d=4,volume=0.30[bed]','-map','[bed]','-c:a','pcm_s16le',str(voice/'ambient.wav')],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-i',str(voice/'narration.wav'),'-i',str(voice/'ambient.wav'),'-filter_complex','[1:a]volume=1.0[vo];[2:a]volume=0.55[bg];[vo][bg]amix=inputs=2:duration=longest:dropout_transition=0,alimiter=limit=0.95[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',str(OUT/'ReliefRail-3-minute-demo.mp4')],check=True)
def stamp(t):
 ms=int(round(t*1000)); return f'{ms//3600000:02}:{(ms%3600000)//60000:02}:{(ms%60000)//1000:02},{ms%1000:03}'
rows=[]; start=0
for i,(row,sec) in enumerate(zip(S,raw),1): rows.extend([str(i),f'{stamp(start)} --> {stamp(start+sec)}',row[4],'']); start+=sec
(OUT/'captions.srt').write_text('\n'.join(rows)); print(f"Duration {sum(raw):.2f}s; narration {duration(voice/'narration.wav'):.2f}s; words {sum(len(x[4].split()) for x in S)}")
