import { expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let consoleErrorSpy;

beforeEach(() => {
  const originalConsoleError = console.error;
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    const firstArg = args[0];
    const message = firstArg instanceof Error ? firstArg.message : String(firstArg);
    if (message.includes('Not implemented: navigation')) {
      return;
    }
    originalConsoleError(...args);
  });
});

afterEach(() => {
  cleanup();
  consoleErrorSpy?.mockRestore();
});
