import { Module } from "@nestjs/common";
import { CmsContentController } from "./content.controller";
import { ContentService } from "./content.service";
@Module({ controllers: [CmsContentController], providers: [ContentService], exports: [ContentService] })
export class ContentModule {}
