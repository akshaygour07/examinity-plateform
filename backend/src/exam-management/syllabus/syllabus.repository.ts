import { Injectable } from "@nestjs/common"; import { PrismaService } from "../../database/prisma.service"; @Injectable() export class SyllabusRepository{constructor(readonly prisma:PrismaService){}}
