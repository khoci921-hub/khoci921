import { describe, expect, it } from 'vitest';
import { buildPushPayload } from './fcm-server';

describe('buildPushPayload', () => {
  it('membuat data message web push tanpa notification payload', () => {
    const payload = buildPushPayload(
      'token-1',
      'Berkas Baru!',
      'Budi mengunggah CV.',
      '/admin.html',
    );

    expect(payload).toEqual({
      message: {
        token: 'token-1',
        data: {
          title: 'Berkas Baru!',
          body: 'Budi mengunggah CV.',
          url: '/admin.html',
        },
        webpush: { headers: { Urgency: 'high' } },
      },
    });
    expect(payload.message).not.toHaveProperty('notification');
    expect(payload.message.webpush).not.toHaveProperty('notification');
  });

  it('menormalkan nilai kosong menjadi string yang aman untuk FCM', () => {
    expect(buildPushPayload('t', '', '', '')).toMatchObject({
      message: { data: { title: '', body: '', url: '/' } },
    });
  });
});
