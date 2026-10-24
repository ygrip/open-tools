import { expect, test } from './fixtures';
import { mountFixture, toolFrame } from './runtime-fixture';

test.use({ serviceWorkers: 'block' });

for (const width of [375, 1440]) {
  test(`tool-only zoom keeps host scale, sandbox, state and auto-height at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await mountFixture(page);
    const iframe = page.locator('.runtime-workspace > iframe');
    const controls = page.getByRole('group', { name: 'Tool zoom' });
    const zoomIn = controls.getByRole('button', { name: 'Zoom in tool' });
    const zoomOut = controls.getByRole('button', { name: 'Zoom out tool' });
    const reset = controls.getByRole('button', { name: 'Reset tool zoom to 100%' });
    const level = controls.getByRole('meter', { name: 'Tool zoom level' });

    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
    await expect(level).toHaveText('100%');
    await expect(reset).toBeDisabled();
    expect(await page.evaluate(() => getComputedStyle(document.body).zoom)).toBe('1');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1');

    const text = page.frameLocator('.runtime-workspace > iframe').getByRole('textbox', { name: 'Remember me' });
    await text.fill('Do not restart my tool');
    const frame = await toolFrame(page);
    const cancelledGestures = await frame.evaluate(() => {
      const events = [
        new WheelEvent('wheel', { ctrlKey: true, cancelable: true }),
        new WheelEvent('wheel', { deltaY: 100, cancelable: true }),
        new KeyboardEvent('keydown', { key: '+', ctrlKey: true, cancelable: true }),
        new Event('gesturechange', { cancelable: true })
      ];
      return events.map(event => !window.dispatchEvent(event));
    });
    expect(cancelledGestures).toEqual([true, false, true, true]);
    await reset.click();
    await expect(level).toHaveText('100%');
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('1');
    await frame.evaluate(() => {
      const extra = document.createElement('div');
      extra.id = 'zoom-height-fixture';
      extra.style.height = '600px';
      document.body.append(extra);
    });
    const height = () => iframe.evaluate((el) => el.getBoundingClientRect().height);
    await expect.poll(height).toBeGreaterThan(600);
    // The toolbar updates before the sandbox applies zoom and reports its new
    // height. Wait for that round trip before recording the 100% baseline.
    await expect.poll(async () => {
      const contentBottom = await frame.evaluate(() => {
        const body = document.body;
        return Math.ceil(body.getBoundingClientRect().bottom + (parseFloat(getComputedStyle(body).marginBottom) || 0));
      });
      return Math.abs(await height() - contentBottom);
    }).toBeLessThanOrEqual(3);
    const beforeHeight = await height();
    const beforeHeading = await frame.evaluate(() => document.querySelector('h1')!.getBoundingClientRect().height);

    await zoomIn.click();
    await expect(level).toHaveText('125%');
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('1.25');
    await expect.poll(height).toBeGreaterThan(beforeHeight);
    await expect.poll(() => frame.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(false);
    const afterHeading = await frame.evaluate(() => document.querySelector('h1')!.getBoundingClientRect().height);
    expect(afterHeading).toBeGreaterThan(beforeHeading * 1.15);
    await expect(text).toHaveValue('Do not restart my tool');
    expect(await page.evaluate(() => getComputedStyle(document.body).zoom)).toBe('1');

    for (let step = 0; step < 3; step++) await zoomIn.click();
    await expect(level).toHaveText('200%');
    await expect(zoomIn).toBeDisabled();
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('2');
    await frame.evaluate(() => {
      const wide = document.createElement('div');
      wide.id = 'zoom-width-fixture';
      wide.style.width = '1800px';
      wide.style.height = '40px';
      document.body.append(wide);
    });
    expect(await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(true);
    await expect.poll(() => frame.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight)).toBe(true);
    const scroll = await frame.evaluate(() => {
      window.scrollTo(100, 100);
      return { x: scrollX, y: scrollY };
    });
    expect(scroll.x).toBeGreaterThan(0);
    expect(scroll.y).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await frame.evaluate(() => document.getElementById('zoom-width-fixture')!.remove());

    // A forged child-window message and a malformed parent message cannot set zoom.
    const token = await frame.evaluate(() => {
      // Configuration is inserted into a different bootstrap script.
      const scripts = [...document.querySelectorAll('script')];
      const sdk = scripts.find((entry) => entry.textContent?.includes('const config = '))!.textContent!;
      const config = JSON.parse(sdk.match(/const config = (\{[^\n]+\});/)![1]);
      window.postMessage({ type: 'trick-it:zoom', version: 1, token: config.token, percent: 75 }, '*');
      return config.token as string;
    });
    await page.evaluate((value) => {
      const sandbox = document.querySelector<HTMLIFrameElement>('.runtime-workspace > iframe')!.contentWindow!;
      sandbox.postMessage({ type: 'trick-it:zoom', version: 1, token: value, percent: 500 }, '*');
      sandbox.postMessage({ type: 'trick-it:zoom', version: 1, token: 'wrong-session', percent: 75 }, '*');
    }, token);
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('2');

    await reset.click();
    await expect(level).toHaveText('100%');
    await expect(reset).toBeDisabled();
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('1');
    await expect.poll(height).toBe(beforeHeight);
    await zoomOut.click();
    await expect(level).toHaveText('75%');
    await expect(zoomOut).toBeDisabled();
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('0.75');
    await expect(text).toHaveValue('Do not restart my tool');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('zoom labels follow the host locale while host magnification is contained', async ({ page }) => {
  await page.goto('/id/json-tools/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1');
  const controls = page.getByRole('group', { name: 'Perbesaran alat' });
  await expect(page.locator('.runtime-workspace > iframe')).toBeVisible();
  await expect(controls.getByRole('button', { name: 'Perbesar tampilan alat' })).toBeVisible();
  await expect(controls.getByRole('button', { name: 'Kembalikan perbesaran alat ke 100%' })).toBeVisible();
});


test('host prevents pinch, wheel and keyboard zoom while ordinary scrolling remains available', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => {
    const pinch = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(pinch, 'touches', { value: [{}, {}] });
    return [
      new WheelEvent('wheel', { ctrlKey: true, cancelable: true }),
      new KeyboardEvent('keydown', { key: '+', ctrlKey: true, cancelable: true }),
      new KeyboardEvent('keydown', { key: '0', metaKey: true, cancelable: true }),
      new Event('gesturestart', { cancelable: true }),
      new Event('gesturechange', { cancelable: true }), pinch,
      new WheelEvent('wheel', { deltaY: 100, cancelable: true }),
      new KeyboardEvent('keydown', { key: '+', cancelable: true })
    ].map(event => !document.dispatchEvent(event));
  })).toEqual([true, true, true, true, true, true, false, false]);
});

test('pinching a tool updates only its zoom control and preserves input without vertical scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mountFixture(page);
  const frame = await toolFrame(page);
  const input = page.frameLocator('.runtime-workspace > iframe').getByRole('textbox', { name: 'Remember me' });
  await input.fill('Keep this input through pinch');
  await frame.evaluate(() => {
    const extra = document.createElement('div');
    extra.style.cssText = 'width:1800px;height:900px';
    document.body.append(extra);
    function touch(type: string, distance: number) {
      const event = new Event(type, { cancelable: true });
      Object.defineProperty(event, 'touches', { value: [{ clientX: 20, clientY: 20 }, { clientX: 20 + distance, clientY: 20 }] });
      window.dispatchEvent(event);
    }
    touch('touchstart', 100);
    touch('touchmove', 150);
    window.dispatchEvent(new Event('touchend'));
  });
  await expect(page.getByRole('meter', { name: 'Tool zoom level' })).toHaveText('150%');
  await expect.poll(() => frame.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  expect(await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(true);
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
  expect(await page.evaluate(() => getComputedStyle(document.body).zoom)).toBe('1');
  await expect(input).toHaveValue('Keep this input through pinch');
});

test('viewport-height document and wrapper styles do not create a resize feedback loop', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mountFixture(page);
  const frame = await toolFrame(page);
  await frame.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = 'body { min-height: 100vh; } .viewport-wrapper { min-height: 100vh; --height-100vh: 20px; max-width: var(--height-100vh); } .viewport-wrapper::after { content: \"100vh\"; }';
    document.head.append(style);
    const wrapper = document.createElement('main');
    wrapper.className = 'viewport-wrapper';
    document.body.append(wrapper);
  });
  await page.getByRole('button', { name: 'Zoom in tool', exact: true }).click();
  const height = () => page.locator('.runtime-workspace > iframe').evaluate(element => element.getBoundingClientRect().height);
  await expect.poll(height).toBeLessThan(1500);
  // More than one resize/animation frame must converge, rather than ratcheting
  // the viewport-based minimum height up on every host acknowledgement.
  const heightRange = async () => {
    const heights = await page.locator('.runtime-workspace > iframe').evaluate(async element => {
      const samples: number[] = [];
      for (let index = 0; index < 10; index++) {
        await new Promise(requestAnimationFrame);
        samples.push(element.getBoundingClientRect().height);
      }
      return samples;
    });
    return Math.max(...heights) - Math.min(...heights);
  };
  await expect.poll(heightRange).toBeLessThanOrEqual(2);
  await expect.poll(height).toBeLessThan(1500);
  expect(await frame.evaluate(() => getComputedStyle(document.querySelector('.viewport-wrapper')!, '::after').content)).toBe('"100vh"');
  expect(await frame.evaluate(() => getComputedStyle(document.querySelector('.viewport-wrapper')!).maxWidth)).toBe('20px');
  await frame.evaluate(() => { (document.querySelector('.viewport-wrapper') as HTMLElement).style.minHeight = '100dvh'; });
  await page.setViewportSize({ width: 375, height: 612 });
  await expect.poll(() => frame.evaluate(() => getComputedStyle(document.querySelector('.viewport-wrapper')!).minHeight)).toBe('612px');
  await expect.poll(() => frame.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});

test.describe('native mobile gestures', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 375, height: 812 } });

  test('mobile swipes scroll the host and pinches scale only the tool', async ({ page }) => {
    await mountFixture(page);
    const frame = await toolFrame(page);
    await frame.evaluate(() => {
      const content = document.createElement('div');
      content.style.height = '1800px';
      document.body.append(content);
    });
    await expect.poll(() => page.locator('.runtime-workspace > iframe').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(1800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const box = await page.locator('.runtime-workspace > iframe').boundingBox();
    expect(box).not.toBeNull();
    const client = await page.context().newCDPSession(page);
    const startY = Math.round(box!.y + 100);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: 180, y: startY }] });
    for (let distance = 20; distance <= 200; distance += 20) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, x: 180, y: startY - distance }] });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    expect(await frame.evaluate(() => scrollY)).toBe(0);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await client.send('Input.synthesizePinchGesture', { x: 180, y: Math.max(5, Math.round(box!.y - 60)), scaleFactor: 1.5, gestureSourceType: 'touch' });
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
    await client.send('Input.synthesizePinchGesture', { x: 180, y: startY, scaleFactor: 1.4, gestureSourceType: 'touch' });
    await expect.poll(() => frame.evaluate(() => Number(getComputedStyle(document.body).zoom))).toBeGreaterThan(1);
    await expect(page.getByRole('meter', { name: 'Tool zoom level' })).not.toHaveText('100%');
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
    await expect.poll(() => frame.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight)).toBe(true);
  });
});
