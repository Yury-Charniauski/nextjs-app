import { RateLimitService } from "@/common/rate-limit/rate-limit.service.js";
import { Global, Module } from "@nestjs/common";

@Global()
@Module({
	providers: [RateLimitService],
	exports: [RateLimitService]
})
export class RateLimitModule {}
