import { Module } from "@nestjs/common";
import { CmsReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
@Module({ controllers: [CmsReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
