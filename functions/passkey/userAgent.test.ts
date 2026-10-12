import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDevice } from './userAgent';

const cases: [string, string, string][] = [
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'iPhone · Safari', 'mobile'],
  ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', 'Android · Chrome', 'mobile'],
  ['Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Android · Chrome', 'tablet'],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0', 'Windows · Edge', 'desktop'],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'Mac · Safari', 'desktop'],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Windows · Firefox', 'desktop'],
];

test('describes common devices', () => {
  for (const [ua, name, type] of cases) {
    const d = describeDevice(ua);
    assert.equal(d.deviceName, name, ua);
    assert.equal(d.deviceType, type, ua);
  }
});

test('handles missing or hostile user agents', () => {
  assert.equal(describeDevice(undefined).deviceName, 'Unknown device');
  assert.ok(describeDevice('x'.repeat(100_000)).deviceName.length < 64);
});
