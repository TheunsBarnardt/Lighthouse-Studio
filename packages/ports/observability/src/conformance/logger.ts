import { describe, expect, it } from 'vitest';

import type { LoggerPort } from '../logger.port.js';

export function runLoggerConformance(name: string, factory: () => LoggerPort): void {
  describe(`${name} — LoggerPort conformance`, () => {
    it('debug does not throw', () => {
      const logger = factory();
      expect(() => {
        logger.debug('test message');
      }).not.toThrow();
    });

    it('info does not throw', () => {
      const logger = factory();
      expect(() => {
        logger.info('test message', { key: 'value' });
      }).not.toThrow();
    });

    it('warn does not throw', () => {
      const logger = factory();
      expect(() => {
        logger.warn('warning message');
      }).not.toThrow();
    });

    it('error does not throw', () => {
      const logger = factory();
      expect(() => {
        logger.error('error message', new Error('test error'));
      }).not.toThrow();
    });

    it('child returns a LoggerPort instance', () => {
      const logger = factory();
      const child = logger.child({ requestId: 'abc-123' });
      expect(typeof child.info).toBe('function');
      expect(typeof child.child).toBe('function');
    });

    it('setLevel does not throw', () => {
      const logger = factory();
      expect(() => {
        logger.setLevel('warn');
      }).not.toThrow();
    });
  });
}
