import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { CancelEventDto, EventDto, EventRevisionDto } from "./dto/event.dto";
import { EventsService } from "./events.service";
@Controller()
export class EventsController {
  constructor(private readonly service: EventsService) {}
  @Get("public/exam-cycles/:cycleId/events") publicList(@Param("cycleId") id: string) {
    return this.service.list(id, true);
  }
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/events")
  @RequirePermissions("exam.events.manage")
  list(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  @Post("admin/exam-cycles/:cycleId/events") @RequirePermissions("exam.events.manage") create(
    @Param("cycleId") id: string,
    @Body() d: EventDto,
  ) {
    return this.service.create(id, d);
  }
  @Patch("admin/exam-events/:eventId") @RequirePermissions("exam.events.manage") update(@Param("eventId") id: string, @Body() d: EventDto) {
    return this.service.update(id, d);
  }
  @Post("admin/exam-events/:eventId/revisions") @RequirePermissions("exam.events.manage") revise(
    @Param("eventId") id: string,
    @Body() d: EventRevisionDto,
  ) {
    return this.service.revise(id, d);
  }
  @Post("admin/exam-events/:eventId/cancel") @RequirePermissions("exam.events.manage") cancel(
    @Param("eventId") id: string,
    @Body() d: CancelEventDto,
  ) {
    return this.service.cancel(id, d);
  }
}
