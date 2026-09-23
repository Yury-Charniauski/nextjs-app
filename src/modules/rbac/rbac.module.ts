import { RolesController } from '@/modules/rbac/controllers/roles.controller.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { RoleAdminService } from '@/modules/rbac/services/role-admin.service.js';
import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

@Global()
@Module({
  providers: [RbacService, RoleAdminService],
  exports: [RbacService],
  controllers: [RolesController],
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
})
export class RbacModule {}
