import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { SalaryDto } from "./dto/salary.dto";
import { SalaryService } from "./salary.service";
@Controller()
export class SalaryController {
  constructor(private readonly service: SalaryService) {}
  @Get("public/exam-cycles/:cycleId/salary") pub(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/salary")
  @RequirePermissions("exam.salary.manage")
  list(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  @Post("admin/exam-cycles/:cycleId/salary") @RequirePermissions("exam.salary.manage") create(
    @Param("cycleId") id: string,
    @Body() d: SalaryDto,
  ) {
    return this.service.create(id, d);
  }
}
