import glob,re,json,html as H
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s): super().__init__(); s.blocks=[]; s.cur=None; s.buf=''; s.list=None; s.imgs=[]; s.links=[]; s.href=None
    def flush(s):
        t=re.sub(r'\s+',' ',s.buf).strip()
        if t and s.cur:
            if s.cur=='li' and s.list is not None: s.list.append(t)
            else: s.blocks.append({'t':s.cur,'text':t})
        s.buf=''
    def handle_starttag(s,tag,a):
        a=dict(a)
        if tag in('h1','h2','h3','h4','p','li'): s.flush(); s.cur=tag
        elif tag in('ul','ol'): s.flush(); s.list=[]
        elif tag=='br': s.buf+='\n'
        elif tag=='img': s.imgs.append({'src':a.get('src'),'alt':a.get('alt','')})
        elif tag=='a': s.href=a.get('href')
    def handle_endtag(s,tag):
        if tag in('h1','h2','h3','h4','p','li'): s.flush(); s.cur=None if tag!='li' else None
        elif tag in('ul','ol'):
            s.flush()
            if s.list: s.blocks.append({'t':'ul','items':s.list})
            s.list=None
        elif tag=='a': s.href=None
    def handle_data(s,d):
        if s.href and d.strip(): s.links.append({'href':s.href,'text':d.strip()})
        if s.cur or s.list is not None: s.buf+=d
        elif d.strip(): s.cur='p'; s.buf+=d
out={}
for f in sorted(glob.glob('*.html')):
    s=open(f,encoding='utf-8',errors='replace').read()
    title=H.unescape(re.search(r'<title>(.*?)</title>',s,re.S).group(1).strip())
    md=re.search(r'<meta name="description" content="(.*?)"',s,re.S); md=H.unescape(md.group(1)).strip() if md else ''
    m=re.search(r'<div[^>]*itemprop="articleBody"[^>]*>(.*?)</div>\s*(?:<!--|<ul class="pager|</div>\s*</div>)',s,re.S) or re.search(r'class="item-page[^"]*"[^>]*>(.*?)<footer',s,re.S) or re.search(r'<main[^>]*>(.*?)</main>',s,re.S)
    body=m.group(1) if m else ''
    h1=re.search(r'<h1[^>]*>(.*?)</h1>',s,re.S)
    p=P(); p.feed(body); p.flush()
    out[f[:-5]]={'title':title,'meta':md,'h1':H.unescape(re.sub('<[^>]+>','',h1.group(1))).strip() if h1 else '','blocks':p.blocks,'imgs':p.imgs,'links':[l for l in p.links if l['href'] and not l['href'].startswith('tel:')]}
json.dump(out,open('content.json','w'),indent=1,ensure_ascii=False)
for k,v in out.items(): print(k,'|',v['title'],'|',len(v['blocks']),'blocks |', [l['href'] for l in v['links']][:4])
