import {test,expect} from '@playwright/test';
// Product-mode tests live in ygrip/pdf-tools. This checks only catalog integration.
for(const [path,title,help] of [['/pdf-tools/','PDF Tools','How to use'],['/id/pdf-tools/','Alat PDF','Cara pakai']]){
 test(`PDF Tools registration starts with explicit permissions at ${path}`,async({page})=>{
  await page.goto(path);
  await expect(page.locator('iframe')).toHaveCount(0);
  const checks=page.getByRole('checkbox');
  await expect(checks).toHaveCount(3);
  for(const checkbox of await checks.all())await checkbox.check();
  await page.locator('button').filter({hasText:path.startsWith('/id/')?'Mulai dengan izin':'Start with selected permissions'}).click();
  const tool=page.frameLocator('iframe');
  await expect(tool.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await expect(tool.getByRole('tab')).toHaveCount(7);
  await tool.getByRole('button',{name:help,exact:true}).click();
  await expect(tool.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tool.getByRole('dialog')).not.toBeVisible();
 });
}
