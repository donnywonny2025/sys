
import asyncio
from playwright.async_api import async_playwright
import os

async def generate_pdf():
    # Use absolute paths for dependable rendering
    base_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = f'file://{os.path.join(base_dir, "lower_street_cover_letter_template.html")}'
    output_path = os.path.join(os.path.dirname(base_dir), "Jeff_Kerr_CoverLetter_LowerStreet.pdf")
    master_output_path = os.path.join(base_dir, "Jeff_Kerr_CoverLetter_LowerStreet.pdf")

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Load the HTML
        await page.goto(html_path)
        
        # Wait for any assets (like the monogram) to load
        await page.wait_for_load_state("networkidle")

        # PDF Options: letter size
        await page.pdf(
            path=output_path,
            format="letter",
            print_background=True,
            display_header_footer=False,
            prefer_css_page_size=True
        )
        
        # Also save a copy to the master folder
        import shutil
        shutil.copy2(output_path, master_output_path)
        
        await browser.close()
        print(f"PDF successfully generated at: {output_path}")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
