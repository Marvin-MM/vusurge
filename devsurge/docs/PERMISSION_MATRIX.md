# DevArena — Role & Permission Matrix

DevArena implements a dual-tiered Role-Based Access Control (RBAC) architecture with:
1. **Global Roles**: `USER`, `PLATFORM_SUPERADMIN`.
2. **Organization Roles**: `ORG_OWNER`, `ORG_ADMIN`, `CHALLENGE_MANAGER`, `MEMBER`.
3. **Challenge-Scoped Roles**: `CHALLENGE_LEAD`, `JUDGE`, `MENTOR`, `PARTICIPANT`.

---

## 1. Global Role Privileges

| Permission | USER | PLATFORM_SUPERADMIN |
| :--- | :---: | :---: |
| Access Public Platform | ✅ | ✅ |
| Access Participant Portal | ✅ | ✅ |
| Create Org Application | ✅ | ✅ |
| Approve / Reject Org Tenants | ❌ | ✅ |
| Moderate Content / Flags | ❌ | ✅ |
| View All Cross-Org Audit Logs | ❌ | ✅ |
| Configure System Feature Flags | ❌ | ✅ |
| Infrastructure Telemetry Access | ❌ | ✅ |

---

## 2. Organization Role Privileges

| Permission | ORG_OWNER | ORG_ADMIN | CHALLENGE_MANAGER | MEMBER |
| :--- | :---: | :---: | :---: | :---: |
| View Organization Overview | ✅ | ✅ | ✅ | ✅ (Public) |
| Manage Organization Settings | ✅ | ✅ | ❌ | ❌ |
| Manage Members & Roles | ✅ | ✅ | ❌ | ❌ |
| Invite Members / Generate Codes | ✅ | ✅ | ❌ | ❌ |
| Transfer Org Ownership | ✅ | ❌ | ❌ | ❌ |
| Delete Organization | ✅ | ❌ | ❌ | ❌ |
| Create / Edit Challenges | ✅ | ✅ | ✅ | ❌ |
| Configure Rubrics & Stages | ✅ | ✅ | ✅ | ❌ |
| Publish Official Results | ✅ | ✅ | ✅ | ❌ |
| View Organization Submissions Pool | ✅ | ✅ | ✅ | ❌ |
| Manage Integrations & Webhooks | ✅ | ✅ | ❌ | ❌ |
| Request Sensitive Data Exports | ✅ | ✅ | ❌ | ❌ |
| View Tenant Audit Logs | ✅ | ✅ | ❌ | ❌ |
| Register / Submit to Challenges | ✅ | ✅ | ✅ | ✅ |

---

## 3. Challenge-Scoped Role Privileges

| Permission | CHALLENGE_LEAD | JUDGE | MENTOR | PARTICIPANT |
| :--- | :---: | :---: | :---: | :---: |
| View Challenge Details | ✅ | ✅ | ✅ | ✅ |
| Screen / Approve Registrants | ✅ | ❌ | ❌ | ❌ |
| View Assigned Submissions | ✅ | ✅ | ✅ | ❌ |
| Submit Weighted Scorecard | ❌ | ✅ | ❌ | ❌ |
| Declare Conflict of Interest | ❌ | ✅ | ❌ | ❌ |
| Create / Edit Team | ❌ | ❌ | ❌ | ✅ |
| Draft / Finalize Submission | ❌ | ❌ | ❌ | ✅ |
| Post Announcements | ✅ | ❌ | ❌ | ❌ |

---

## 4. UI Implementation Standards

1. **Declarative Component Guarding**:
   ```tsx
   <PermissionGate permission="organization.manage_members">
     <Button onClick={openInviteModal}>Invite Members</Button>
   </PermissionGate>
   ```

2. **Route Shell Guarding**:
   ```tsx
   if (!can(userContext, "organization.view_private")) {
     return <ForbiddenPage requiredPermission="organization.view_private" />;
   }
   ```

3. **Sole Owner Protection**:
   * If an organization has exactly 1 `ORG_OWNER`, the UI explicitly disables the delete/demote action and alerts the user to designate a successor owner first.
