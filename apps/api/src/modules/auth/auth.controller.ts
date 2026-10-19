import { Controller, Delete, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { IdParam } from '../../common/params';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  AppleSignInBody,
  GoogleSignInBody,
  OtpRequestBody,
  OtpVerifyBody,
  PasskeyLoginOptionsBody,
  PasskeyLoginVerifyBody,
  PasskeyRegisterVerifyBody,
  RefreshBody,
} from '@depano/schemas';
import type { z } from 'zod';
import { ClientIp, CurrentUser, Public, type AuthUser } from '../../common/auth';
import { ZBody } from '../../common/zod';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

const meta = (req: FastifyRequest, deviceName?: string) => ({
  deviceName: deviceName ?? null,
  ip: req.ip,
  userAgent: (req.headers['user-agent'] as string | undefined)?.slice(0, 500) ?? null,
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  requestOtp(@ZBody(OtpRequestBody) body: z.output<typeof OtpRequestBody>, @ClientIp() ip: string) {
    return this.auth.requestOtp(body.phone, ip);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  verifyOtp(@ZBody(OtpVerifyBody) body: z.output<typeof OtpVerifyBody>, @Req() req: FastifyRequest) {
    return this.auth.verifyOtp(body.phone, body.code, meta(req, body.deviceName));
  }

  @Public()
  @Post('apple')
  @HttpCode(200)
  apple(@ZBody(AppleSignInBody) body: z.output<typeof AppleSignInBody>, @Req() req: FastifyRequest) {
    return this.auth.socialLogin('apple', body.identityToken, body, meta(req, body.deviceName));
  }

  @Public()
  @Post('google')
  @HttpCode(200)
  google(@ZBody(GoogleSignInBody) body: z.output<typeof GoogleSignInBody>, @Req() req: FastifyRequest) {
    return this.auth.socialLogin('google', body.idToken, {}, meta(req, body.deviceName));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@ZBody(RefreshBody) body: z.output<typeof RefreshBody>, @Req() req: FastifyRequest) {
    return this.tokens.refresh(body.refreshToken, meta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@ZBody(RefreshBody) body: z.output<typeof RefreshBody>) {
    await this.tokens.logout(body.refreshToken);
  }

  @ApiBearerAuth()
  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.tokens.list(user);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    await this.tokens.revoke(user, id);
  }

  @ApiBearerAuth()
  @Post('passkeys/register/options')
  @HttpCode(200)
  registerOptions(@CurrentUser() user: AuthUser) {
    return this.auth.passkeyRegisterOptions(user);
  }

  @ApiBearerAuth()
  @Post('passkeys/register/verify')
  @HttpCode(200)
  registerVerify(@CurrentUser() user: AuthUser, @ZBody(PasskeyRegisterVerifyBody) body: z.output<typeof PasskeyRegisterVerifyBody>) {
    return this.auth.passkeyRegisterVerify(user, body.response);
  }

  @Public()
  @Post('passkeys/login/options')
  @HttpCode(200)
  loginOptions(@ZBody(PasskeyLoginOptionsBody) body: z.output<typeof PasskeyLoginOptionsBody>) {
    return this.auth.passkeyLoginOptions(body.phone);
  }

  @Public()
  @Post('passkeys/login/verify')
  @HttpCode(200)
  loginVerify(@ZBody(PasskeyLoginVerifyBody) body: z.output<typeof PasskeyLoginVerifyBody>, @Req() req: FastifyRequest) {
    return this.auth.passkeyLoginVerify(body.challengeId, body.response, meta(req, body.deviceName));
  }
}
