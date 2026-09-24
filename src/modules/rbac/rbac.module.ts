import { GrantController } from '@/modules/rbac/controllers/grant.controller.js';
import { PermissionController } from '@/modules/rbac/controllers/permission.controller.js';
import { RolesController } from '@/modules/rbac/controllers/roles.controller.js';
import { GrantAdminService } from '@/modules/rbac/services/grant-admin.service.js';
import { PermissionAdminService } from '@/modules/rbac/services/permission-admin.service.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { RoleAdminService } from '@/modules/rbac/services/role-admin.service.js';
import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

@Global()
@Module({
  providers: [
    RbacService,
    RoleAdminService,
    PermissionAdminService,
    GrantAdminService,
  ],
  exports: [RbacService],
  controllers: [RolesController, PermissionController, GrantController],
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
})
export class RbacModule {}
