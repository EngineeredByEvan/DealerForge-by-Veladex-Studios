import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const autoGroup = await prisma.autoGroup.upsert({
    where: { id: 'plaza-auto-group' },
    update: { name: 'Plaza Auto Group' },
    create: {
      id: 'plaza-auto-group',
      name: 'Plaza Auto Group'
    }
  });

  const dealership = await prisma.dealership.upsert({
    where: { id: 'woodstock-mazda' },
    update: { name: 'Woodstock Mazda', autoGroupId: autoGroup.id },
    create: {
      id: 'woodstock-mazda',
      name: 'Woodstock Mazda',
      autoGroupId: autoGroup.id
    }
  });

  const users = [
    { email: 'admin@dealerforge.local', firstName: 'Alice', lastName: 'Admin', role: Role.ADMIN },
    { email: 'manager@dealerforge.local', firstName: 'Manny', lastName: 'Manager', role: Role.MANAGER },
    { email: 'sales1@dealerforge.local', firstName: 'Sally', lastName: 'Sales', role: Role.SALES },
    { email: 'sales2@dealerforge.local', firstName: 'Sam', lastName: 'Sales', role: Role.SALES }
  ];

  for (const userInput of users) {
    const user = await prisma.user.upsert({
      where: { email: userInput.email },
      update: {
        firstName: userInput.firstName,
        lastName: userInput.lastName,
        passwordHash
      },
      create: {
        email: userInput.email,
        firstName: userInput.firstName,
        lastName: userInput.lastName,
        passwordHash
      }
    });

    await prisma.userDealershipRole.upsert({
      where: {
        userId_dealershipId: {
          userId: user.id,
          dealershipId: dealership.id
        }
      },
      update: {
        role: userInput.role
      },
      create: {
        userId: user.id,
        dealershipId: dealership.id,
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
