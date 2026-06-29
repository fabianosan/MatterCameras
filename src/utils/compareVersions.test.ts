import assert from 'node:assert/strict';
import { compareVersions, isNewerVersion, parseVersion } from './compareVersions.js';

assert.deepEqual(parseVersion('v0.4.0-beta'), {
    major: 0,
    minor: 4,
    patch: 0,
    prerelease: 'beta',
});

assert.equal(compareVersions('0.4.0-beta', '0.4.0-beta'), 0);
assert.ok(isNewerVersion('0.4.1-beta', '0.4.0-beta'));
assert.ok(isNewerVersion('0.4.0', '0.4.0-beta'));
assert.ok(!isNewerVersion('0.4.0-beta', '0.4.1-beta'));
assert.ok(!isNewerVersion('0.4.0-beta', '0.4.0-beta'));

console.log('compareVersions.test.ts: ok');
