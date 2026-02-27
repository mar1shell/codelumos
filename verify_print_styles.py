
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Load the generated HTML file
        # Using absolute path for safety
        import os
        cwd = os.getcwd()
        await page.goto(f'file://{cwd}/report.html')

        # Screenshot in normal mode (dark mode default)
        await page.screenshot(path='report_dark.png', full_page=True)

        # Emulate print media
        await page.emulate_media(media='print')

        # Screenshot in print mode (should be light/white background)
        await page.screenshot(path='report_print.png', full_page=True)

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
