import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, NotFoundException } from '@nestjs/common';

const URL_EXPIRES_IN_SECONDS = 3600;

@Injectable()
export class S3VideoUrlService {
  private client?: S3Client;
  private clientRegion?: string;

  async createSignedGetUrl(storageKey: string): Promise<string> {
    const { AWS_REGION: region, S3_BUCKET: bucket } = process.env;
    if (process.env.NODE_ENV !== 'development' || !region || !bucket) {
      throw new NotFoundException();
    }

    if (!this.client || this.clientRegion !== region) {
      this.client = new S3Client({ region });
      this.clientRegion = region;
    }
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
      { expiresIn: URL_EXPIRES_IN_SECONDS },
    );
  }
}
