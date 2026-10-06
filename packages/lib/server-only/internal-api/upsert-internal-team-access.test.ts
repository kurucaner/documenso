import { OrganisationMemberRole, TeamMemberRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  organisation: {
    findUnique: vi.fn(),
  },
  organisationMember: {
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
}));

const addUserToOrganisationMock = vi.hoisted(() => vi.fn());
const addTeamMembersInternalMock = vi.hoisted(() => vi.fn());
const removeTeamMemberInternalMock = vi.hoisted(() => vi.fn());
const createUserMock = vi.hoisted(() => vi.fn());
const isInternalSecretConfiguredMock = vi.hoisted(() => vi.fn());

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@documenso/ee/server-only/stripe/update-subscription-item-quantity', () => ({
  assertMemberCountWithinCap: vi.fn(),
  syncMemberCountWithStripeSeatPlan: vi.fn(),
}));

vi.mock('@documenso/lib/server-only/organisation/accept-organisation-invitation', () => ({
  addUserToOrganisation: addUserToOrganisationMock,
}));

vi.mock('@documenso/lib/server-only/team/add-team-members-internal', () => ({
  addTeamMembersInternal: addTeamMembersInternalMock,
}));

vi.mock('@documenso/lib/server-only/team/remove-team-member-internal', () => ({
  removeTeamMemberInternal: removeTeamMemberInternalMock,
}));

vi.mock('@documenso/lib/server-only/user/create-user', () => ({
  createUser: createUserMock,
}));

vi.mock('./is-internal-secret-configured', () => ({
  isInternalSecretConfigured: isInternalSecretConfiguredMock,
}));

const { upsertInternalTeamAccess } = await import('./upsert-internal-team-access');

describe('upsert-internal-team-access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isInternalSecretConfiguredMock.mockReturnValue(true);
    removeTeamMemberInternalMock.mockResolvedValue(undefined);
    addTeamMembersInternalMock.mockResolvedValue(undefined);
  });

  it('returns active membership for an existing org member', async () => {
    prismaMock.organisation.findUnique.mockResolvedValue({
      groups: [],
      id: 'org_1',
      members: [{ id: 'member_existing' }],
      organisationClaim: { teamCount: 0 },
      subscription: null,
      teams: [{ id: 10 }],
    });
    prismaMock.user.findFirst.mockResolvedValue({ id: 42 });
    prismaMock.organisationMember.findFirst.mockResolvedValue({ id: 'member_existing' });

    const result = await upsertInternalTeamAccess({
      email: 'manager@example.com',
      orgUrl: 'owner_org',
      organisationMemberRole: OrganisationMemberRole.MEMBER,
      teamMemberRole: TeamMemberRole.MANAGER,
      teamUrl: 'property_team',
    });

    expect(result).toEqual({
      organisationMemberId: 'member_existing',
      status: 'active',
      userId: 42,
    });
    expect(removeTeamMemberInternalMock).toHaveBeenCalledWith({
      organisationMemberId: 'member_existing',
      teamId: 10,
    });
    expect(addTeamMembersInternalMock).toHaveBeenCalledWith({
      membersToCreate: [
        {
          organisationMemberId: 'member_existing',
          teamRole: TeamMemberRole.MANAGER,
        },
      ],
      teamId: 10,
    });
    expect(addUserToOrganisationMock).not.toHaveBeenCalled();
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('provisions user and adds org membership when missing', async () => {
    prismaMock.organisation.findUnique.mockResolvedValue({
      groups: [{ id: 'group_1' }],
      id: 'org_1',
      members: [],
      organisationClaim: { teamCount: 0 },
      subscription: null,
      teams: [{ id: 10 }],
    });
    prismaMock.user.findFirst.mockResolvedValue(null);
    createUserMock.mockResolvedValue({ id: 99 });
    prismaMock.organisationMember.findFirst.mockResolvedValueOnce(null);
    prismaMock.organisationMember.findFirstOrThrow.mockResolvedValue({ id: 'member_new' });

    const result = await upsertInternalTeamAccess({
      email: 'new@example.com',
      name: 'New Manager',
      orgUrl: 'owner_org',
      organisationMemberRole: OrganisationMemberRole.MEMBER,
      provisionIfMissing: true,
      teamMemberRole: TeamMemberRole.MANAGER,
      teamUrl: 'property_team',
    });

    expect(result.userId).toBe(99);
    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        skipPersonalOrganisation: true,
      }),
    );
    expect(addUserToOrganisationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org_1',
        organisationMemberRole: OrganisationMemberRole.MEMBER,
        userId: 99,
      }),
    );
  });

  it('rejects when internal secret is not configured', async () => {
    isInternalSecretConfiguredMock.mockReturnValue(false);

    await expect(
      upsertInternalTeamAccess({
        email: 'manager@example.com',
        orgUrl: 'owner_org',
        organisationMemberRole: OrganisationMemberRole.MEMBER,
        teamMemberRole: TeamMemberRole.MEMBER,
        teamUrl: 'property_team',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_SETUP,
      statusCode: 503,
    });
  });

  it('returns NOT_FOUND when user is missing and provision is disabled', async () => {
    prismaMock.organisation.findUnique.mockResolvedValue({
      groups: [],
      id: 'org_1',
      members: [],
      organisationClaim: { teamCount: 0 },
      subscription: null,
      teams: [{ id: 10 }],
    });
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      upsertInternalTeamAccess({
        email: 'missing@example.com',
        orgUrl: 'owner_org',
        organisationMemberRole: OrganisationMemberRole.MEMBER,
        teamMemberRole: TeamMemberRole.MEMBER,
        teamUrl: 'property_team',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });
  });
});
