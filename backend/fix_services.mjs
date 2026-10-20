import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modules = ['auth', 'users', 'khata', 'products', 'orders', 'payments', 'engagement', 'enterprise'];
let fixed = 0;

for (const mod of modules) {
  const filePath = path.join(__dirname, 'src/modules', mod, `${mod}.service.ts`);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${mod} - file not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Step 1: Handle export format - if it's a class, leave as class; if object, leave as object
  // But ensure commas are correct

  // For object literal format: add comma after method closing `}` at 2-space indent
  // that is followed by another method or property (not at end of file)
  content = content.replace(/^  }\n\n  async/gm, '  },\n\n  async');
  content = content.replace(/^  }\n\n  function/gm, '  },\n\n  function');
  content = content.replace(/^  }\n\n  export/gm, '  },\n\n  export');

  // Step 2: Fix the last closing brace of object literals
  // `},\n};` should be `}\n};` (remove comma before file closing)
  if (content.trimEnd().endsWith(',\n};')) {
    content = content.replace(/\n},\n};$/g, '\n}\n};');
  }

  // Step 3: Remove spurious commas after control flow closers
  // Pattern: `    }, catch` -> `    } catch`
  content = content.replace(/^(\s*)},\s*(catch|else|finally)/gm, '$1} $2');

  // Step 4: Remove spurious commas after if/for/while closures
  // Like: `    },` that's just a control flow closer
  content = content.replace(/^(\s*)\}\s*$/gm, (match, spaces) => {
    // If at 4+ space indent, could be control flow OR property
    // Keep the comma for now - TypeScript will tell us if wrong
    return match;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    fixed++;
    console.log(`FIXED: ${mod}`);
  } else {
    console.log(`OK: ${mod} (no changes needed)`);
  }
}

console.log(`\nFixed ${fixed} service files`);
