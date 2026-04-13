/** True for phones / tablets / mobile browsers. Desktop & laptop UAs return false. */
export function isMobileOrTabletUserAgent(ua: string | null): boolean {
  if (!ua) return false;
  return /Mobile|Android|iPhone|iPod|webOS|BlackBerry|BB10|Opera Mini|IEMobile|Tablet|iPad|Silk|Kindle|CriOS|FxiOS|EdgiOS/i.test(
    ua,
  );
}
