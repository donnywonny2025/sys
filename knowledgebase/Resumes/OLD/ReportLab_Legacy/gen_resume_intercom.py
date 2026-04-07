"""
General Video + AI Resume
Tailored for: Standard Video Editor/Producer roles that value modern AI toolsets but primarily need traditional editing firepower.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

PAGE_W, PAGE_H = letter  # 612 x 792

ORANGE = HexColor("#E8832B")
GRAY_LINE = HexColor("#DDDDDD")
NAME_CLR = HexColor("#1a1a1a")
SUB_CLR = HexColor("#666666")
CONTACT_CLR = HexColor("#555555")
LINK_CLR = HexColor("#333333")
SECTION_CLR = HexColor("#333333")
JOB_CLR = HexColor("#222222")
COMPANY_CLR = HexColor("#777777")
BODY_CLR = HexColor("#000000")
AVAIL_CLR = HexColor("#777777")

LEFT = 60.0
RIGHT = 552.0
BULLET_X = 72.0
CONTENT_W = RIGHT - LEFT
BODY_LEADING = 14.0
SKILL_LEADING = 13.0

def ytop_to_baseline(y_top, font_size):
    return PAGE_H - y_top - (font_size * 1.074)

def fitz_ascender(font_size):
    return font_size * 1.074

def draw_wrapped_at(c, text, x, y_baseline, font, size, color, max_width, leading, is_bullet=False):
    c.setFont(font, size)
    c.setFillColor(color)
    
    if is_bullet:
        if text.startswith("• "):
            text = text[2:]
        bullet_char = "•  "
        bullet_width = c.stringWidth(bullet_char, font, size)
        c.drawString(x, y_baseline, bullet_char)
        text_x = x + bullet_width
        wrap_width = max_width - bullet_width
    else:
        text_x = x
        wrap_width = max_width
        
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = f"{cur} {w}".strip()
        if c.stringWidth(test, font, size) <= wrap_width:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    
    y = y_baseline
    for line in lines:
        c.drawString(text_x, y, line)
        y -= leading
    return y

def build_resume(output_path, monogram_path):
    c = canvas.Canvas(output_path, pagesize=letter)

    # MONOGRAM
    img = ImageReader(monogram_path)
    c.drawImage(img, 54.0, PAGE_H - 73.2, width=70.9, height=39.6, mask='auto')

    # NAME
    c.setFont('Helvetica-Bold', 22)
    c.setFillColor(NAME_CLR)
    c.drawString(136.9, ytop_to_baseline(30.9, 22), "J E F F E R Y   K E R R")

    # SUBTITLE
    c.setFont('Helvetica', 10)
    c.setFillColor(SUB_CLR)
    c.drawString(136.9, ytop_to_baseline(59.6, 10), "Director / Creative Producer / Editor")

    # CONTACT LINE 1
    c.setFont('Helvetica', 8.5)
    c.setFillColor(CONTACT_CLR)
    c.drawString(LEFT, ytop_to_baseline(81.2, 8.5), "407-620-3618   •   colour8k@mac.com   •   Wayland, MI")

    # CONTACT LINE 2
    c.setFont('Helvetica-Bold', 8.5)
    c.setFillColor(LINK_CLR)
    link1 = "jefferykerr.com"
    c.drawString(LEFT, ytop_to_baseline(93.2, 8.5), link1)
    lw = c.stringWidth(link1, 'Helvetica-Bold', 8.5)
    c.setFont('Helvetica', 8.5)
    c.setFillColor(CONTACT_CLR)
    c.drawString(LEFT + lw, ytop_to_baseline(93.2, 8.5), "   •   linkedin.com/in/jefferykerrcreative") # Kept original linkedin link, as the provided snippet was syntactically incorrect here.

    # ORANGE LINE
    c.setStrokeColor(ORANGE) # Uses the updated ORANGE constant
    c.setLineWidth(1.5)
    c.line(LEFT, PAGE_H - 115.3, RIGHT, PAGE_H - 115.3)

    # SUMMARY
    c.setFont('Helvetica-Bold', 11)
    c.setFillColor(SECTION_CLR)
    summary_header_y = ytop_to_baseline(124.5, 11)
    c.drawString(LEFT, summary_header_y, "SUMMARY")

    summary = (
        "Senior Video Editor and Creative Director specializing in high-impact narrative editing and technical video production. "
        "Extensive experience building video content pipelines for enterprise B2B, technology, and government clients, translating complex concepts into compelling marketing and sales enablement assets. "
        "Proven ability to accelerate post-production workflows utilizing modern software integrations and advanced editorial techniques."
    )
    y = draw_wrapped_at(c, summary, LEFT, ytop_to_baseline(141.6, 9.5),
                        'Helvetica', 9.5, BODY_CLR, CONTENT_W, BODY_LEADING)

    # SKILLS
    gd1_y = y + BODY_LEADING - 10.2
    c.setStrokeColor(GRAY_LINE)
    c.setLineWidth(0.5)
    c.line(LEFT, gd1_y, RIGHT, gd1_y)

    skills_header_y = gd1_y - 9.2 - fitz_ascender(11)
    c.setFont('Helvetica-Bold', 11)
    c.setFillColor(SECTION_CLR)
    c.drawString(LEFT, skills_header_y, "SKILLS")

    skills = [
        ("Video & Tech Editing:", "Advanced Video Editing, Technical Editing Skills, Platform Versioning, QC/Captions"),
        ("Industry Experience:", "Enterprise B2B, SaaS Marketing Content, Marketing Automation Assets, Sales Enablement Videos"),
        ("Production & Direction:", "Technical Briefs, Budgets, Crew Management, Stakeholder Reviews"),
        ("Creative Dev:", "React, NextJS, Browser Automation, API Integration, Git"),
        ("Tools:", "Adobe Premiere Pro, After Effects, Cinema 4D, DaVinci Resolve, Frame.io, Logic Pro, VS Code"),
        ("AI:", "Veo, Sora, Kling, Flux, Integrating AI Models into Production Workflows"),
    ]

    SKILL_BETWEEN = 16.0
    skill_y = skills_header_y - 17.0 + fitz_ascender(11) - fitz_ascender(9.5)
    for label, content in skills:
        c.setFont('Helvetica-Bold', 9.5)
        c.setFillColor(BODY_CLR)
        c.drawString(LEFT, skill_y, label)
        lw = c.stringWidth(label + " ", 'Helvetica-Bold', 9.5)
        skill_y = draw_wrapped_at(c, content, LEFT + lw, skill_y, 'Helvetica', 9.5, BODY_CLR, CONTENT_W - lw, SKILL_LEADING)
        skill_y -= (SKILL_BETWEEN - SKILL_LEADING)

    # EXPERIENCE
    gd2_y = skill_y + SKILL_BETWEEN - 5.0
    c.setStrokeColor(GRAY_LINE)
    c.setLineWidth(0.5)
    c.line(LEFT, gd2_y, RIGHT, gd2_y)

    exp_header_y = gd2_y - 9.2 - fitz_ascender(11)
    c.setFont('Helvetica-Bold', 11)
    c.setFillColor(SECTION_CLR)
    c.drawString(LEFT, exp_header_y, "EXPERIENCE")

    # JOB 1
    j1_title_y = exp_header_y - 17.1 + fitz_ascender(11) - fitz_ascender(10.5)
    c.setFont('Helvetica-Bold', 10.5)
    c.setFillColor(JOB_CLR)
    c.drawString(LEFT, j1_title_y, "Owner / Creative Director")

    j1_company_y = j1_title_y - 15.1 + fitz_ascender(10.5) - fitz_ascender(9)
    c.setFont('Helvetica-Oblique', 9)
    c.setFillColor(COMPANY_CLR)
    c.drawString(LEFT, j1_company_y, "The Kerr Media Group  |  Apr 2014 - Present  |  Orlando, FL")

    j1_bullets = [
        "Produce and direct video campaigns including launch pieces, explainers, and large event packages, utilizing advanced video editing and motion graphics to drive user engagement and support brand messaging",
        "Lead end-to-end creative execution for high-profile clients like Disney, Boeing, and Raytheon, consistently delivering broadcast-quality edits ahead of rigorous compliance deadlines",
        "Architect custom API pipelines and workflow automation tools, significantly accelerating video delivery times and reducing manual post-production bottlenecks",
        "Design and deploy custom web applications utilizing modern scripting frameworks, improving content distribution and technical infrastructure capabilities",
    ]
    by = j1_company_y - 14.363
    for b in j1_bullets:
        by = draw_wrapped_at(c, f"• {b}", BULLET_X, by, 'Helvetica', 9.5, BODY_CLR, CONTENT_W - 12, BODY_LEADING, is_bullet=True)

    # JOB 2
    j2_title_y = by - 5.3
    c.setFont('Helvetica-Bold', 10.5)
    c.setFillColor(JOB_CLR)
    c.drawString(LEFT, j2_title_y, "Associate Producer")
    j2_company_y = j2_title_y - 16.711
    c.setFont('Helvetica-Oblique', 9)
    c.setFillColor(COMPANY_CLR)
    c.drawString(LEFT, j2_company_y, "Signal Group DC  |  Feb 2015 - Jan 2025  |  Washington, DC")
    j2_bullets = [
        "Managed projects from intake to delivery: brief, script/interviews, production, edit/finish, and distribution",
        "Tightened review cadence and refreshed creative standards for steadier delivery and healthier engagement",
        "Coordinated creative, vendors, and compliance/legal to reduce last-minute fire drills",
    ]
    by = j2_company_y - 14.363
    for b in j2_bullets:
        by = draw_wrapped_at(c, f"• {b}", BULLET_X, by, 'Helvetica', 9.5, BODY_CLR, CONTENT_W - 12, BODY_LEADING, is_bullet=True)

    # JOB 3
    j3_title_y = by - 5.3
    c.setFont('Helvetica-Bold', 10.5)
    c.setFillColor(JOB_CLR)
    c.drawString(LEFT, j3_title_y, "Freelance Director, Motion Designer, Editor")
    j3_company_y = j3_title_y - 16.711
    c.setFont('Helvetica-Oblique', 9)
    c.setFillColor(COMPANY_CLR)
    c.drawString(LEFT, j3_company_y, "AVmedia, Inc.  |  Jan 2010 - Sep 2015  |  Orlando, FL")
    j3_bullets = [
        "Produced live corporate events and screen content for shows nationwide",
        "Improved playback reliability and cue timing with cleaner run-of-show docs",
    ]
    by = j3_company_y - 14.363
    for b in j3_bullets:
        by = draw_wrapped_at(c, f"• {b}", BULLET_X, by, 'Helvetica', 9.5, BODY_CLR, CONTENT_W - 12, BODY_LEADING, is_bullet=True)

    # JOB 4
    j4_title_y = by - 5.3
    c.setFont('Helvetica-Bold', 10.5)
    c.setFillColor(JOB_CLR)
    c.drawString(LEFT, j4_title_y, "Freelance Motion Designer/Editor")
    j4_company_y = j4_title_y - 16.711
    c.setFont('Helvetica-Oblique', 9)
    c.setFillColor(COMPANY_CLR)
    c.drawString(LEFT, j4_company_y, "Chatham Light Media  |  Jul 2012 - Nov 2014  |  Alexandria, VA")
    j4_bullets = [
        "Produced political spots on rapid, compliance-heavy timelines; delivered broadcast and social cutdowns",
    ]
    by = j4_company_y - 14.363
    for b in j4_bullets:
        by = draw_wrapped_at(c, f"• {b}", BULLET_X, by, 'Helvetica', 9.5, BODY_CLR, CONTENT_W - 12, BODY_LEADING, is_bullet=True)

    # EARLIER ROLES
    j5_title_y = by - 5.3
    c.setFont('Helvetica-Bold', 10.5)
    c.setFillColor(JOB_CLR)
    c.drawString(LEFT, j5_title_y, "Earlier Roles")
    
    j5_company_y = j5_title_y - 16.711
    c.setFont('Helvetica-Oblique', 9)
    c.setFillColor(COMPANY_CLR)
    c.drawString(LEFT, j5_company_y, "Digital Brew  •  VScreen  •  ShineCreative  •  Two Door Productions  •  MG Visual Studios")

    earlier_bullets = [
        "Super Bowl creative (Century 21), 2008 presidential campaign post/edit",
    ]
    by = j5_company_y - 14.363
    for b in earlier_bullets:
        by = draw_wrapped_at(c, f"• {b}", BULLET_X, by, 'Helvetica', 9.5, BODY_CLR, CONTENT_W - 12, BODY_LEADING, is_bullet=True)

    # EDUCATION
    gd3_y = by + BODY_LEADING - 10.2
    c.setStrokeColor(GRAY_LINE)
    c.setLineWidth(0.5)
    c.line(LEFT, gd3_y, RIGHT, gd3_y)

    edu_header_y = gd3_y - 9.2 - fitz_ascender(11)
    c.setFont('Helvetica-Bold', 11)
    c.setFillColor(SECTION_CLR)
    c.drawString(LEFT, edu_header_y, "EDUCATION")

    edu_y = edu_header_y - 16 + fitz_ascender(11) - fitz_ascender(9.5)
    c.setFont('Helvetica-Bold', 9.5)
    c.setFillColor(BODY_CLR)
    c.drawString(LEFT, edu_y, "Full Sail University")
    ew = c.stringWidth("Full Sail University", 'Helvetica-Bold', 9.5)
    c.setFont('Helvetica', 9.5)
    c.drawString(LEFT + ew, edu_y, "  |  A.S., Film/Production")

    # FOOTER LINKS
    avail_y = edu_y - 20.0
    avail = "Operating modes: on-site, hybrid, or remote | Availability: staff roles or long-term engagements"
    c.setFont('Helvetica', 8)
    c.setFillColor(AVAIL_CLR)
    aw = c.stringWidth(avail, 'Helvetica', 8)
    c.drawString((PAGE_W - aw) / 2, avail_y, avail)

    c.save()
    print(f"PDF saved: {output_path}")

MONOGRAM = '/Volumes/WORK 2TB/SAVE/AGENTMONEY/_archive/monogram_iterations/JKMONO.png'
# 1. Output Path
OUTPUT = "/Volumes/WORK 2TB/SAVE/AGENTMONEY/KNOWLEDGE_BASE/Resumes/Jeff_Kerr_Resume_Intercom.pdf"

import os
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
build_resume(OUTPUT, MONOGRAM)
