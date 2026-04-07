
import asyncio
from playwright.async_api import async_playwright
import os

async def generate_pdf():
    # Hardcode absolute paths for the Handshake Handshake resume
    html_path = 'file:///Volumes/WORK 2TB/SAVE/AGENTMONEY/KNOWLEDGE_BASE/Resumes/Jeff_Kerr_Resume_Handshake_AI.html'
    output_path = '/Volumes/WORK 2TB/SAVE/AGENTMONEY/KNOWLEDGE_BASE/Resumes/Jeff_Kerr_Resume_Handshake_AI.pdf'
    master_output_path = '/Volumes/WORK 2TB/SAVE/AGENTMONEY/KNOWLEDGE_BASE/Resumes/Jeff_Kerr_Resume_Handshake_AI.pdf'

    async with async_playwright() as p:
        # We use a large enough viewport to ensure layout isn't compressed
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Load the HTML
        await page.goto(html_path)
        
        # Wait for any assets (like the monogram) to load
        await page.wait_for_load_state("networkidle")

        # PDF Options: letter size, no margins (handled in CSS), print background for the line/monogram
        await page.pdf(
            path=output_path,
            format="letter",
            print_background=True,
            display_header_footer=False,
            prefer_css_page_size=True # Honors the @page margins in CSS
        )
        
        # No need to copy to master folder for this variant
        
        await browser.close()
        print(f"PDF successfully generated at: {output_path}")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
