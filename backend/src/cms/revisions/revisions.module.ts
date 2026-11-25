import { Module } from "@nestjs/common";
import { ContentModule } from "../content/content.module";
import { CmsRevisionsController } from "./revisions.controller";
import { RevisionsService } from "./revisions.service";
@Module({ imports: [ContentModule], controllers: [CmsRevisionsController], providers: [RevisionsService] })
export class RevisionsModule {}
