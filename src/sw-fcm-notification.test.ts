import { describe, expect, it } from 'vitest';
import { buildServiceWorkerFcmHandlers } from './sw-fcm-notification.js';

describe('buildServiceWorkerFcmHandlers', () => {
  it('merender satu handler data message dengan badge ASJ', () => {
    const source = buildServiceWorkerFcmHandlers();
    expect(source).toContain('payload && payload.data');
    expect(source).toContain("'/icons/notification-badge.png'");
    expect(source).toContain('self.registration.showNotification');
    expect(source).toContain('navigator.setAppBadge(1)');
  });
});
