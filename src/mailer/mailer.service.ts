import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as SibApiV3Sdk from '@sendinblue/client';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly configService: ConfigService) {}

  private isDevFallbackEnabled(): boolean {
    const explicitFallbackEnabled =
      this.configService.get<string>('MAILER_DEV_FALLBACK')?.toLowerCase() ===
      'true';
    const nodeEnv = this.configService.get<string>('NODE_ENV')?.toLowerCase();

    return explicitFallbackEnabled || nodeEnv !== 'production';
  }

  private getBrevoApi(): SibApiV3Sdk.TransactionalEmailsApi {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Brevo API key is missing. Please set BREVO_API_KEY.',
      );
    }

    const brevo = new SibApiV3Sdk.TransactionalEmailsApi();
    brevo.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, apiKey);
    return brevo;
  }

  private getSenderConfig() {
    const fromEmail =
      this.configService.get<string>('BREVO_FROM_EMAIL') ??
      this.configService.get<string>('BREVO_SENDER_EMAIL');
    const fromName =
      this.configService.get<string>('BREVO_FROM_NAME') ??
      this.configService.get<string>('BREVO_SENDER_NAME') ??
      'AI Study Buddy';

    if (!fromEmail) {
      throw new ServiceUnavailableException(
        'Brevo sender email is missing. Please set BREVO_FROM_EMAIL or BREVO_SENDER_EMAIL.',
      );
    }

    return { fromEmail, fromName };
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    const brevo = this.getBrevoApi();
    const { fromEmail, fromName } = this.getSenderConfig();

    try {
      await brevo.sendTransacEmail({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      });

      this.logger.log(`MAILER | Brevo email sent -> ${to}`);
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? JSON.stringify((error as { response?: unknown }).response)
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      this.logger.error(`MAILER | Brevo send error: ${message}`);
      throw new Error(`Brevo email send failed: ${message}`);
    }
  }

  async sendPasswordResetOtpEmail(
    email: string,
    otp: string,
    expiresInMinutes: number,
  ) {
    const devFallbackEnabled = this.isDevFallbackEnabled();

    try {
      const subject = 'AI Study Buddy | Password Reset Verification Code';
      const textContent = [
        'Dear user,',
        '',
        'Your password reset verification code is:',
        otp,
        '',
        `This code is valid for ${expiresInMinutes} minutes.`,
        'If you did not request a password reset, please ignore this email.',
        '',
        'Regards,',
        'Nguyen Tan Thinh',
      ].join('\n');

      const htmlContent = `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">
          <h2 style="margin: 0 0 16px; color: #111827;">Password Reset Verification Code</h2>
          <p>Dear user,</p>
          <p>
            Your password reset verification code is
            <span style="display:inline-block; padding: 6px 12px; border-radius: 8px; background: #eef2ff; color: #1d4ed8; font-weight: 700; letter-spacing: 2px; font-size: 18px;">${otp}</span>
          </p>
          <p>This code is valid for <b>${expiresInMinutes} minutes</b>.</p>
          <p>If you did not request a password reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="margin: 0;">Regards,</p>
          <p style="margin: 4px 0 0; font-weight: 700;">Nguyen Tan Thinh</p>
        </div>
      `;

      await this.send(
        email,
        subject,
        htmlContent,
        textContent,
      );
    } catch (error) {
      if (devFallbackEnabled) {
        this.logger.warn(
          'MAILER | Brevo send failed, using dev fallback log instead.',
        );
        this.logger.log(`MAILER | OTP (dev fallback) for ${email}: ${otp}`);
        return;
      }

      throw error;
    }
  }

  async sendProfileUpdateOtpEmail(
    email: string,
    otp: string,
    type: 'email' | 'phone',
  ) {
    const devFallbackEnabled = this.isDevFallbackEnabled();

    try {
      const isEmailUpdate = type === 'email';
      const subject = isEmailUpdate 
        ? 'AI Study Buddy | Email Update Verification Code' 
        : 'AI Study Buddy | Phone Update Verification Code';

      const actionText = isEmailUpdate 
        ? 'update your account email' 
        : 'update your account phone number';

      const textContent = [
        'Dear user,',
        '',
        `Your verification code to ${actionText} is:`,
        otp,
        '',
        'This code is valid for 10 minutes.',
        'If you did not request this change, please ignore this email.',
        '',
        'Regards,',
        'Nguyen Tan Thinh',
      ].join('\n');

      const htmlContent = `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.6;">
          <h2 style="margin: 0 0 16px; color: #111827;">Profile Update Verification</h2>
          <p>Dear user,</p>
          <p>Your verification code to <b>${actionText}</b> is:</p>
          <p>
            <span style="display:inline-block; padding: 6px 12px; border-radius: 8px; background: #eef2ff; color: #1d4ed8; font-weight: 700; letter-spacing: 2px; font-size: 18px;">${otp}</span>
          </p>
          <p>This code is valid for <b>10 minutes</b>.</p>
          <p>If you did not request this change, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="margin: 0;">Regards,</p>
          <p style="margin: 4px 0 0; font-weight: 700;">Nguyen Tan Thinh</p>
        </div>
      `;

      await this.send(
        email,
        subject,
        htmlContent,
        textContent,
      );
    } catch (error) {
      if (devFallbackEnabled) {
        this.logger.warn(
          'MAILER | Brevo send failed, using dev fallback log instead.',
        );
        this.logger.log(`MAILER | OTP (dev fallback) for ${email}: ${otp}`);
        return;
      }

      throw error;
    }
  }
}
