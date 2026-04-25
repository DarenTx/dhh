import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-expenses-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="padding: 2rem 1.5rem;">
      <h1 style="margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 700; color: #2d3748;">
        Expenses
      </h1>
      <p style="color: #718096;">Coming in Phase 2.</p>
    </div>
  `,
})
export class ExpensesPage {}
