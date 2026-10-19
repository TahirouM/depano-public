import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfig } from '../config/config.service';

/** Stockage objet S3 (bucket privé, URL pré-signées). */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('Storage');
  private readonly s3: S3Client;
  private readonly signer: S3Client;
  readonly bucket: string;

  constructor(@Inject(AppConfig) config: AppConfig) {
    const e = config.env;
    const base = {
      region: e.S3_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY },
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
    };
    this.s3 = new S3Client({ ...base, endpoint: e.S3_ENDPOINT });
    this.signer = e.S3_PUBLIC_ENDPOINT ? new S3Client({ ...base, endpoint: e.S3_PUBLIC_ENDPOINT }) : this.s3;
    this.bucket = e.S3_BUCKET;
  }

  async ensureBucket() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket ${this.bucket} créé`);
    }
  }

  presignPut(key: string, contentType: string, expiresIn = 600) {
    return getSignedUrl(this.signer, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), { expiresIn });
  }

  presignGet(key: string, expiresIn = 300, downloadName?: string) {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(downloadName ? { ResponseContentDisposition: `attachment; filename="${downloadName}"` } : {}),
      }),
      { expiresIn },
    );
  }

  async head(key: string) {
    try {
      const r = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? null };
    } catch {
      return null;
    }
  }

  async put(key: string, body: Buffer | string, contentType: string) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string): Promise<Buffer> {
    const r = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }

  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
  }
}
