import { AuditModule } from '@/common/audit/audit.module.js';
import { GrantController } from '@/modules/rbac/controllers/grant.controller.js';
import { PermissionController } from '@/modules/rbac/controllers/permission.controller.js';
import { RolesController } from '@/modules/rbac/controllers/roles.controller.js';
import { UserRoleController } from '@/modules/rbac/controllers/user-roles.controller.js';
import { GrantAdminService } from '@/modules/rbac/services/grant-admin.service.js';
import { PermissionAdminService } from '@/modules/rbac/services/permission-admin.service.js';
import { RbacService } from '@/modules/rbac/services/rbac.service.js';
import { RoleAdminService } from '@/modules/rbac/services/role-admin.service.js';
import { UserRoleService } from '@/modules/rbac/services/user-roles.service.js';
import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

@Global()
@Module({
  providers: [
    RbacService,
    RoleAdminService,
    PermissionAdminService,
    GrantAdminService,
    UserRoleService,
  ],
  exports: [RbacService],
  controllers: [
    RolesController,
    PermissionController,
    GrantController,
    UserRoleController,
  ],
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), AuditModule],
})
export class RbacModule {}
