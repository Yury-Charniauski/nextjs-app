import { MailerService } from "@/common/mailer/mailer.service.js";
import { Global, Module } from "@nestjs/common";

@Global()
@Module({
	providers: [MailerService],
	exports: [MailerService]
})
export class MailerModule {}
