import assert from 'node:assert/strict';
import { matterLevelToReolinkBright, reolinkBrightToMatterLevel } from './reolinkLightLevels.js';

assert.equal(reolinkBrightToMatterLevel(0), 1);
assert.equal(reolinkBrightToMatterLevel(100), 254);
assert.equal(reolinkBrightToMatterLevel(50), 127);
assert.equal(matterLevelToReolinkBright(254), 100);
assert.equal(matterLevelToReolinkBright(1), 1);

console.log('reolinkLightLevels.test.ts: ok');
