import test from 'node:test';
import assert from 'node:assert/strict';

import { filterActiveInvites } from '../src/services/inviteFilters.js';

const minutesFromNow = (minutes) =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString();

test('filters out invites whose match start time is in the past', () => {
  const invites = [
    { token: 'future', match: { start_date_time: minutesFromNow(60) } },
    { token: 'past', match: { start_date_time: minutesFromNow(-60) } },
  ];

  const result = filterActiveInvites(invites);

  assert.deepEqual(
    result.map((invite) => invite.token),
    ['future'],
    'only future match invites should remain',
  );
});

test('uses invite expiration when provided', () => {
  const invites = [
    { token: 'future', expires_at: minutesFromNow(120) },
    { token: 'expired', expires_at: minutesFromNow(-5), match: { start_date_time: minutesFromNow(120) } },
  ];

  const result = filterActiveInvites(invites);

  assert.deepEqual(
    result.map((invite) => invite.token),
    ['future'],
    'invites past their expiration should be removed even if match is upcoming',
  );
});

test('keeps invites with missing or invalid dates', () => {
  const invites = [
    { token: 'missing-dates' },
    { token: 'invalid-date', match: { start_date_time: 'not-a-date' } },
  ];

  const result = filterActiveInvites(invites);

  assert.deepEqual(
    result.map((invite) => invite.token),
    ['missing-dates', 'invalid-date'],
    'invites without usable timestamps should remain',
  );
});
