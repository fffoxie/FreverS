import { authenticate } from './handlers-auth.js';
import { HttpError } from './http.js';
import {
  supportedVersions,
  servicesUrls,
  myProfile,
  profile,
  userBalance,
  ageQuizResponse,
  claimPastRewards
} from './models.js';
import { findUserByUsername } from './db.js';

export const OFFICIAL_GROUP_ID = 1000;

function quizState(ctx) {
  const user = authenticate(ctx, false);
  if (!user) return { confirmed: true, questions: [] };
  const row = ctx.db.prepare('SELECT quiz_state FROM age_quiz_answers WHERE user_id = ?').get(user.id);
  if (!row) return { confirmed: true, questions: [] };
  try {
    return { confirmed: true, questions: JSON.parse(row.quiz_state).questions || [] };
  } catch {
    return { confirmed: true, questions: [] };
  }
}

export async function ageQuiz(ctx) {
  const { confirmed, questions } = quizState(ctx);
  return {
    body: ageQuizResponse({ confirmed, runOutOfQuestions: questions.length === 0, questions })
  };
}

export async function confirmAge(ctx) {
  const user = authenticate(ctx, false);
  if (user) {
    ctx.db
      .prepare(
        "INSERT INTO age_quiz_answers (user_id, quiz_state) VALUES (?, ?) " +
          "ON CONFLICT(user_id) DO UPDATE SET quiz_state = excluded.quiz_state, updated_at = datetime('now')"
      )
      .run(user.id, JSON.stringify({ questions: [] }));
  }
  return { body: ageQuizResponse({ confirmed: true, runOutOfQuestions: true }) };
}

export async function getGroup(ctx) {
  const byName = findUserByUsername(ctx.db, ctx.params.id);
  if (byName) return { body: profile(byName) };
  const byGroup = ctx.db.prepare('SELECT * FROM users WHERE group_id = ?').get(Number(ctx.params.id));
  if (!byGroup) throw new HttpError(404, 'Profile not found');
  return { body: profile(byGroup) };
}

export function currentUser(ctx) {
  const user = authenticate(ctx, true);
  return { body: myProfile(user) };
}

export function currentBalance(ctx) {
  authenticate(ctx, true);
  return { body: userBalance() };
}

export function officialProfile(ctx) {
  const user = ctx.db.prepare('SELECT * FROM users WHERE group_id = ?').get(OFFICIAL_GROUP_ID);
  if (user) return { body: profile(user) };
  return {
    body: profile({ group_id: OFFICIAL_GROUP_ID, nickname: 'Frever Official' })
  };
}

export function versions() {
  return { body: supportedVersions() };
}

export function urls(ctx) {
  authenticate(ctx, false);
  return { body: servicesUrls() };
}

export function emptyArray(ctx) {
  authenticate(ctx, false);
  return { body: [] };
}

export function pastRewards(ctx) {
  authenticate(ctx, false);
  return { body: claimPastRewards() };
}
