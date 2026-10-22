import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { S3VideoUrlService } from '../../../src/content/s3VideoUrlService.js';

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: vi.fn(function (input) { return { input }; }),
  S3Client: vi.fn(function (config) { return { config }; }),
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn() }));

describe('S3VideoUrlService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('creates a one hour S3 GetObject URL in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AWS_REGION', 'ap-northeast-2');
    vi.stubEnv('S3_BUCKET', 'aivideo-dev');
    vi.mocked(getSignedUrl).mockResolvedValue('https://s3.example/signed');

    await expect(new S3VideoUrlService().createSignedGetUrl('dramas/drama-1/video.mp4'))
      .resolves.toBe('https://s3.example/signed');

    expect(S3Client).toHaveBeenCalledWith({ region: 'ap-northeast-2' });
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'aivideo-dev',
      Key: 'dramas/drama-1/video.mp4',
    });
    expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 3600 });
  });

  it('does not sign outside development or with missing configuration', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(new S3VideoUrlService().createSignedGetUrl('video.mp4')).rejects.toBeInstanceOf(NotFoundException);

    vi.stubEnv('NODE_ENV', 'development');
    await expect(new S3VideoUrlService().createSignedGetUrl('video.mp4')).rejects.toBeInstanceOf(NotFoundException);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
