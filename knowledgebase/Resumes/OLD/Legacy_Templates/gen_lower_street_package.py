
import asyncio
from playwright.async_api import async_playwright
import os

async def generate_pdf():
    # Use absolute paths for dependable rendering
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Generate Resume
    resume_html = f'file://{os.path.join(base_dir, "lower_street_resume_template.html")}'
    resume_pdf = os.path.join(os.path.dirname(base_dir), "Jeff_Kerr_Resume_LowerStreet_Premium.pdf")
    
    # Generate Cover Letter
    cl_html = f'file://{os.path.join(base_dir, "lower_street_cover_letter_template.html")}'
    cl_pdf = os.path.join(os.path.dirname(base_dir), "Jeff_Kerr_CoverLetter_LowerStreet_Premium.pdf")

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Resume
        await page.goto(resume_html)
        await page.wait_for_load_state("networkidle")
        await page.pdf(path=resume_pdf, format="letter", print_background=True, prefer_css_page_size=True)
        
        # Cover Letter
        await page.goto(cl_html)
        await page.wait_for_load_state("networkidle")
        await page.pdf(path=cl_pdf, format="letter", print_background=True, prefer_css_page_size=True)
        
        await browser.close()
        print(f"PDFs generated:\n- {resume_pdf}\n- {cl_pdf}")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
