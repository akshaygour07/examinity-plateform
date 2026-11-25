import { Module } from "@nestjs/common";
import { TaxonomyModule } from "./taxonomy/taxonomy.module";
import { ExamsModule } from "./exams/exams.module";
import { OverviewModule } from "./overview/overview.module";
import { EligibilityModule } from "./eligibility/eligibility.module";
import { ExamPatternModule } from "./exam-pattern/exam-pattern.module";
import { SyllabusModule } from "./syllabus/syllabus.module";
import { EventsModule } from "./events/events.module";
import { SelectionProcessModule } from "./selection-process/selection-process.module";
import { SalaryModule } from "./salary/salary.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { CutoffsModule } from "./cutoffs/cutoffs.module";
@Module({
    imports: [
        TaxonomyModule,
        ExamsModule,
        OverviewModule,
        EligibilityModule,
        ExamPatternModule,
        SyllabusModule,
        EventsModule,
        SelectionProcessModule,
        SalaryModule,
        AnalysisModule,
        CutoffsModule
    ]
})
export class ExamManagementModule { }
