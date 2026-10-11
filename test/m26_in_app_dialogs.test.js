const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

describe('In-App Dialogs & Transaction Loop Verification', () => {
  it('1. ConfirmDialog component exists with required exports and provider is mounted in app/_layout.tsx', () => {
    const dialogPath = path.join(ROOT, 'components', 'ui', 'ConfirmDialog.tsx');
    assert.ok(fs.existsSync(dialogPath), 'ConfirmDialog.tsx must exist');
    const dialogSrc = fs.readFileSync(dialogPath, 'utf8');

    assert.ok(dialogSrc.includes('export function showConfirmDialog'), 'Must export showConfirmDialog');
    assert.ok(dialogSrc.includes('export const ConfirmDialog'), 'Must export ConfirmDialog');
    assert.ok(dialogSrc.includes('export const ConfirmDialogProvider'), 'Must export ConfirmDialogProvider');
    assert.ok(dialogSrc.includes('export const useConfirmDialog'), 'Must export useConfirmDialog');

    const layoutPath = path.join(ROOT, 'app', '_layout.tsx');
    const layoutSrc = fs.readFileSync(layoutPath, 'utf8');
    assert.ok(layoutSrc.includes('ConfirmDialogProvider'), 'app/_layout.tsx must mount ConfirmDialogProvider');
  });

  it('2. lib/dialog.ts delegates confirmDialog to in-app ConfirmDialog and notify to showToast', () => {
    const libDialogPath = path.join(ROOT, 'lib', 'dialog.ts');
    assert.ok(fs.existsSync(libDialogPath), 'lib/dialog.ts must exist');
    const src = fs.readFileSync(libDialogPath, 'utf8');

    assert.ok(src.includes('showConfirmDialog'), 'confirmDialog must delegate to showConfirmDialog');
    assert.ok(src.includes('showToast'), 'notify must delegate to showToast');
    assert.ok(!src.includes('window.confirm'), 'lib/dialog.ts must not call window.confirm');
    assert.ok(!src.includes('window.alert'), 'lib/dialog.ts must not call window.alert');
    assert.ok(!src.includes('Alert.alert'), 'lib/dialog.ts must not call Alert.alert');
  });

  it('3. Repo audit: Zero Alert.alert, window.alert, or window.confirm in app/ screens', () => {
    const appDir = path.join(ROOT, 'app');
    const violations = [];

    function scan(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          scan(full);
        } else if (ent.isFile() && (ent.name.endsWith('.tsx') || ent.name.endsWith('.ts'))) {
          const content = fs.readFileSync(full, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            // Check for actual calls, ignoring comment lines
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
            if (
              trimmed.includes('Alert.alert(') ||
              trimmed.includes('window.alert(') ||
              trimmed.includes('window.confirm(') ||
              trimmed.includes('window.prompt(')
            ) {
              violations.push(`${path.relative(ROOT, full)}:${idx + 1} -> ${trimmed}`);
            }
          });
        }
      }
    }

    scan(appDir);
    assert.deepEqual(violations, [], `Found dialog API calls in screens: \n${violations.join('\n')}`);
  });

  it('4. Milestone Review screen (review.tsx) uses confirmDialog and showToast without blocking on Alert.alert', () => {
    const reviewPath = path.join(
      ROOT,
      'app',
      'agreements',
      '[id]',
      'milestones',
      '[milestoneId]',
      'review.tsx'
    );
    const src = fs.readFileSync(reviewPath, 'utf8');

    assert.ok(src.includes('confirmDialog'), 'review.tsx must use confirmDialog');
    assert.ok(src.includes('milestonesService.reviewMilestone(milestoneId, \'approve\')'), 'Must call reviewMilestone with approve');
    assert.ok(src.includes('showToast(strings.toasts.milestoneApproved)'), 'Must show toast on approval');
    assert.ok(src.includes('navigateAfterSuccess()'), 'Must navigate back after approval');
    assert.ok(!src.includes('Alert.alert'), 'review.tsx must not use Alert.alert');
  });

  it('5. Agreement detail screen (agreements/[id].tsx) uses confirmDialog for complete and cancel', () => {
    const agreementPath = path.join(ROOT, 'app', 'agreements', '[id].tsx');
    const src = fs.readFileSync(agreementPath, 'utf8');

    assert.ok(src.includes('confirmDialog'), 'agreements/[id].tsx must use confirmDialog');
    assert.ok(src.includes('paymentsService.completeAgreement'), 'Must call completeAgreement');
    assert.ok(src.includes('showToast(strings.toasts.agreementCompleted)'), 'Must show toast on agreement completion');
    assert.ok(!src.includes('Alert.alert'), 'agreements/[id].tsx must not use Alert.alert');
  });
});
