import { DealershipStatus, LeadStatus, LeadType, MessageChannel, MessageDirection, MessageStatus, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLAZA_AUTO_GROUP_NAME = 'Plaza Auto Group';

const plazaRooftops = [
  { name: 'Bolton Kia', slug: 'bolton-kia' },
  { name: 'Cobourg Kia', slug: 'cobourg-kia' },
  { name: 'Plaza Kia', slug: 'plaza-kia' },
  { name: 'Orillia Kia', slug: 'orillia-kia' },
  { name: 'Orillia Volkswagen', slug: 'orillia-volkswagen' },
  { name: 'Subaru of Orillia', slug: 'subaru-of-orillia' },
  { name: 'HWY 11 Ram', slug: 'hwy-11-ram' },
  { name: 'Get Auto Finance', slug: 'get-auto-finance' },
  { name: 'Woodstock Mazda', slug: 'woodstock-mazda' }
] as const;

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const dealerGroup = await prisma.dealerGroup.upsert({
    where: { name: PLAZA_AUTO_GROUP_NAME },
    update: {},
    create: { name: PLAZA_AUTO_GROUP_NAME }
  });

  for (const rooftop of plazaRooftops) {
    await prisma.dealership.upsert({
      where: { slug: rooftop.slug },
      update: {
        name: rooftop.name,
        dealerGroupId: dealerGroup.id,
        timezone: 'America/Toronto',
        status: DealershipStatus.ACTIVE
      },
      create: {
        name: rooftop.name,
        slug: rooftop.slug,
        timezone: 'America/Toronto',
        status: DealershipStatus.ACTIVE,
        dealerGroupId: dealerGroup.id
      }
    });
  }

  const dealerships = await prisma.dealership.findMany({ where: { dealerGroupId: dealerGroup.id }, select: { id: true, slug: true } });
  const primaryDealership = dealerships.find((dealership) => dealership.slug === 'woodstock-mazda');
  if (!primaryDealership) throw new Error('Expected Woodstock Mazda dealership to exist after seed upsert');

  const users = [
    { email: 'admin@dealerforge.local', firstName: 'Alice', lastName: 'Admin', role: Role.ADMIN, isPlatformAdmin: false, isPlatformOperator: false },
    { email: 'operator@dealerforge.local', firstName: 'Opal', lastName: 'Operator', role: Role.MANAGER, isPlatformAdmin: false, isPlatformOperator: true },
    { email: 'manager@dealerforge.local', firstName: 'Manny', lastName: 'Manager', role: Role.MANAGER, isPlatformAdmin: false, isPlatformOperator: false },
    { email: 'sales1@dealerforge.local', firstName: 'Sally', lastName: 'Sales', role: Role.SALES, isPlatformAdmin: false, isPlatformOperator: false },
    { email: 'sales2@dealerforge.local', firstName: 'Sam', lastName: 'Sales', role: Role.SALES, isPlatformAdmin: false, isPlatformOperator: false }
  ];

  const createdUsers = new Map<string, { id: string; email: string; firstName: string; lastName: string }>();

  for (const userInput of users) {
    const user = await prisma.user.upsert({
      where: { email: userInput.email },
      update: {
        firstName: userInput.firstName,
        lastName: userInput.lastName,
        passwordHash,
        isPlatformAdmin: userInput.isPlatformAdmin,
        isPlatformOperator: userInput.isPlatformOperator
      },
      create: {
        email: userInput.email,
        firstName: userInput.firstName,
        lastName: userInput.lastName,
        passwordHash,
        isPlatformAdmin: userInput.isPlatformAdmin,
        isPlatformOperator: userInput.isPlatformOperator
      }
    });

    createdUsers.set(user.email, { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });

    const dealershipsToAssign = userInput.isPlatformAdmin || userInput.isPlatformOperator ? dealerships : [primaryDealership];

    for (const dealership of dealershipsToAssign) {
      await prisma.userDealershipRole.upsert({
        where: { userId_dealershipId: { userId: user.id, dealershipId: dealership.id } },
        update: { role: userInput.role, isActive: true },
        create: { userId: user.id, dealershipId: dealership.id, role: userInput.role }
      });
    }
  }


  for (const dealership of dealerships) {
    const slugPrefix = dealership.slug.replace(/[^a-z0-9]+/gi, '-');
    const perStoreUsers = [
      { email: `manager+${slugPrefix}@dealerforge.local`, firstName: 'Store', lastName: 'Manager', role: Role.MANAGER },
      { email: `sales1+${slugPrefix}@dealerforge.local`, firstName: 'Store', lastName: 'SalesOne', role: Role.SALES },
      { email: `sales2+${slugPrefix}@dealerforge.local`, firstName: 'Store', lastName: 'SalesTwo', role: Role.SALES }
    ] as const;

    for (const userInput of perStoreUsers) {
      const user = await prisma.user.upsert({
        where: { email: userInput.email },
        update: {
          firstName: userInput.firstName,
          lastName: userInput.lastName,
          passwordHash,
          isPlatformAdmin: false,
          isPlatformOperator: false
        },
        create: {
          email: userInput.email,
          firstName: userInput.firstName,
          lastName: userInput.lastName,
          passwordHash,
          isPlatformAdmin: false,
          isPlatformOperator: false
        }
      });

      await prisma.userDealershipRole.upsert({
        where: { userId_dealershipId: { userId: user.id, dealershipId: dealership.id } },
        update: { role: userInput.role, isActive: true },
        create: { userId: user.id, dealershipId: dealership.id, role: userInput.role, isActive: true }
      });
    }
  }

  const salesUser = createdUsers.get('sales1@dealerforge.local');
  const managerUser = createdUsers.get('manager@dealerforge.local');
  if (!salesUser || !managerUser) throw new Error('Expected seeded users to exist');

  const source = await prisma.leadSource.upsert({
    where: { dealershipId_name: { dealershipId: primaryDealership.id, name: 'Website' } },
    update: {},
    create: { dealershipId: primaryDealership.id, name: 'Website' }
  });

  const lead = await prisma.lead.upsert({
    where: { id: 'seed-lead-woodstock' },
    update: {
      dealershipId: primaryDealership.id,
      sourceId: source.id,
      status: LeadStatus.CONTACTED,
      leadType: LeadType.INTERNET,
      assignedToUserId: salesUser.id,
      firstName: 'Jordan',
      lastName: 'Taylor',
      email: 'jordan.taylor@example.com',
      phone: '+15195550101',
      vehicleInterest: 'Mazda CX-50',
      leadScore: 82,
      lastActivityAt: new Date()
    },
    create: {
      id: 'seed-lead-woodstock',
      dealershipId: primaryDealership.id,
      sourceId: source.id,
      status: LeadStatus.CONTACTED,
      leadType: LeadType.INTERNET,
      assignedToUserId: salesUser.id,
      firstName: 'Jordan',
      lastName: 'Taylor',
      email: 'jordan.taylor@example.com',
      phone: '+15195550101',
      vehicleInterest: 'Mazda CX-50',
      leadScore: 82,
      lastActivityAt: new Date()
    }
  });

  await prisma.task.upsert({
    where: { id: 'seed-task-woodstock' },
    update: {
      dealershipId: primaryDealership.id,
      title: 'Follow up with Jordan on finance options',
      description: 'Confirm preferred monthly payment and trade-in details.',
      assignedToUserId: salesUser.id,
      leadId: lead.id
    },
    create: {
      id: 'seed-task-woodstock',
      dealershipId: primaryDealership.id,
      title: 'Follow up with Jordan on finance options',
      description: 'Confirm preferred monthly payment and trade-in details.',
      assignedToUserId: salesUser.id,
      leadId: lead.id
    }
  });

  const thread = await prisma.conversationThread.upsert({
    where: { dealershipId_leadId: { dealershipId: primaryDealership.id, leadId: lead.id } },
    update: {},
    create: { dealershipId: primaryDealership.id, leadId: lead.id }
  });

  await prisma.message.upsert({
    where: { id: 'seed-message-woodstock' },
    update: {
      dealershipId: primaryDealership.id,
      threadId: thread.id,
      channel: MessageChannel.SMS,
      direction: MessageDirection.OUTBOUND,
      body: 'Hi Jordan, this is Sally from Woodstock Mazda. Are you still interested in the CX-50?',
      status: MessageStatus.SENT,
      actorUserId: salesUser.id,
      sentAt: new Date()
    },
    create: {
      id: 'seed-message-woodstock',
      dealershipId: primaryDealership.id,
      threadId: thread.id,
      channel: MessageChannel.SMS,
      direction: MessageDirection.OUTBOUND,
      body: 'Hi Jordan, this is Sally from Woodstock Mazda. Are you still interested in the CX-50?',
      status: MessageStatus.SENT,
      actorUserId: salesUser.id,
      sentAt: new Date()
    }
  });

  await prisma.communicationTemplate.upsert({
    where: { dealershipId_channel_name: { dealershipId: primaryDealership.id, channel: MessageChannel.SMS, name: 'Initial follow-up' } },
    update: {
      body: 'Hi {{firstName}}, thanks for visiting {{dealershipName}}. Are you still looking at the {{vehicle}}?',
      createdBy: managerUser.id,
      isActive: true
    },
    create: {
      dealershipId: primaryDealership.id,
      channel: MessageChannel.SMS,
      name: 'Initial follow-up',
      body: 'Hi {{firstName}}, thanks for visiting {{dealershipName}}. Are you still looking at the {{vehicle}}?',
      createdBy: managerUser.id,
      isActive: true
    }
  });

  console.log('Seed complete. Test password for all users: Password123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
