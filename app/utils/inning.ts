// 이닝 표기 헬퍼 — inning + half('T'=초 / 'B'=말) → "5초" / "5말".
// 데이터 없거나(inning null) 이닝 사이면 null 반환(호출부에서 미표시).
export function formatInning(
  inning: number | null | undefined,
  half: string | null | undefined,
): string | null {
  if (inning == null) return null;
  const h = half === 'T' || half === 't' ? '초' : half === 'B' || half === 'b' ? '말' : '';
  return `${inning}${h}`;
}
