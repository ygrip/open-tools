import {test,expect} from '@playwright/test';

test('registered image tool runs natively in the real sandbox and preserves resolution across themes',async({page})=>{
 await page.goto('/image-compression/');
 await page.getByRole('checkbox',{name:/Run isolated background workers/}).check();
 await page.getByRole('button',{name:'Start with selected permissions',exact:true}).click();
 const frame=page.frameLocator('iframe');
 await frame.getByRole('button',{name:'Try a sample'}).click();
 await expect(frame.locator('.file')).toHaveCount(1);
 await frame.locator('#resolution').selectOption('custom');
 await frame.locator('#width').fill('640');await frame.locator('#width').dispatchEvent('change');
 await frame.locator('#format').selectOption('jpeg');await frame.locator('#run').click();
 await expect(frame.locator('#result-meta')).toContainText('640 × 400');
 const sandbox=await page.locator('iframe').getAttribute('sandbox');expect(sandbox).toBe('allow-scripts');
 const doc=await page.locator('iframe').getAttribute('srcdoc');expect(doc).toContain("connect-src 'none'");expect(doc).not.toContain('allow-same-origin');
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
 await expect(frame.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(frame.locator('#result-meta')).toContainText('640 × 400');
});
