import { describe, expect, it } from 'vitest';

import type { LoggerPort } from '../logger.port.js';

export function runLoggerConformance(name: string, factory: () => LoggerPort): void {
  describe(`${name} — LoggerPort conformance`, () => {
    it('trace does not throw', () => {
      const logger = factory();
      expect(() => {
        logger.trace('trace message');
      }).not.toThrow();
    });

    it('debug does not throw', () => {
      const logger = factory();
      expect(() => {
        logger.debug('debug message', { key: 'value' });
      }).not.toThrow();
    });

    it('info does not throw', () => {
      const logger = factory();
      expect(() => {
        logger.info('info message', { key: 'value' });
      }).not.toThrow();
    });

    it('warn does not throw', () => {
      const logger = factory();
      expect(() => {
        logger.warn('warning message');
      }).not.toThrow();
    });

    it('error does not throw (with err in context)', () => {
      const logger = factory();
      expect(() => {
        logger.error('error message', { err: new Error('test') });
      }).not.toThrow();
    });

    it('fatal does not throw', () => {
      const logger = factory();
      expect(() => {
        logger.fatal('fatal message', { err: new Error('test') });
      }).not.toThrow();
    });

    it('child returns a LoggerPort instance with same interface', () => {
      const logger = factory();
      const child = logger.child({ requestId: 'abc-123' });
      expect(typeof child.trace).toBe('function');
      expect(typeof child.debug).toBe('function');
      expect(typeof child.info).toBe('function');
      expect(typeof child.warn).toBe('function');
      expect(typeof child.error).toBe('function');
      expect(typeof child.fatal).toBe('function');
      expect(typeof child.child).toBe('function');
    });

    it('child logger does not throw', () => {
      const logger = factory();
      const child = logger.child({ workspaceId: 'ws-1', userId: 'u-1' });
      expect(() => {
        child.info('from child');
      }).not.toThrow();
    });

    it('grandchild inherits parent context and does not throw', () => {
      const logger = factory();
      const child = logger.child({ workspaceId: 'ws-1' });
      const grandchild = child.child({ requestId: 'req-1' });
      expect(() => {
        grandchild.info('from grandchild');
      }).not.toThrow();
    });
  });
}
