import { DealershipStatus, PrismaClient, Role } from '@prisma/client';
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
  { name: 'Get Auto Finance', slug: 'get-auto-finance' }
] as const;

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const dealerGroup = await prisma.dealerGroup.upsert({
    where: { name: PLAZA_AUTO_GROUP_NAME },
    update: {},
    create: {
      name: PLAZA_AUTO_GROUP_NAME
    }
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

  const primaryDealership = await prisma.dealership.findUniqueOrThrow({ where: { slug: 'plaza-kia' } });

  const users = [
    { email: 'admin@dealerforge.local', firstName: 'Alice', lastName: 'Admin', role: Role.ADMIN, isPlatformAdmin: true, isPlatformOperator: false },
    { email: 'operator@dealerforge.local', firstName: 'Opal', lastName: 'Operator', role: Role.MANAGER, isPlatformAdmin: false, isPlatformOperator: true },
    { email: 'manager@dealerforge.local', firstName: 'Manny', lastName: 'Manager', role: Role.MANAGER, isPlatformAdmin: false, isPlatformOperator: false },
    { email: 'sales1@dealerforge.local', firstName: 'Sally', lastName: 'Sales', role: Role.SALES, isPlatformAdmin: false, isPlatformOperator: false },
    { email: 'sales2@dealerforge.local', firstName: 'Sam', lastName: 'Sales', role: Role.SALES, isPlatformAdmin: false, isPlatformOperator: false }
  ];

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

    await prisma.userDealershipRole.upsert({
      where: {
        userId_dealershipId: {
          userId: user.id,
          dealershipId: primaryDealership.id
        }
      },
      update: {
        role: userInput.role
      },
      create: {
        userId: user.id,
        dealershipId: primaryDealership.id,
        role: userInput.role
      }
    });
  }

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
