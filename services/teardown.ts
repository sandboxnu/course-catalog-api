import prisma from './prisma';

afterAll(async () => prisma.$disconnect());
