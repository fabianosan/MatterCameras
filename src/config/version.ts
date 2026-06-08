import { readFileSync } from 'fs';
import { join } from 'path';
import { PROJECT_ROOT } from './paths.js';

/** Single source of truth: package.json version (pre-1.0 beta). */
export const appVersion: string = JSON.parse(
    readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'),
).version as string;

/**
 * Numeric softwareVersion for BridgedDeviceBasicInformation.
 * SmartThings re-profiles Matter cameras when this value changes (adds motionSensor capability).
 */
export const matterSoftwareVersion = 301;
