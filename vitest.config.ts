import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, Plugin } from 'vitest/config';

/**
 * Vite plugin that inlines Angular component templateUrl, strips styleUrl/styleUrls,
 * and patches signal-based inputs into ɵcmp.inputs so TestBed.setInput() works in JIT mode.
 * Used when Vitest runs directly (not through `ng test`).
 */
function inlineAngularResources(): Plugin {
  return {
    name: 'inline-angular-resources',
    transform(code: string, id: string) {
      if (!id.endsWith('.ts') || id.includes('node_modules')) return;

      let transformed = code;

      // Inline templateUrl: './xxx.html' → template: `<content>`
      transformed = transformed.replace(
        /templateUrl:\s*['"](\.[^'"]+\.html)['"]/g,
        (match, url: string) => {
          try {
            const content = readFileSync(resolve(dirname(id), url), 'utf-8');
            const escaped = content
              .replace(/\\/g, '\\\\')
              .replace(/`/g, '\\`')
              .replace(/\$\{/g, '\\${');
            return `template: \`${escaped}\``;
          } catch {
            return match;
          }
        },
      );

      // Strip styleUrl / styleUrls → styles: []
      transformed = transformed
        .replace(/styleUrl:\s*['"'][^'"]+['"]/, 'styles: []')
        .replace(/styleUrls:\s*\[[^\]]*\]/, 'styles: []');

      // Patch signal-based inputs into ɵcmp.inputs for JIT/TestBed compatibility.
      // Angular AOT compiler registers signal inputs in ɵcmp.inputs as [privateName, 1, null].
      // When Vitest runs without the Angular compiler plugin these entries are missing, causing
      // fixture.componentRef.setInput() to throw NG0303.
      //
      // For each Angular component class in this file, find its exported class name and collect
      // all  `readonly propName = input(...)` / `readonly propName = input.required(...)` fields.
      // Then append runtime code that patches ɵcmp.inputs after the class is defined.
      const classPattern = /export\s+(?:default\s+)?class\s+(\w+)/g;
      let classMatch: RegExpExecArray | null;
      const patches: string[] = [];

      while ((classMatch = classPattern.exec(transformed)) !== null) {
        const className = classMatch[1];
        // Find signal input declarations: readonly propName = input(...) or input.required(...)
        const inputPattern = /readonly\s+(\w+)\s*=\s*input(?:\.required)?(?:<[^>]*>)?\s*\(/g;
        const inputs: string[] = [];
        let inputMatch: RegExpExecArray | null;
        while ((inputMatch = inputPattern.exec(transformed)) !== null) {
          inputs.push(inputMatch[1]);
        }
        if (inputs.length > 0) {
          // InputFlags.SignalBased = 1
          const entries = inputs
            .map(
              (name) =>
                `  if (!cmp.inputs['${name}']) cmp.inputs['${name}'] = ['${name}', 1, null];`,
            )
            .join('\n');
          patches.push(
            `{\n  const cmp = (${className} as any).ɵcmp;\n  if (cmp) {\n${entries}\n  }\n}`,
          );
        }
      }

      if (patches.length > 0) {
        transformed = transformed + '\n' + patches.join('\n');
      }

      if (transformed !== code) return transformed;
    },
  };
}

export default defineConfig({
  plugins: [inlineAngularResources()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
  },
});
