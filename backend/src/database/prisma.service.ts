import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

@Injectable()
/** Application-scoped Prisma client configured with the PostgreSQL driver adapter. */
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  /** Opens the Prisma connection when the Nest application starts. */
  async onModuleInit() {
    await this.$connect();
  }
  /** Closes the Prisma connection during graceful application shutdown. */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
