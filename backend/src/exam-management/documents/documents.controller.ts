import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { RequirePermissions } from "../../auth/authorization";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { DocumentsService } from "./documents.service";
@Controller()
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}
  /**
   * List public exam documents. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public exam documents",
    description: "List public exam documents. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exams/:examId/documents")
  publicDocuments(@Param("examId") id: string) {
    return this.service.list("document", id, true);
  }
  /**
   * List public exam links. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public exam links",
    description: "List public exam links. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exams/:examId/links")
  publicLinks(@Param("examId") id: string) {
    return this.service.list("link", id, true);
  }
  /**
   * List public exam FAQs. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public exam FAQs",
    description: "List public exam FAQs. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exams/:examId/faqs")
  publicFaqs(@Param("examId") id: string) {
    return this.service.list("faq", id, true);
  }
  /**
   * List exam documents. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "List exam documents",
    description:
      "List exam documents. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exams/:examId/documents")
  @RequirePermissions("exam.documents.manage")
  documents(@Param("examId") id: string) {
    return this.service.list("document", id);
  }
  /**
   * Create an exam document. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an exam document",
    description:
      "Create an exam document. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exams/:examId/documents")
  @RequirePermissions("exam.documents.manage")
  createDocument(@Param("examId") id: string, @Body() body: Record<string, unknown>) {
    return this.service.create("document", id, body);
  }
  /**
   * Update an exam document. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an exam document",
    description:
      "Update an exam document. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exam-documents/:documentId")
  @RequirePermissions("exam.documents.manage")
  updateDocument(@Param("documentId") id: string, @Body() body: Record<string, unknown>) {
    return this.service.update("document", id, body);
  }
  /**
   * List exam links. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List exam links",
    description:
      "List exam links. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exams/:examId/links")
  @RequirePermissions("exam.documents.manage")
  links(@Param("examId") id: string) {
    return this.service.list("link", id);
  }
  /**
   * Create an exam link. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an exam link",
    description:
      "Create an exam link. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exams/:examId/links")
  @RequirePermissions("exam.documents.manage")
  createLink(@Param("examId") id: string, @Body() body: Record<string, unknown>) {
    return this.service.create("link", id, body);
  }
  /**
   * Update an exam link. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an exam link",
    description:
      "Update an exam link. Requires the exam.documents.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exam-links/:linkId")
  @RequirePermissions("exam.documents.manage")
  updateLink(@Param("linkId") id: string, @Body() body: Record<string, unknown>) {
    return this.service.update("link", id, body);
  }
  /**
   * List exam FAQs. Requires the exam.faq.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List exam FAQs",
    description:
      "List exam FAQs. Requires the exam.faq.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exams/:examId/faqs")
  @RequirePermissions("exam.faq.manage")
  faqs(@Param("examId") id: string) {
    return this.service.list("faq", id);
  }
  /**
   * Create an exam FAQ. Requires the exam.faq.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an exam FAQ",
    description:
      "Create an exam FAQ. Requires the exam.faq.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exams/:examId/faqs")
  @RequirePermissions("exam.faq.manage")
  createFaq(@Param("examId") id: string, @Body() body: Record<string, unknown>) {
    return this.service.create("faq", id, body);
  }
  /**
   * Update an exam FAQ. Requires the exam.faq.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an exam FAQ",
    description:
      "Update an exam FAQ. Requires the exam.faq.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exam-faqs/:faqId")
  @RequirePermissions("exam.faq.manage")
  updateFaq(@Param("faqId") id: string, @Body() body: Record<string, unknown>) {
    return this.service.update("faq", id, body);
  }
}
