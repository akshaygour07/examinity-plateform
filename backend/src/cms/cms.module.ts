import { Module } from "@nestjs/common";
import { Auth0Guard } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { ContentModule } from "./content/content.module";
import { RevisionsModule } from "./revisions/revisions.module";
import { WorkflowModule } from "./workflow/workflow.module";
import { ReviewsModule } from "./reviews/reviews.module";

@Module({
  imports: [ContentModule, RevisionsModule, WorkflowModule, ReviewsModule],
  providers: [Auth0Guard, AuthorizationGuard],
})
export class CmsModule {}
