import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { examManagementPermissionCodes } from "../src/roles/baseline-permissions";

type RouteContract = {
  controller: string;
  method: string;
  path: string;
  admin: boolean;
  hasAuthGuards: boolean;
  hasBearerAuth: boolean;
  hasPermission: boolean;
  permissions: string[];
  hasSwaggerOperation: boolean;
  hasJSDoc: boolean;
};

function listControllers(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return listControllers(file);
    return entry.name.endsWith(".controller.ts") ? [file] : [];
  });
}

function decoratorsOf(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function hasDecorator(decorators: readonly ts.Decorator[], name: string): boolean {
  return decorators.some((decorator) => ts.isCallExpression(decorator.expression) && decorator.expression.expression.getText() === name);
}

function hasBothAuthGuards(decorators: readonly ts.Decorator[]): boolean {
  return decorators.some((decorator) => {
    if (!ts.isCallExpression(decorator.expression) || decorator.expression.expression.getText() !== "UseGuards") return false;
    const guards = decorator.expression.arguments.map((argument) => argument.getText());
    return guards.includes("Auth0Guard") && guards.includes("AuthorizationGuard");
  });
}

function collectRouteContracts(): RouteContract[] {
  const root = path.resolve(process.cwd(), "src/exam-management");
  const contracts: RouteContract[] = [];

  for (const file of listControllers(root)) {
    const text = readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    function visit(node: ts.Node): void {
      if (!ts.isClassDeclaration(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      const classDecorators = decoratorsOf(node);
      const classGuarded = hasBothAuthGuards(classDecorators);
      const classBearerAuth = hasDecorator(classDecorators, "ApiBearerAuth");

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const decorators = decoratorsOf(member);
        const routeDecorators = decorators.filter(
          (decorator) =>
            ts.isCallExpression(decorator.expression) &&
            ["Get", "Post", "Put", "Patch", "Delete"].includes(decorator.expression.expression.getText()),
        );

        for (const decorator of routeDecorators) {
          if (!ts.isCallExpression(decorator.expression)) continue;
          const routeArgument = decorator.expression.arguments[0];
          const routes =
            routeArgument && ts.isStringLiteral(routeArgument)
              ? [routeArgument.text]
              : routeArgument && ts.isArrayLiteralExpression(routeArgument)
                ? routeArgument.elements.filter(ts.isStringLiteral).map((item) => item.text)
                : [];

          for (const route of routes) {
            const firstDecorator = decorators[0];
            const decoratorStart = firstDecorator?.getStart(sourceFile) ?? member.getStart(sourceFile);
            const commentStart = text.lastIndexOf("/**", decoratorStart);
            const commentEnd = commentStart >= 0 ? text.indexOf("*/", commentStart) + 2 : -1;
            const hasJSDoc = commentStart >= 0 && commentEnd > commentStart && text.slice(commentEnd, decoratorStart).trim() === "";
            const admin = route.startsWith("admin/");
            const methodName = member.name?.getText(sourceFile) ?? "unknown";

            contracts.push({
              controller: path.basename(file),
              method: methodName,
              path: route,
              admin,
              hasAuthGuards: classGuarded || hasBothAuthGuards(decorators),
              hasBearerAuth: classBearerAuth || hasDecorator(decorators, "ApiBearerAuth"),
              hasPermission: hasDecorator(decorators, "RequirePermissions"),
              permissions: decorators.flatMap((item) => {
                if (!ts.isCallExpression(item.expression) || item.expression.expression.getText() !== "RequirePermissions") return [];
                return item.expression.arguments.filter(ts.isStringLiteral).map((argument) => argument.text);
              }),
              hasSwaggerOperation: hasDecorator(decorators, "ApiOperation"),
              hasJSDoc,
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return contracts;
}

describe("Module 2 API controller contract", () => {
  const routes = collectRouteContracts();

  test("documents every route with JSDoc and a Swagger operation", () => {
    assert.ok(routes.length > 0, "expected to discover Module 2 controller routes");
    const missing = routes.filter((route) => !route.hasJSDoc || !route.hasSwaggerOperation);
    assert.deepEqual(missing, []);
  });

  test("protects every admin route with Auth0, authorization, bearer auth, and permission metadata", () => {
    const adminRoutes = routes.filter((route) => route.admin);
    assert.ok(adminRoutes.length > 0, "expected to discover Module 2 admin routes");
    const unsecured = adminRoutes.filter((route) => !route.hasAuthGuards || !route.hasBearerAuth || !route.hasPermission);
    assert.deepEqual(unsecured, []);
  });

  test("uses only permission codes registered for Module 2", () => {
    const registered = new Set<string>(examManagementPermissionCodes);
    const missing = routes.flatMap((route) =>
      route.permissions.filter((permission) => !registered.has(permission)).map((permission) => ({ ...route, permission })),
    );
    assert.deepEqual(missing, []);
  });
});
