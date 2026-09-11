import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';

@Injectable()
export class MailerService {
  transport = createTransport({
    host: process.env.SMTR_HOST,
    port: process.env.SMRT_PORT,
  });

  async sendRegistrationOtp(email: string, code: string) {
    await this.transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'OTP code for verification',
      text: `Use this OTP code for registration ${code}`,
    });
  }
}
