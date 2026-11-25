import { Module } from "@nestjs/common";
import { ExamsModule } from "../exams/exams.module";
import { CategoriesService } from "./categories.service";
import { ExamBodiesService } from "./exam-bodies.service";
import { ExamGroupsService } from "./exam-groups.service";
import { StatesService } from "./states.service";
import { TaxonomyController } from "./taxonomy.controller";

@Module({
  imports: [ExamsModule],
  controllers: [TaxonomyController],
  providers: [
    CategoriesService,
    ExamGroupsService,
    StatesService,
    ExamBodiesService,
  ],
  exports: [CategoriesService, ExamGroupsService, StatesService, ExamBodiesService],
})
export class TaxonomyModule {}
