import { send, sendError, readJson, publicUser } from './admin-core.js';

export async function updateUser(req, res, db, id) {
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    return { status: 400, bytes: sendError(res, 400, error.message) };
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) return { status: 404, bytes: sendError(res, 404, 'User not found') };
  const updates = [];
  const values = [];
  if (body.softCurrency !== undefined) {
    updates.push('soft_currency = ?');
    values.push(Math.max(0, Math.trunc(Number(body.softCurrency) || 0)));
  }
  if (body.hardCurrency !== undefined) {
    updates.push('hard_currency = ?');
    values.push(Math.max(0, Math.trunc(Number(body.hardCurrency) || 0)));
  }
  if (body.premiumDays !== undefined) {
    const days = Math.max(0, Math.trunc(Number(body.premiumDays) || 0));
    updates.push('premium_until = ?');
    values.push(days === 0 ? null : new Date(Date.now() + days * 86400000).toISOString());
  }
  if (body.isAdmin !== undefined) {
    updates.push('is_admin = ?');
    values.push(body.isAdmin ? 1 : 0);
  }
  if (body.nickname !== undefined) {
    const nickname = String(body.nickname).trim();
    if (!nickname) return { status: 400, bytes: sendError(res, 400, 'Nickname cannot be empty') };
    updates.push('nickname = ?');
    values.push(nickname);
  }
  if (body.avatarAssetId !== undefined) {
    const idValue = body.avatarAssetId === null ? null : Number(body.avatarAssetId);
    if (idValue !== null) {
      const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND type = ?').get(idValue, 'avatar');
      if (!asset) return { status: 400, bytes: sendError(res, 400, 'avatarAssetId must be an avatar asset') };
    }
    updates.push('avatar_asset_id = ?');
    values.push(idValue);
  }
  if (updates.length === 0) return { status: 400, bytes: sendError(res, 400, 'No supported fields') };
  values.push(row.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id);
  return { status: 200, bytes: send(res, 200, { user: publicUser(updated) }) };
}
