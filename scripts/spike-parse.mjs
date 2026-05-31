// 데이터 스파이크: KBO 일정 JSON + 순위 HTML 파싱 검증
import fs from 'node:fs';

const strip = (h) => (h || '').replace(/<[^>]+>/g, '').trim();

// ---------- 1) 일정 파싱 ----------
const sched = JSON.parse(fs.readFileSync('kbo_schedule_test.txt', 'utf8'));
const games = [];
let curDate = null;
for (const r of sched.rows) {
  const cells = r.row;
  let i = 0;
  // 'day' 클래스 셀이 있으면 날짜 갱신 (RowSpan으로 묶임)
  if (cells[0]?.Class === 'day') { curDate = strip(cells[0].Text); i = 1; }
  const time = strip(cells[i]?.Text);
  const playCell = cells[i + 1]?.Text || '';
  // 팀/점수 추출: <span>AWAY</span> ... <span>x</span>vs<span>y</span> ... <span>HOME</span>
  const teams = [...playCell.matchAll(/<span(?:\s+class="(win|lose)")?>([^<]+)<\/span>/g)].map(m => ({ cls: m[1], txt: m[2] }));
  // gameId 추출
  const gid = (playCell.match(/gameId=([0-9A-Z]+)/) || cells[i + 2]?.Text?.match(/gameId=([0-9A-Z]+)/) || [])[1]
    || (cells.map(c => c.Text).join(' ').match(/gameId=([0-9A-Z]+)/) || [])[1];
  games.push({ date: curDate, time, raw: teams.map(t => `${t.txt}${t.cls ? '(' + t.cls + ')' : ''}`).join(' '), gameId: gid });
}

console.log(`총 파싱된 경기 행: ${games.length}`);
console.log('\n--- 샘플 5경기 ---');
games.slice(0, 5).forEach(g => console.log(JSON.stringify(g)));

const today = games.filter(g => g.date?.startsWith('05.31'));
console.log(`\n--- 오늘(05.31) 경기: ${today.length}건 ---`);
today.forEach(g => console.log(JSON.stringify(g)));

// ---------- 2) 순위 파싱 ----------
const html = fs.readFileSync('kbo_rank_test.html', 'utf8');
// 순위 테이블의 tbody 행 추출
const tableMatch = html.match(/<table[^>]*class="tData[^"]*"[^>]*>[\s\S]*?<\/table>/);
const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
const rankRows = [];
const scope = tableMatch ? tableMatch[0] : html;
let m;
while ((m = rowRe.exec(scope))) {
  const cells = [...m[1].matchAll(cellRe)].map(c => strip(c[1]));
  if (cells.length >= 8 && /^\d+$/.test(cells[0])) rankRows.push(cells);
}
console.log(`\n--- 순위표 파싱: ${rankRows.length}개 팀 ---`);
rankRows.forEach(c => console.log(c.join(' | ')));
