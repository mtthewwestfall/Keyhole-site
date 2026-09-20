import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto("http://localhost:8080")
        await page.wait_for_timeout(1000)

        # Open Display Control Center
        await page.click("#gemini-studio-btn")
        await page.wait_for_timeout(1000)

        # Screenshot Display Control Center
        await page.screenshot(path="/home/jules/verification/display_control_center.png")
        print("Screenshot saved to /home/jules/verification/display_control_center.png")

        await browser.close()

asyncio.run(main())
