import { Injectable } from '@nestjs/common';
import { getEnv, type Env } from './env';

@Injectable()
export class AppConfig {
  readonly env: Env = getEnv();
  get isProd() {
    return this.env.NODE_ENV === 'production';
  }
  get isTest() {
    return this.env.NODE_ENV === 'test';
  }
}
