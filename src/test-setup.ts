import { getTestBed, ɵgetCleanupHook as getCleanupHook } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach } from 'vitest';

beforeEach(getCleanupHook(false));
afterEach(getCleanupHook(true));

const ANGULAR_TESTBED_SETUP = Symbol.for('@angular/cli/testbed-setup');
if (!(globalThis as Record<symbol, unknown>)[ANGULAR_TESTBED_SETUP]) {
  (globalThis as Record<symbol, unknown>)[ANGULAR_TESTBED_SETUP] = true;

  getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
  });
}
