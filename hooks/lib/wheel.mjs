export const WHEEL_TOP = 1, WHEEL_BOTTOM = 1, WHEEL_ZOOM = 1.25, WHEEL_GAP_MS = 110, WHEEL_MAX_BY = 8;

export function wheelStep(e, last, now) {
  if (e?.origin?.kind !== "person") return { factor: 1, last };
  const by = Number(e.by);
  if (!Number.isFinite(by) || by === 0 || Math.abs(by) > WHEEL_MAX_BY) return { factor: 1, last };
  const dir = by < 0 ? 1 : -1;
  if (last && last.dir === dir && now - last.at < WHEEL_GAP_MS) return { factor: 1, last };
  return { factor: dir > 0 ? WHEEL_ZOOM : 1 / WHEEL_ZOOM, last: { dir, at: now } };
}
