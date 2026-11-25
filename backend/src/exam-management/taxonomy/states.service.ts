import { Injectable } from "@nestjs/common";
import { ExamsService } from "../exams/exams.service";
@Injectable()
export class StatesService {
  constructor(private readonly exams: ExamsService) {}
}
