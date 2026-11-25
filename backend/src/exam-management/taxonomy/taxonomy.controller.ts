import { Controller } from "@nestjs/common";

/**
 * Single HTTP boundary for taxonomy resources. Resource-specific application
 * services remain separate so category, group, state, and authority rules do
 * not become coupled.
 */
@Controller()
export class TaxonomyController {}
