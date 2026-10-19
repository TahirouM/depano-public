import { Inject, Injectable } from '@nestjs/common';
import { RULES } from '@depano/schemas';
import { AppConfig } from '../../config/config.service';
import { decrypt, encrypt, hmac, randomDigits, safeEqual } from '../../common/crypto';

/** Code de fin à 4 chiffres : haché (vérification) + chiffré AES-256-GCM (affichage au seul client). */
@Injectable()
export class CompletionCodeService {
  private readonly hashKey: string;
  private readonly encKey: string;

  constructor(@Inject(AppConfig) config: AppConfig) {
    this.hashKey = `${config.env.OTP_PEPPER}:completion`;
    this.encKey = config.env.DATA_ENCRYPTION_KEY ?? `${config.env.JWT_REFRESH_SECRET}:data`;
  }

  generate(bookingId: string, code = randomDigits(RULES.completionCode.length)) {
    return { code, completionCodeHash: hmac(this.hashKey, `${bookingId}:${code}`), completionCodeEnc: encrypt(this.encKey, code) };
  }

  verify(bookingId: string, code: string, hash: string | null) {
    return !!hash && safeEqual(hmac(this.hashKey, `${bookingId}:${code}`), hash);
  }

  reveal(enc: string | null) {
    return enc ? decrypt(this.encKey, enc) : null;
  }
}
