import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRequests, validateRequest, STATUSES } from '../src/model.js';

const requests = [
  { title: 'Бот для заявок', description: 'Описание', category: 'Бот', status: 'Новая' },
  { title: 'Отчёт по продажам', description: 'Описание', category: 'Отчёт', status: 'В работе' },
  { title: 'Отчёт по остаткам', description: 'Описание', category: 'Отчёт', status: 'Завершена' },
];
test('search matches title substring regardless of case and surrounding spaces', () => {
  assert.equal(filterRequests(requests, '  ОТЧЁТ ', '').length, 2);
});
test('every status can be filtered and combined with title search', () => {
  for (const status of STATUSES) assert.deepEqual(filterRequests(requests, '', status), requests.filter(r => r.status === status));
  assert.deepEqual(filterRequests(requests, 'отчёт', 'В работе'), [requests[1]]);
  assert.deepEqual(filterRequests(requests, 'бот', 'Завершена'), []);
});
test('required fields and allowed values are validated', () => {
  assert.equal(validateRequest(requests[0]), '');
  for (const field of ['title', 'description', 'category', 'status']) {
    assert.ok(validateRequest({ ...requests[0], [field]: '   ' }));
  }
});
