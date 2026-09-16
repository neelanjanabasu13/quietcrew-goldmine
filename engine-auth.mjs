import { timingSafeEqual } from 'node:crypto';
export function engineAuth({ token, production }) {
  if (production && (!token || token.length < 32)) throw new Error('Production requires GOLDMINE_ENGINE_TOKEN of at least 32 characters');
  return (req, res, next) => {
    if (!token) return next(); // Local-only development; production fails closed above.
    const supplied = Buffer.from(String(req.headers.authorization || ''));
    const expected = Buffer.from(`Bearer ${token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(401).json({ error: 'Unauthorized' });
    next();
  };
}
