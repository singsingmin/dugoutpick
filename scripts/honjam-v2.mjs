// 꿀잼지수 2안 — 선발투수 factor 추가 + 스케일 보정. 라이브 데이터로 실행.
const DATE = '20260531';
const strip = (h) => (h || '').replace(/<[^>]+>/g, '').trim();

// 순위표(승률/최근10승/연승연패) — 스파이크 확인값. (라이브 파싱은 TeamRankDaily에서 가능)
const standings = {
  'LG':{rank:1,wr:.615,l10:7,streak:+2}, 'KT':{rank:2,wr:.608,l10:6,streak:+3},
  '삼성':{rank:3,wr:.600,l10:6,streak:-2}, 'KIA':{rank:4,wr:.538,l10:7,streak:-2},
  '한화':{rank:5,wr:.510,l10:6,streak:+3}, '두산':{rank:6,wr:.481,l10:5,streak:+2},
  'SSG':{rank:7,wr:.431,l10:0,streak:-11}, 'NC':{rank:8,wr:.420,l10:3,streak:+1},
  '롯데':{rank:8,wr:.420,l10:5,streak:-1}, '키움':{rank:10,wr:.377,l10:3,streak:-7},
};

const rivKey=(a,b)=>[a,b].sort().join('|');
const rivalry=Object.fromEntries([[['LG','두산'],1.0],[['롯데','NC'],0.7],[['롯데','삼성'],0.7],[['KIA','삼성'],0.6]].map(([[a,b],v])=>[rivKey(a,b),v]));
const clamp01=x=>Math.max(0,Math.min(1,x));
const strength=r=>(10-r)/9;
const playoffRel=r=>(r>=4&&r<=7?1:(r===3||r===8?.5:0));
const aceness=era=>clamp01((5.0-era)/(5.0-2.0)); // ERA 2.0→1.0, 5.0→0
const LEAGUE_ERA=4.20;

// 가중치 (코어팬 기준, 투수 포함, 합 100)
const W={close:30, quality:20, form:15, rivalry:10, playoff:10, pitcher:15};
// 스케일 보정: 로지스틱 (center=45, steep=10) → 그날 최고 경기가 85±로 보이게
const calibrate=raw=>Math.round(100/(1+Math.exp(-(raw-45)/10)));

async function main(){
  // 1) 경기+선발투수
  const gl=await fetch('https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Referer':'https://www.koreabaseball.com/'},
    body:`leId=1&srId=0&date=${DATE}`}).then(r=>r.json());
  // 2) 투수 ERA 맵
  const ph=await fetch('https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx',{headers:{'User-Agent':'Mozilla/5.0'}}).then(r=>r.text());
  const eraMap={};
  for(const m of ph.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){
    const c=[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>strip(x[1]));
    if(c.length>5 && /^\d+$/.test(c[0]) && /^\d\.\d\d$/.test(c[3])) eraMap[c[1]]=parseFloat(c[3]);
  }

  const games=gl.game.map(g=>{
    const aw=g.AWAY_NM.trim(), hm=g.HOME_NM.trim();
    const a=standings[aw], h=standings[hm];
    const apit=g.T_PIT_P_NM.trim(), hpit=g.B_PIT_P_NM.trim();
    const aERA=eraMap[apit]??LEAGUE_ERA, hERA=eraMap[hpit]??LEAGUE_ERA;
    const close=clamp01(1-Math.abs(a.wr-h.wr)/0.15);
    const quality=(strength(a.rank)+strength(h.rank))/2;
    const form=0.6*((a.l10+h.l10)/20)+0.4*Math.min(1,Math.max(Math.abs(a.streak),Math.abs(h.streak))/7);
    const riv=rivalry[rivKey(aw,hm)]||0;
    let playoff=(playoffRel(a.rank)+playoffRel(h.rank))/2;
    if(Math.abs(a.rank-h.rank)<=1&&a.rank>=3&&a.rank<=8&&h.rank>=3&&h.rank<=8)playoff=1;
    const pitcher=(aceness(aERA)+aceness(hERA))/2;
    const raw=W.close*close+W.quality*quality+W.form*form+W.rivalry*riv+W.playoff*playoff+W.pitcher*pitcher;
    return {game:`${aw} vs ${hm}`, 선발:`${apit}(${aERA}) vs ${hpit}(${hERA})`, raw:Math.round(raw), 꿀잼지수:calibrate(raw), _start:g.START_PIT_CK};
  }).sort((x,y)=>y.꿀잼지수-x.꿀잼지수);

  console.log('=== 꿀잼지수 2안 (투수 추가 + 스케일 보정) — 오늘 ===\n');
  console.table(games);
  console.log(`⭐ 오늘의 추천: ${games[0].game} — ${games[0].꿀잼지수}점`);
  console.log(`(선발 등록 플래그 START_PIT_CK: ${games.every(g=>g._start)?'전 경기 1=등록완료':'일부 미등록'})`);
}
main().catch(e=>console.error('ERR',e.message));
