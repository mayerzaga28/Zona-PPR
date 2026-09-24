import csv,json,urllib.request,concurrent.futures,pathlib,datetime,re
root=pathlib.Path(__file__).resolve().parent/'public'
from html.parser import HTMLParser
for name,url in [('nfl-players.csv','https://github.com/nflverse/nflverse-data/releases/download/players/players.csv'),('hof-draft.html','https://www.profootballhof.com/hall-of-famers/hall-of-famers-by-draft-year')]:
 p=pathlib.Path('/tmp')/name
 if not p.exists():p.write_bytes(urllib.request.urlopen(url,timeout=60).read())
class Text(HTMLParser):
 def __init__(self):super().__init__();self.lines=[]
 def handle_data(self,data):
  if data.strip():self.lines.append(data.strip())
t=Text();t.feed(pathlib.Path('/tmp/hof-draft.html').read_text());pathlib.Path('/tmp/hof-draft.txt').write_text('\n'.join(t.lines))
def fetch(y):
 p=pathlib.Path(f'/tmp/stats_player_reg_{y}.csv')
 if not p.exists():p.write_bytes(urllib.request.urlopen(f'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_{y}.csv',timeout=60).read())
 return list(csv.DictReader(p.open()))
keys='season recent_team games passing_yards passing_tds passing_interceptions carries rushing_yards rushing_tds receptions receiving_yards receiving_tds fantasy_points_ppr fg_made fg_att pat_made def_sacks def_interceptions'.split()
stats={}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for rows in pool.map(fetch,range(1999,2026)):
  for r in rows:
   d={k:r[k] for k in keys if r.get(k) not in ('','NA')}
   stats.setdefault(r['player_id'],[]).append(d)
players=[]
for r in csv.DictReader(open('/tmp/nfl-players.csv')):
 if not r['gsis_id']:continue
 p=dict(id=r['gsis_id'],name=r['display_name'],position=r['position'],birth=r['birth_date'],college=r['college_name'],height=r['height'],weight=r['weight'],rookie=r['rookie_season'],last=r['last_season'],team=r['latest_team'],draftYear=r['draft_year'],round=r['draft_round'],pick=r['draft_pick'],draftTeam=r['draft_team'],espn=r['espn_id'])
 players.append(p)
# Hall of Fame draft facts extend the quiz into earlier eras. Keep source wording for team names.
lines=pathlib.Path('/tmp/hof-draft.txt').read_text().splitlines();year=None
for i,line in enumerate(lines):
 if re.fullmatch(r'19\d\d',line):year=int(line)
 if year and year<1974 and i and 'Round' in line and ' by ' in line:
  m=re.search(r'^,?\s*([A-Z/]+),\s*(.*?)\s*[-–]\s*(\d+)(?:st|nd|rd|th) Round\s*\((\d+)(?:st|nd|rd|th) overall\) by (.+)',line)
  if m:
   name=lines[i-1].strip(' ,');pos,col,rd,pick,team=m.groups()
   if not any(p['name']==name for p in players):players.append(dict(id='hof-'+str(year)+'-'+pick,name=name,position=pos,college=col,draftYear=str(year),round=rd,pick=pick,draftTeam=team,rookie=str(year),last='',hof=True))
meta=dict(updated=datetime.date.today().isoformat(),coverage='Estadísticas de temporada regular 1999–2025. Catálogo nflverse y leyendas del Hall of Fame; no es un registro completo de toda la historia NFL.',source='https://github.com/nflverse/nflverse-data',players=players)
(root/'archive.json').write_text(json.dumps(meta,separators=(',',':'),ensure_ascii=False))
(root/'seasons.json').write_text(json.dumps(stats,separators=(',',':')))
print('Players',len(players),'HOF additions',sum(bool(p.get('hof')) for p in players),'stats players',len(stats))
