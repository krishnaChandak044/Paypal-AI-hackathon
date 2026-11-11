from pathlib import Path
import os, subprocess, time, socket, secrets, hashlib, sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
WORK=ROOT/'demo'/'work'; WORK.mkdir(exist_ok=True)
DB=WORK/'showcase.db'
if DB.exists(): DB.unlink()
os.environ['DATABASE_URL']='sqlite:///'+str(DB)
os.environ['BOOTSTRAP_SECRET']='synthetic-video-only'
os.environ['ALLOW_SYNTHETIC_AI']='false'
from app.main import engine, Base
from app.database import SessionLocal,uid
from app.models import Organization,Member,Campaign,AidRequest,Need,Resource
org=Organization(id=uid(),name='ReliefRail Video Demo')
token=secrets.token_urlsafe(36)
member=Member(id=uid(),organization_id=org.id,name='Synthetic Demo Coordinator',role='admin',token_hash=hashlib.sha256(token.encode()).hexdigest())
campaign=Campaign(id=uid(),organization_id=org.id,name='Riverbend Flood Response — Synthetic Demo',currency='USD')
with SessionLocal() as db:
 db.add(org);db.flush();db.add_all([member,campaign]);db.flush()
 reqs=[
  ('Synthetic case: A fictional shelter needs infant formula, diapers, and warm bedding.','Infant formula and hygiene starter supply',85000),
  ('Synthetic case: A fictional riverside household needs backup power for essential equipment.','Backup power kit for a fictional shelter',59000),
  ('Synthetic case: A fictional volunteer crew needs a replacement water pump and safety waders.',None,0),
  ('Synthetic case: A household at fictional 104 Riverside Drive needs a portable generator for essential equipment.',None,0),
  ('Synthetic duplicate: A relative reports fictional 104 Riverside Drive needs a generator for essential equipment.',None,0),
 ]
 for msg,desc,amount in reqs:
  r=AidRequest(id=uid(),campaign_id=campaign.id,message=msg,status='approved' if desc else 'received',is_synthetic=True);db.add(r);db.flush()
  if desc: db.add(Need(id=uid(),request_id=r.id,description=desc,amount_minor=amount,status='approved'))
 db.add(Resource(id=uid(),campaign_id=campaign.id,description='Synthetic local water packs',quantity=30,source='Fictional local supplier'))
 db.commit()
server=subprocess.Popen(['python3','-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8011'],cwd=ROOT,env=os.environ.copy(),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(50):
  try:
   with socket.create_connection(('127.0.0.1',8011),timeout=.2):break
  except OSError:time.sleep(.2)
 shots=ROOT/'demo'/'assets'/'product';shots.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  context=b.new_context(viewport={'width':1600,'height':900},device_scale_factor=1)
  context.add_init_script("localStorage.setItem('reliefrail_auth_token', " + repr(token) + ");")
  page=context.new_page();page.goto('http://127.0.0.1:8011/',wait_until='networkidle')
  page.screenshot(path=str(shots/'01_supporter.png'))
  page.get_by_role('button',name='Gap Board').first.click();page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(shots/'02_gap_board.png'))
  page.get_by_role('button',name='AI Review & Plans').first.click();page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(shots/'03_triage.png'))
  page.get_by_text('Synthetic duplicate: A relative reports').first.click();page.screenshot(path=str(shots/'04_similarity.png'))
  page.get_by_role('button',name='Receipt Review').first.click();page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(shots/'05_receipts.png'));page.get_by_role('button',name='Review receipt extraction and rule checks').click();page.screenshot(path=str(shots/'08_receipt_result.png'))
  page.get_by_role('button',name='Seek Aid').first.click();page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(shots/'06_seek_aid.png'))
  page.get_by_role('button',name='Support & Donate').first.click();page.evaluate('window.scrollTo(0,0)');page.get_by_role('button',name='Relief Guardian (Monthly)').first.click();page.screenshot(path=str(shots/'07_guardian.png'))
  b.close()
 print('CAPTURED',len(list(shots.glob('*.png'))),'PRODUCT SCREENS')
finally:server.terminate();server.wait(timeout=5)
