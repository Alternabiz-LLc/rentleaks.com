"""Refresh tracked public HTML metadata without regenerating inventory or page bodies."""
from pathlib import Path
import subprocess,re,json,html
ROOT=Path(__file__).resolve().parent.parent
DATE='2026-10-13'
PRICING={
'en':'Listings $14/week or $60/month; lease-breaks $15/week or $60/month. Co-living operators $149/month. Provider sponsorship from $299/month. USD.',
'fr':'Annonces : 14 $/semaine ou 60 $/mois. Reprises de bail : 15 $/semaine ou 60 $/mois. Coliving : 149 $/mois. Sponsoring dès 299 $/mois. USD.',
'de':'Inserate: 14 $/Woche oder 60 $/Monat. Nachmieter: 15 $/Woche oder 60 $/Monat. Co-Living: 149 $/Monat. Sponsoring ab 299 $/Monat. USD.',
'it':'Annunci: 14 $/settimana o 60 $/mese. Subentri: 15 $/settimana o 60 $/mese. Co-living: 149 $/mese. Sponsorizzazioni da 299 $/mese. USD.'}
TITLES={'en':'Listing Prices & Provider Sponsorship | RentLeaks','fr':'Tarifs et sponsoring des professionnels | RentLeaks','de':'Inseratspreise und Anbieter-Sponsoring | RentLeaks','it':'Prezzi e sponsorizzazioni dei gestori | RentLeaks'}
files=subprocess.check_output(['git','ls-files','*.html'],cwd=ROOT,text=True).splitlines()
count=0
for filename in files:
 if filename.startswith(('Claude outputs/','web/','mobile/')):continue
 p=ROOT/filename;s=p.read_text();lang=filename.split('/')[0] if filename.split('/')[0] in PRICING else 'en'
 if p.name=='professionals.html':
  title=TITLES[lang];desc=PRICING[lang];s=re.sub(r'<title>.*?</title>','<title>'+title+'</title>',s,flags=re.S)
  for key in ['description','abstract','summary','ai-description','citation_abstract','dc.description','og:description','twitter:description']:
   s=re.sub(r'(<meta\s+(?:name|property)="'+re.escape(key)+r'"\s+content=")[^"]*(")',lambda m:m[1]+html.escape(desc,quote=True)+m[2],s)
  for key in ['og:title','twitter:title','citation_title','dc.title']:
   s=re.sub(r'(<meta\s+(?:name|property)="'+re.escape(key)+r'"\s+content=")[^"]*(")',lambda m:m[1]+html.escape(title,quote=True)+m[2],s)
 title=html.unescape(re.search(r'<title>(.*?)</title>',s,re.S)[1]);dm=re.search(r'<meta\s+name="description"\s+content="([^"]*)"',s);cm=re.search(r'<link\s+rel="canonical"\s+href="([^"]*)"',s)
 if not dm:raise ValueError('Missing description: '+filename)
 if not cm:
  path='/' if filename=='index.html' else '/'+filename.replace('index.html','')
  s=s.replace('</head>', '<link rel="canonical" href="https://rentleaks.com'+path+'">\n</head>',1)
  cm=re.search(r'<link\s+rel="canonical"\s+href="([^"]*)"',s)
 desc=html.unescape(dm[1]);canonical=html.unescape(cm[1]);assert canonical.startswith('https://rentleaks.com/')
 graph={'@context':'https://schema.org','@type':'WebPage','@id':canonical+'#webpage','url':canonical,'name':title,'description':desc,'inLanguage':{'en':'en-US','fr':'fr-FR','de':'de-DE','it':'it-IT'}[lang],'dateModified':DATE,'isPartOf':{'@type':'WebSite','@id':'https://rentleaks.com/#website','url':'https://rentleaks.com/','name':'RentLeaks'},'publisher':{'@type':'Organization','@id':'https://rentleaks.com/#organization','name':'RentLeaks','url':'https://rentleaks.com/'}}
 s=re.sub(r'\s*<script id="rl-page-seo" type="application/ld\+json">.*?</script>','',s,flags=re.S)
 s=s.replace('</head>','  <script id="rl-page-seo" type="application/ld+json">'+json.dumps(graph,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+'</script>\n</head>',1)
 p.write_text(s);count+=1
print('Updated',count,'public HTML pages')
