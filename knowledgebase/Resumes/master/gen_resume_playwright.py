
import asyncio
from playwright.async_api import async_playwright
import os

async def generate_pdf():
    # Use absolute paths for dependable rendering
    base_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = f'file://{os.path.join(base_dir, "resume_template.html")}'
    output_path = os.path.join(os.path.dirname(base_dir), "Jeff_Kerr_Resume_General.pdf")
    master_output_path = os.path.join(base_dir, "Jeff_Kerr_Resume_General.pdf")

    async with async_playwright() as p:
        # We use a large enough viewport to ensure layout isn't compressed, and 2x scale for crisp fonts
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={'width': 1200, 'height': 1600},
            device_scale_factor=2
        )
        page = await context.new_page()
        
        # Load the HTML
        await page.goto(html_path)
        
        # Wait for fonts and high-res assets (monogram)
        await page.wait_for_timeout(500)

        # PDF Options: letter size, no margins (handled in CSS), print background for the line/monogram
        await page.pdf(
            path=output_path,
            format="letter",
            print_background=True,
            display_header_footer=False,
            prefer_css_page_size=True # Honors the @page margins in CSS
        )
        
        # Also save a copy to the master folder
        import shutil
        shutil.copy2(output_path, master_output_path)
        
        await browser.close()
        print(f"PDF successfully generated at: {output_path}")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
