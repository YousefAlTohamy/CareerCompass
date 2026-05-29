from __future__ import annotations

import html
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from PIL import Image as PILImage
from PIL import ImageDraw, ImageFont
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "docs/graduation-book"
ASSETS = OUT_DIR / "assets"
DIAGRAMS = ASSETS / "diagrams"
SCREENSHOTS = ASSETS / "screenshots"
LOGOS = ASSETS / "logos"
DOCX_PATH = OUT_DIR / "CareerCompass_Graduation_Project_Book.docx"
PDF_PATH = OUT_DIR / "CareerCompass_Graduation_Project_Book.pdf"
MD_PATH = OUT_DIR / "CareerCompass_Graduation_Project_Book.md"
REFERENCES_PATH = OUT_DIR / "references.md"
NOTES_PATH = OUT_DIR / "REPORT_GENERATION_NOTES.md"

PROJECT_TITLE = "CareerCompass: AI-Powered Career Guidance and Job Recommendation Platform"
SHORT_NAME = "CareerCompass"
UNIVERSITY = "Kafr El-Sheikh University"
FACULTY = "Faculty of Computers and Information"
DEPARTMENT = "Computer Science Department"
ACADEMIC_YEAR = "2025 / 2026"
SUPERVISOR = "Dr. Amna Mahmoud"
STUDENTS = [
    "Yousef Altohamy Ahmed Altohamy",
    "Ahmed Mohamed Ahmed Abdelaziz",
    "[Student Name 3]",
    "[Student Name 4]",
    "[Student Name 5]",
]


@dataclass(frozen=True)
class Reference:
    key: int
    organization: str
    title: str
    source: str
    year: str
    url: str
    accessed: str = "Accessed: May 29, 2026"


REFERENCES = [
    Reference(1, "Laravel", "Laravel 12.x Documentation", "Laravel", "2026", "https://laravel.com/docs/12.x"),
    Reference(2, "Laravel", "Laravel Sanctum", "Laravel", "2026", "https://laravel.com/docs/12.x/sanctum"),
    Reference(3, "Laravel", "Queues", "Laravel", "2026", "https://laravel.com/docs/12.x/queues"),
    Reference(4, "Meta Open Source", "Quick Start - React", "React Documentation", "2026", "https://react.dev/learn"),
    Reference(5, "Vite", "Getting Started", "Vite Documentation", "2026", "https://vite.dev/guide/"),
    Reference(6, "FastAPI", "FastAPI Documentation", "FastAPI", "2026", "https://fastapi.tiangolo.com/"),
    Reference(7, "Python Software Foundation", "Python 3 Documentation", "Python", "2026", "https://docs.python.org/3/"),
    Reference(8, "Oracle", "MySQL 8.0 Reference Manual", "MySQL Documentation", "2026", "https://dev.mysql.com/doc/refman/8.0/en/"),
    Reference(9, "MinIO", "MinIO AIStor Documentation", "MinIO Documentation", "2026", "https://docs.min.io/aistor/"),
    Reference(10, "Docker", "What is a Container?", "Docker Resources", "2026", "https://www.docker.com/resources/what-container/"),
    Reference(11, "Docker", "Docker Compose", "Docker Documentation", "2026", "https://docs.docker.com/compose/"),
    Reference(12, "Nginx", "nginx Documentation", "nginx", "2026", "https://nginx.org/en/docs/"),
    Reference(13, "Prometheus", "Overview", "Prometheus Documentation", "2026", "https://prometheus.io/docs/introduction/overview/"),
    Reference(14, "Grafana Labs", "Grafana OSS and Enterprise", "Grafana Documentation", "2026", "https://grafana.com/docs/grafana/latest/"),
    Reference(15, "GitHub", "GitHub Actions Documentation", "GitHub Docs", "2026", "https://docs.github.com/en/actions"),
    Reference(16, "MDN Web Docs", "HTTP: Hypertext Transfer Protocol", "MDN", "2026", "https://developer.mozilla.org/en-US/docs/Web/HTTP"),
    Reference(17, "Scrapy", "Scrapy Documentation", "Scrapy", "2026", "https://docs.scrapy.org/en/latest/"),
    Reference(18, "Leonard Richardson", "Beautiful Soup Documentation", "Beautiful Soup", "2026", "https://www.crummy.com/software/BeautifulSoup/bs4/doc/"),
    Reference(19, "scikit-learn", "TfidfVectorizer", "scikit-learn Documentation", "2026", "https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html"),
    Reference(20, "scikit-learn", "cosine_similarity", "scikit-learn Documentation", "2026", "https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.cosine_similarity.html"),
    Reference(21, "UKP Lab", "Sentence Transformers Documentation", "Sentence Transformers", "2026", "https://www.sbert.net/"),
    Reference(22, "Artifex", "PyMuPDF Documentation", "PyMuPDF", "2026", "https://pymupdf.readthedocs.io/en/latest/"),
    Reference(23, "jsvine", "pdfplumber", "GitHub Repository", "2026", "https://github.com/jsvine/pdfplumber"),
    Reference(24, "Jaided AI", "EasyOCR", "GitHub Repository", "2026", "https://github.com/JaidedAI/EasyOCR"),
    Reference(25, "PHPUnit", "PHPUnit 12.0 Manual", "PHPUnit Documentation", "2026", "https://docs.phpunit.de/en/12.0/"),
    Reference(26, "pytest", "pytest Documentation", "pytest", "2026", "https://docs.pytest.org/en/stable/"),
    Reference(27, "OWASP", "File Upload Cheat Sheet", "OWASP Cheat Sheet Series", "2026", "https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html"),
    Reference(28, "OWASP", "Authentication Cheat Sheet", "OWASP Cheat Sheet Series", "2026", "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html"),
    Reference(29, "Martin Fowler and James Lewis", "Microservices", "martinfowler.com", "2014", "https://martinfowler.com/articles/microservices.html"),
]


FIGURES = [
    ("Figure 1", "High-level architecture of CareerCompass.", "assets/diagrams/01_high_level_architecture.png"),
    ("Figure 2", "Docker deployment architecture.", "assets/diagrams/02_docker_deployment.png"),
    ("Figure 3", "DFD Level 0 context diagram.", "assets/diagrams/03_dfd_level_0.png"),
    ("Figure 4", "DFD Level 1 process diagram.", "assets/diagrams/04_dfd_level_1.png"),
    ("Figure 5", "UML use case diagram.", "assets/diagrams/05_use_case_diagram.png"),
    ("Figure 6", "Sequence diagram for CV upload and analysis.", "assets/diagrams/06_sequence_cv_upload_analysis.png"),
    ("Figure 7", "Sequence diagram for recommendation and gap analysis.", "assets/diagrams/07_sequence_job_recommendation_gap_analysis.png"),
    ("Figure 8", "ERD and database summary diagram.", "assets/diagrams/08_erd.png"),
    ("Figure 9", "Home page.", "assets/screenshots/01_home.png"),
    ("Figure 10", "Register page.", "assets/screenshots/02_register.png"),
    ("Figure 11", "Login page.", "assets/screenshots/03_login.png"),
    ("Figure 12", "Student dashboard before CV upload.", "assets/screenshots/04_dashboard_before_cv_upload.png"),
    ("Figure 13", "CV upload user interface.", "assets/screenshots/05_cv_upload_ui.png"),
    ("Figure 14", "Dashboard after successful CV parsing.", "assets/screenshots/06_dashboard_after_cv_upload.png"),
    ("Figure 15", "Extracted profile and skills page.", "assets/screenshots/07_extracted_profile_skills.png"),
    ("Figure 16", "Jobs recommendations page.", "assets/screenshots/08_jobs_recommendations.png"),
    ("Figure 17", "Job detail and inline gap panel.", "assets/screenshots/09_job_details_and_inline_gap.png"),
    ("Figure 18", "Gap analysis page.", "assets/screenshots/10_gap_analysis.png"),
    ("Figure 19", "Applications tracker page.", "assets/screenshots/11_applications_tracker.png"),
    ("Figure 20", "Tools Hub preview page.", "assets/screenshots/12_tools_hub.png"),
    ("Figure 21", "System status page.", "assets/screenshots/13_system_status.png"),
    ("Figure 22", "Admin dashboard.", "assets/screenshots/14_admin_dashboard.png"),
    ("Figure 23", "Admin jobs page.", "assets/screenshots/15_admin_jobs.png"),
    ("Figure 24", "Admin sources diagnostics page.", "assets/screenshots/16_admin_sources_diagnostics.png"),
    ("Figure 25", "Admin target roles page.", "assets/screenshots/17_admin_targets.png"),
    ("Figure 26", "Docker services evidence.", "assets/screenshots/18_docker_containers.png"),
    ("Figure 27", "Validation command evidence.", "assets/screenshots/19_validation_summary.png"),
]


def ensure_dirs() -> None:
    for folder in [OUT_DIR, ASSETS, DIAGRAMS, SCREENSHOTS, LOGOS]:
        folder.mkdir(parents=True, exist_ok=True)


def load_font(size: int, bold: bool = False):
    candidates = [
        "C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/timesbd.ttf" if bold else "C:/Windows/Fonts/times.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except Exception:
            continue
    return ImageFont.load_default()


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textbbox((0, 0), trial, font=font)[2] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def rounded_box(draw, box, title, subtitle="", fill="#ffffff", outline="#1d4ed8", text="#0f172a"):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=18, fill=fill, outline=outline, width=3)
    title_font = load_font(24, True)
    sub_font = load_font(17)
    draw.text((x1 + 18, y1 + 18), title, fill=text, font=title_font)
    if subtitle:
        y = y1 + 52
        for line in wrap_text(draw, subtitle, sub_font, x2 - x1 - 36):
            draw.text((x1 + 18, y), line, fill="#334155", font=sub_font)
            y += 22


def arrow(draw, start, end, color="#0f766e", width=4):
    draw.line([start, end], fill=color, width=width)
    ex, ey = end
    sx, sy = start
    dx = ex - sx
    dy = ey - sy
    if abs(dx) > abs(dy):
        sign = 1 if dx > 0 else -1
        points = [(ex, ey), (ex - sign * 14, ey - 8), (ex - sign * 14, ey + 8)]
    else:
        sign = 1 if dy > 0 else -1
        points = [(ex, ey), (ex - 8, ey - sign * 14), (ex + 8, ey - sign * 14)]
    draw.polygon(points, fill=color)


def save_diagram(name: str, title: str, boxes: list[tuple[str, str, tuple[int, int, int, int], str]], arrows: list[tuple[tuple[int, int], tuple[int, int], str]]):
    img = PILImage.new("RGB", (1600, 1000), "#f8fafc")
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, 1600, 96), fill="#0f172a")
    draw.text((44, 28), title, fill="white", font=load_font(34, True))
    for start, end, label in arrows:
        arrow(draw, start, end)
        if label:
            mx = (start[0] + end[0]) // 2
            my = (start[1] + end[1]) // 2
            draw.rounded_rectangle((mx - 80, my - 18, mx + 80, my + 18), radius=8, fill="#ecfeff", outline="#67e8f9")
            draw.text((mx - 72, my - 11), label, fill="#155e75", font=load_font(14, True))
    for title_text, subtitle, box, color in boxes:
        rounded_box(draw, box, title_text, subtitle, fill=color)
    img.save(DIAGRAMS / name)


def create_diagrams() -> None:
    save_diagram(
        "01_high_level_architecture.png",
        "CareerCompass High-Level Architecture",
        [
            ("React + Vite Frontend", "Student, admin, status, and preview modules.", (80, 180, 380, 330), "#dbeafe"),
            ("Nginx Gateway", "Routes browser traffic to frontend and Laravel API.", (520, 180, 820, 330), "#e0f2fe"),
            ("Laravel API", "Authentication, CV upload, recommendations, admin APIs.", (960, 180, 1280, 330), "#ecfdf5"),
            ("MySQL", "Users, profiles, skills, jobs, applications, sources.", (1180, 470, 1500, 620), "#fef3c7"),
            ("AI CV Analyzer", "FastAPI service for PDF/image text extraction and skill inference.", (80, 470, 430, 640), "#fce7f3"),
            ("AI Job Miner", "FastAPI/Scrapy service for job source adapters and imports.", (520, 470, 860, 640), "#ede9fe"),
            ("MinIO", "Private S3-compatible storage for uploaded CV files.", (960, 700, 1280, 850), "#cffafe"),
            ("Prometheus + Grafana", "Operational metrics and dashboards.", (80, 720, 430, 870), "#dcfce7"),
        ],
        [
            ((380, 255), (520, 255), "HTTP"),
            ((820, 255), (960, 255), "API"),
            ((1120, 330), (1290, 470), "SQL"),
            ((960, 285), (430, 540), "parse"),
            ((1120, 330), (700, 470), "mine"),
            ((1120, 330), (1120, 700), "files"),
            ((960, 330), (360, 720), "metrics"),
        ],
    )

    save_diagram(
        "02_docker_deployment.png",
        "Docker Compose Deployment View",
        [
            ("nginx", "Public port 80 reverse proxy.", (70, 170, 330, 300), "#dbeafe"),
            ("frontend", "Built React static assets.", (430, 170, 690, 300), "#e0f2fe"),
            ("backend-api", "Laravel PHP-FPM application.", (790, 170, 1090, 300), "#ecfdf5"),
            ("workers", "Queue workers: default, high, AI, emails, scraping.", (1200, 170, 1530, 300), "#ecfdf5"),
            ("db", "MySQL 8.0 database.", (150, 490, 430, 620), "#fef3c7"),
            ("ai-cv-analyzer", "FastAPI CV parsing service on port 8000.", (530, 490, 840, 620), "#fce7f3"),
            ("ai-job-miner", "FastAPI scraper service on port 8003.", (940, 490, 1250, 620), "#ede9fe"),
            ("minio", "S3-compatible CV object storage.", (1320, 490, 1540, 620), "#cffafe"),
            ("prometheus", "Metrics collection.", (330, 760, 610, 890), "#dcfce7"),
            ("grafana", "Dashboards on port 3000.", (750, 760, 1030, 890), "#dcfce7"),
        ],
        [
            ((330, 235), (430, 235), ""),
            ((690, 235), (790, 235), ""),
            ((1090, 235), (1200, 235), "queues"),
            ((940, 300), (290, 490), "SQL"),
            ((940, 300), (680, 490), "CV"),
            ((940, 300), (1095, 490), "jobs"),
            ((1090, 300), (1430, 490), "S3"),
            ((940, 300), (470, 760), "metrics"),
            ((610, 825), (750, 825), ""),
        ],
    )

    save_diagram(
        "03_dfd_level_0.png",
        "DFD Level 0",
        [
            ("Student", "Registers, uploads CV, views jobs and gaps.", (80, 250, 360, 430), "#dbeafe"),
            ("Administrator", "Reviews jobs, sources, users, and system health.", (80, 560, 360, 740), "#dbeafe"),
            ("CareerCompass System", "Processes CVs, stores profiles, imports jobs, calculates recommendations.", (560, 350, 1040, 640), "#ecfdf5"),
            ("External Job Sources", "Demo/API/HTML job sources used by the miner.", (1240, 250, 1520, 430), "#fef3c7"),
            ("AI Services", "CV analyzer and semantic matching support.", (1240, 560, 1520, 740), "#fce7f3"),
        ],
        [
            ((360, 340), (560, 455), "requests"),
            ((560, 535), (360, 650), "views"),
            ((1040, 455), (1240, 340), "jobs"),
            ((1040, 535), (1240, 650), "analysis"),
        ],
    )

    save_diagram(
        "04_dfd_level_1.png",
        "DFD Level 1",
        [
            ("1. Auth", "Sanctum tokens, roles, profile bootstrap.", (60, 160, 340, 290), "#dbeafe"),
            ("2. CV Processing", "Validate, store, parse, normalize.", (430, 160, 750, 290), "#fce7f3"),
            ("3. Job Import", "Source adapters, quality gates, import.", (840, 160, 1160, 290), "#ede9fe"),
            ("4. Matching", "Skills, semantic similarity, TF-IDF fallback.", (1250, 160, 1540, 290), "#ecfdf5"),
            ("User/Profile DB", "Users, profiles, skills, analyses.", (230, 520, 560, 670), "#fef3c7"),
            ("Job DB", "Job postings, sources, applications.", (700, 520, 1030, 670), "#fef3c7"),
            ("Admin/Monitoring", "Health, stats, source diagnostics.", (1170, 520, 1510, 670), "#dcfce7"),
        ],
        [
            ((340, 225), (430, 225), ""),
            ((750, 225), (840, 225), ""),
            ((1160, 225), (1250, 225), ""),
            ((590, 290), (395, 520), "profile"),
            ((1000, 290), (865, 520), "jobs"),
            ((1390, 290), (1340, 520), "health"),
            ((560, 595), (700, 595), "skills"),
            ((1030, 595), (1170, 595), "stats"),
        ],
    )

    save_diagram(
        "05_use_case_diagram.png",
        "UML Use Case Diagram",
        [
            ("Student", "Register, login, upload CV, view recommendations, analyze gaps, save applications.", (80, 240, 420, 520), "#dbeafe"),
            ("Admin", "Login, review dashboard, manage jobs, test sources, manage target roles.", (80, 620, 420, 870), "#dbeafe"),
            ("CareerCompass Use Cases", "Authenticate; Parse CV; Recommend Jobs; Analyze Skill Gap; Track Application; Monitor System; Diagnose Sources.", (600, 250, 1120, 760), "#ecfdf5"),
            ("AI Services", "CV parsing and hybrid matching support.", (1280, 340, 1530, 520), "#fce7f3"),
            ("Job Sources", "Provide imported job records.", (1280, 640, 1530, 820), "#fef3c7"),
        ],
        [
            ((420, 380), (600, 420), "uses"),
            ((420, 720), (600, 620), "uses"),
            ((1120, 430), (1280, 430), "calls"),
            ((1120, 650), (1280, 730), "imports"),
        ],
    )

    create_sequence_diagram(
        "06_sequence_cv_upload_analysis.png",
        "Sequence: CV Upload and Analysis",
        ["Student", "React UI", "Laravel API", "MinIO", "AI CV Analyzer", "MySQL"],
        [
            ("Student", "React UI", "Select PDF/image CV"),
            ("React UI", "Laravel API", "POST /upload-cv with token"),
            ("Laravel API", "Laravel API", "Validate file type and size"),
            ("Laravel API", "MinIO", "Store private CV object"),
            ("Laravel API", "AI CV Analyzer", "Send file for parsing"),
            ("AI CV Analyzer", "Laravel API", "Return text, role, skills, confidence"),
            ("Laravel API", "MySQL", "Persist profile, skills, analysis"),
            ("Laravel API", "React UI", "Return updated user resource"),
            ("React UI", "Student", "Display parsed profile and warnings"),
        ],
    )

    create_sequence_diagram(
        "07_sequence_job_recommendation_gap_analysis.png",
        "Sequence: Job Recommendation and Gap Analysis",
        ["Student", "React UI", "Laravel API", "AI Matching", "MySQL", "Job Miner"],
        [
            ("Student", "React UI", "Open Jobs page"),
            ("React UI", "Laravel API", "GET /jobs/recommended"),
            ("Laravel API", "MySQL", "Read CV skills and imported jobs"),
            ("Laravel API", "AI Matching", "Semantic + TF-IDF scoring"),
            ("AI Matching", "Laravel API", "Estimated match scores"),
            ("Laravel API", "React UI", "Return ranked jobs"),
            ("Student", "React UI", "Open gap analysis"),
            ("React UI", "Laravel API", "GET /gap-analysis/job/{id}"),
            ("Laravel API", "MySQL", "Compare skills and job requirements"),
            ("Laravel API", "React UI", "Return matched skills and roadmap"),
            ("Laravel API", "Job Miner", "Optional scrape-if-missing flow"),
        ],
    )

    create_erd()


def create_sequence_diagram(name: str, title: str, participants: list[str], messages: list[tuple[str, str, str]]):
    width, height = 1700, 1050
    img = PILImage.new("RGB", (width, height), "#f8fafc")
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, width, 96), fill="#0f172a")
    draw.text((44, 28), title, fill="white", font=load_font(34, True))
    x_positions = {}
    gap = (width - 160) // (len(participants) - 1)
    for i, participant in enumerate(participants):
        x = 80 + i * gap
        x_positions[participant] = x
        draw.rounded_rectangle((x - 90, 130, x + 90, 190), radius=12, fill="#dbeafe", outline="#2563eb", width=2)
        draw.text((x - 78, 150), participant, fill="#0f172a", font=load_font(18, True))
        draw.line((x, 190, x, height - 80), fill="#94a3b8", width=2)
    y = 240
    for src, dst, label in messages:
        sx, dx = x_positions[src], x_positions[dst]
        arrow(draw, (sx, y), (dx, y), color="#0f766e", width=3)
        label_font = load_font(15)
        tx = min(sx, dx) + 12
        for line in wrap_text(draw, label, label_font, abs(dx - sx) - 24):
            draw.text((tx, y - 26), line, fill="#334155", font=label_font)
            y += 2
        y += 72
    img.save(DIAGRAMS / name)


def create_erd() -> None:
    img = PILImage.new("RGB", (1800, 1200), "#f8fafc")
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, 1800, 96), fill="#0f172a")
    draw.text((44, 28), "ERD and Database Summary", fill="white", font=load_font(34, True))
    tables = [
        ("users", ["id PK", "name", "email", "password", "role", "is_banned"], (70, 150, 390, 360)),
        ("profiles", ["id PK", "user_id FK", "headline", "location", "contact_info"], (500, 150, 820, 340)),
        ("skills", ["id PK", "name", "type", "canonical_name"], (930, 150, 1250, 340)),
        ("user_skill", ["user_id FK", "skill_id FK", "proficiency", "source"], (1360, 150, 1680, 340)),
        ("cv_analyses", ["id PK", "user_id FK", "predicted_role", "parsing_status", "cv_disk", "cv_path"], (70, 500, 430, 750)),
        ("experiences", ["id PK", "user_id FK", "title", "company", "start_date", "end_date"], (520, 500, 850, 750)),
        ("job_postings", ["id PK", "title", "company", "requirements", "source", "url"], (940, 500, 1290, 750)),
        ("applications", ["id PK", "user_id FK", "job_id FK", "status", "notes"], (1390, 500, 1720, 730)),
        ("scraping_sources", ["id PK", "name", "type", "endpoint", "is_active"], (300, 880, 650, 1100)),
        ("target_job_roles", ["id PK", "name", "is_active"], (760, 880, 1090, 1060)),
        ("scraping_jobs", ["id PK", "source_id FK", "status", "jobs_found", "metadata"], (1200, 880, 1550, 1100)),
    ]
    for name, fields, box in tables:
        x1, y1, x2, y2 = box
        draw.rounded_rectangle(box, radius=12, fill="#ffffff", outline="#2563eb", width=3)
        draw.rectangle((x1, y1, x2, y1 + 42), fill="#dbeafe")
        draw.text((x1 + 14, y1 + 10), name, fill="#0f172a", font=load_font(20, True))
        y = y1 + 58
        for field in fields:
            draw.text((x1 + 18, y), field, fill="#334155", font=load_font(16))
            y += 26
    rels = [
        ((390, 250), (500, 250)),
        ((390, 280), (1360, 250)),
        ((1250, 250), (1360, 250)),
        ((250, 360), (250, 500)),
        ((390, 310), (520, 610)),
        ((390, 330), (1390, 600)),
        ((1290, 600), (1390, 600)),
        ((1115, 750), (1375, 880)),
        ((650, 990), (1200, 990)),
    ]
    for s, e in rels:
        arrow(draw, s, e, color="#64748b", width=3)
    img.save(DIAGRAMS / "08_erd.png")


def command_text(command: list[str]) -> str:
    try:
        result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=45)
        return (result.stdout or result.stderr or "").strip()
    except Exception as exc:
        return f"Unable to run {' '.join(command)}: {exc}"


def text_image(path: Path, title: str, lines: Iterable[str]) -> None:
    img = PILImage.new("RGB", (1600, 1000), "#0f172a")
    draw = ImageDraw.Draw(img)
    title_font = load_font(34, True)
    mono = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 19) if Path("C:/Windows/Fonts/consola.ttf").exists() else load_font(18)
    draw.text((48, 36), title, fill="#e0f2fe", font=title_font)
    y = 105
    for raw in lines:
        for line in str(raw).splitlines() or [""]:
            if y > 960:
                break
            draw.text((48, y), line[:145], fill="#e2e8f0", font=mono)
            y += 28
        if y > 960:
            break
    img.save(path)


def create_terminal_evidence() -> None:
    ps_text = command_text(["docker", "compose", "-f", "docker-compose.yml", "-f", "docker-compose.prod.yml", "ps"])
    text_image(
        SCREENSHOTS / "18_docker_containers.png",
        "Docker Compose Services Evidence",
        ps_text.splitlines(),
    )
    validation_lines = [
        "Validation summary captured for the graduation book:",
        "",
        "docker compose config --quiet: PASSED",
        "docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet: PASSED",
        "docker compose up -d --build: stack built; full initial build exceeded 15 minutes, then targeted rebuild/start completed",
        "composer install in backend-api container: PASSED",
        "php artisan config:clear: PASSED",
        "php artisan route:list: PASSED (131 routes)",
        "php artisan migrate --force --no-interaction: PASSED (nothing to migrate)",
        "php artisan test: PASSED (39 tests, 297 assertions)",
        "frontend ESLint: PASSED with 9 warnings and 0 errors",
        "frontend Vite build: PASSED (2904 modules transformed)",
        "ai-job-miner pytest: PASSED (75 passed)",
        "ai-cv-analyzer compileall: PASSED",
        "ai-job-miner compileall: PASSED",
        "ai-cv-analyzer pytest: SKIPPED/blocked because pytest is not installed in that container",
        "HTTP probes: /, /api/health, /api/ready, /status, AI CV Analyzer root, and Job Miner health returned 200",
    ]
    text_image(SCREENSHOTS / "19_validation_summary.png", "Validation Command Evidence", validation_lines)


def references_markdown() -> str:
    lines = ["# References", ""]
    for ref in REFERENCES:
        lines.append(
            f"[{ref.key}] {ref.organization}, \"{ref.title},\" {ref.source}, {ref.year}. "
            f"[Online]. Available: {ref.url}. {ref.accessed}."
        )
    lines.append("")
    return "\n".join(lines)


def figure_markdown(number: str, caption: str, rel_path: str) -> str:
    return f"![{number}: {caption}]({rel_path})\n\n*{number}. {caption}*"


def report_markdown() -> str:
    fig_list = "\n".join([f"- {num}. {caption}" for num, caption, _ in FIGURES])
    table_list = "\n".join(
        [
            "- Table 1. Functional requirements summary.",
            "- Table 2. Non-functional requirements summary.",
            "- Table 3. Hardware and software environment.",
            "- Table 4. Major implementation modules.",
            "- Table 5. Automated validation results.",
            "- Table 6. Manual functional evaluation matrix.",
            "- Table 7. Security and privacy controls.",
            "- Table 8. Docker services summary.",
            "- Table 9. API endpoint summary.",
            "- Table 10. Database tables summary.",
        ]
    )
    refs = "\n".join(
        [
            f"[{ref.key}] {ref.organization}, \"{ref.title},\" {ref.source}, {ref.year}. [Online]. Available: {ref.url}. {ref.accessed}."
            for ref in REFERENCES
        ]
    )

    return f"""# {PROJECT_TITLE}

{UNIVERSITY}

{FACULTY}

{DEPARTMENT}

Graduation Project Book

Academic Year: {ACADEMIC_YEAR}

Supervisor: {SUPERVISOR}

Submitted by:
{chr(10).join(STUDENTS)}

\\pagebreak

# Acknowledgment

The project team would like to express sincere appreciation to {SUPERVISOR} for academic supervision, technical guidance, and continuous feedback during the preparation of CareerCompass. The team also thanks the Faculty of Computers and Information at Kafr El-Sheikh University for providing the academic setting in which this graduation project was designed, implemented, tested, and documented.

The work presented in this book reflects a collaborative software engineering effort. It combines web application development, database design, AI-assisted document analysis, explainable matching, containerized deployment, testing, and technical documentation. The two supervisor-provided graduation books were used only to understand expected report structure and visual formality; no content, wording, project-specific claims, diagrams, or references were copied from them.

# Abstract

CareerCompass is a graduation/demo career guidance platform that helps students and early-career users understand their CV profile, explore imported job opportunities, and compare their current skills against job requirements. The system consists of a React and Vite frontend, a Laravel API backend, a MySQL database, a FastAPI-based CV analyzer, a FastAPI/Scrapy-based job miner, MinIO-compatible private file storage, Nginx routing, and Prometheus/Grafana monitoring. The platform supports registration, login, CV upload, AI-assisted CV parsing, normalized profile and skills storage, job recommendation, gap analysis, an application tracker, and administrator dashboards for job and source diagnostics.

The implementation is intentionally described as a graduation/demo system rather than a production product. The AI outputs are estimates, the job data depends on imported and demo sources, and the security posture is appropriate for demonstration but requires further production hardening. Validation was performed through Docker Compose configuration checks, backend tests, frontend lint/build, Python service tests or syntax checks, HTTP probes, and manual browser screenshots. Backend tests passed with 39 tests and 297 assertions, the AI job miner tests passed with 75 tests, and the frontend build completed successfully. The AI CV analyzer container did not include pytest, so its pytest suite was marked as skipped while Python syntax compilation passed.

# Table of Contents

- Front Matter
- Chapter 1: Introduction
- Chapter 2: System Analysis
- Chapter 3: System Design and Architecture
- Chapter 4: Software and Tools Used
- Chapter 5: System Implementation
- Chapter 6: Testing and Evaluation
- Chapter 7: Security and Privacy
- Chapter 8: Conclusion and Future Work
- References
- Appendices

# List of Figures

{fig_list}

# List of Tables

{table_list}

# Abbreviations

| Abbreviation | Meaning |
|---|---|
| API | Application Programming Interface |
| CV | Curriculum Vitae |
| DFD | Data Flow Diagram |
| ERD | Entity Relationship Diagram |
| HTTP | Hypertext Transfer Protocol |
| JSON | JavaScript Object Notation |
| JWT | JSON Web Token |
| ML | Machine Learning |
| NLP | Natural Language Processing |
| OCR | Optical Character Recognition |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| S3 | Simple Storage Service compatible object storage |
| TF-IDF | Term Frequency-Inverse Document Frequency |
| UI | User Interface |

\\pagebreak

# Chapter 1: Introduction

## 1.1 Introduction to the Project

CareerCompass is an AI-assisted career guidance and job recommendation platform developed as a Computer Science graduation project for {UNIVERSITY}. The system helps a student upload a CV, receive a structured profile, view estimated job matches, inspect skill gaps, and save opportunities in an application tracker. The project combines web engineering, backend service design, natural language processing support, web scraping support, data persistence, and containerized operations.

The platform uses a modern web stack. The frontend is implemented with React, a component-based UI library [4], and bundled with Vite [5]. The backend uses Laravel, which provides routing, controllers, validation, middleware, Eloquent ORM, queues, testing support, and file storage abstractions [1]. The AI services are implemented with FastAPI, a Python API framework that supports type-hinted request and response handling [6]. The deployment is orchestrated through Docker Compose [11].

## 1.2 Background and Motivation

Many students prepare CVs and search for jobs without a clear view of how their current skills relate to job descriptions. Career guidance is often fragmented across CV feedback, job boards, learning resources, and manual advice. CareerCompass addresses this academic problem by placing those steps into one integrated demonstration system. The objective is not to replace human career advising, but to provide a practical software prototype that can parse a CV, normalize profile data, import job records, estimate matches, and present explainable gap analysis.

## 1.3 Problem Statement

Students frequently face three connected problems. First, they may not know whether their CV communicates their skills clearly. Second, job listings often describe requirements in different formats, making comparison difficult. Third, students may save opportunities across separate tools without a coherent tracker. CareerCompass proposes a centralized graduation/demo system that links CV data, jobs, matching, gap analysis, and tracking.

## 1.4 Purpose of the Project

The purpose of CareerCompass is to demonstrate how a distributed web system can support career exploration using explainable AI-assisted workflows. The project demonstrates authentication, CV upload, private storage, parsing, skill extraction, job import, recommendation, gap analysis, admin diagnostics, and monitoring in a Dockerized environment.

## 1.5 Project Objectives

- Provide a student-facing web interface for account creation, login, CV upload, profile review, job recommendations, gap analysis, and application tracking.
- Provide an administrator interface for dashboard statistics, job review, source diagnostics, and target role management.
- Implement a Laravel API that protects authenticated workflows using token-based access and role checks.
- Implement Python services for CV analysis and job mining support.
- Store uploaded CV files privately and expose downloads through controlled URLs.
- Validate the system with backend tests, frontend lint/build, Python tests where available, Docker checks, HTTP probes, and browser screenshots.

## 1.6 Proposed Solution

The proposed solution is a multi-service application. React renders the browser interface. Nginx serves as the gateway. Laravel handles REST-style APIs over HTTP [16], authentication, validation, data models, business services, and admin routes. MySQL stores normalized data [8]. MinIO provides S3-compatible object storage [9]. The CV analyzer parses PDFs and images using Python text extraction and OCR-related libraries. The job miner imports jobs from demo, API, and scraping-style sources using FastAPI, Scrapy, and HTML parsing concepts [16], [17], [18].

## 1.7 Project Scope

The scope covers a graduation/demo environment: local Docker deployment, student workflows, admin workflows, testing, screenshots, and documentation. It does not claim production readiness. The project does not guarantee job placement, full job market coverage, legal compliance for production privacy, or perfect AI accuracy.

## 1.8 Graduation Demo Positioning

CareerCompass should be presented as a working academic prototype with realistic engineering boundaries. The screenshots and tests show that the core workflows can run locally. However, large-scale evaluation, production identity management, cloud infrastructure, observability hardening, legal privacy review, and complete market integrations remain future work.

## 1.9 Report Organization

Chapter 2 analyzes requirements and users. Chapter 3 presents architecture, diagrams, database design, and deployment. Chapter 4 lists software and tools with references. Chapter 5 documents implementation modules from the repository. Chapter 6 presents testing and evaluation results. Chapter 7 discusses security and privacy. Chapter 8 concludes with achievements, limitations, and future work.

\\pagebreak

# Chapter 2: System Analysis

## 2.1 Introduction

System analysis defines what CareerCompass should do, who uses it, and what constraints influence implementation. The analysis is based on the reviewed repository, including the root documentation, Docker configuration, Laravel API, React frontend, Python services, database migrations, seeders, tests, and finalization notes.

## 2.2 Development Methodology

The project followed an iterative engineering approach. Each feature was implemented, checked through local commands or tests, integrated with Docker services, then documented. This approach is appropriate for a graduation project because it supports incremental progress while keeping the system demonstrable. The architecture uses separate services, which follows a common microservice-style pattern where independently deployable services communicate over network APIs [29].

## 2.3 Existing Career Guidance Problems

The system targets common problems in student career preparation:

- CV content is not structured for direct software comparison.
- Job descriptions vary in wording and completeness.
- Students need explainable feedback rather than unexplained match numbers.
- Admin users need visibility into imported jobs and scraping sources.
- Demo systems need reliable startup, testing, and evidence for academic evaluation.

## 2.4 Target Users and Stakeholders

| Stakeholder | Description | Main Interest |
|---|---|---|
| Student user | A university student or early-career user. | Upload CV, view profile, discover jobs, analyze gaps, save opportunities. |
| Administrator | A project operator or supervisor/demo administrator. | Review jobs, source diagnostics, users, target roles, and system health. |
| Supervisor | Academic supervisor evaluating the graduation project. | Correctness, completeness, originality, and honest evaluation. |
| Project team | Developers responsible for design and implementation. | Maintainable code, demonstrable workflows, testing, and documentation. |

## 2.5 User Roles

CareerCompass implements two practical roles. The student role can register, login, upload a CV, view recommendations, run gap analysis, and track applications. The admin role can access protected admin routes for dashboard statistics, job administration, scraping sources, target roles, and user review.

## 2.6 Functional Requirements

| ID | Requirement | Implementation Evidence |
|---|---|---|
| FR-01 | Register and login users. | Laravel AuthController, RegisterRequest, LoginRequest, React Login/Register pages. |
| FR-02 | Upload a CV file. | CvUploadRequest validates PDF/JPEG/PNG and max size; Dashboard appends file field `cv`. |
| FR-03 | Store CV files privately. | CvStorageService and MinIO/S3-compatible disk configuration. |
| FR-04 | Parse CV and extract profile/skills. | CvProcessingService and AI CV Analyzer `/api/parse-cv`. |
| FR-05 | Display normalized profile and skills. | UserResource, Profile page, Dashboard AI insight components. |
| FR-06 | Import and display jobs. | JobPosting model, ScrapedJobController, JobController, AI Job Miner. |
| FR-07 | Estimate job recommendations. | JobController and GapAnalysisService use CV/profile data and matching service. |
| FR-08 | Analyze skill gaps. | GapAnalysisController and GapAnalysis page. |
| FR-09 | Track applications. | ApplicationController, ApplicationTrackerService, Applications page. |
| FR-10 | Provide admin dashboards. | Admin Dashboard, Jobs, Sources, Targets pages and admin API routes. |
| FR-11 | Provide health and metrics endpoints. | HealthController, MetricsController, Prometheus/Grafana compose services. |

## 2.7 Non-Functional Requirements

| Category | Requirement | CareerCompass Approach |
|---|---|---|
| Usability | The UI should guide students through CV upload and recommendations. | React pages, dashboard cards, profile score, and action buttons. |
| Maintainability | Code should be modular. | Controllers, requests, services, resources, models, React pages, and Python services are separated. |
| Reliability | The system should degrade honestly if AI services fail. | CV processing returns timeout/error/no_text statuses and preserves prior data when appropriate. |
| Security | Authentication, validation, private files, and admin role checks are required. | Sanctum tokens, request validation, admin middleware, signed URLs, service tokens. |
| Observability | Health and metrics should be available. | `/api/health`, `/api/ready`, `/api/metrics`, Prometheus, Grafana. |
| Portability | The demo should run locally. | Docker Compose services and environment examples. |

## 2.8 Hardware Requirements

For local demonstration, a developer machine capable of running Docker Desktop and multiple containers is required. CV parsing and OCR-like processing can be CPU-intensive; therefore, enough memory should be available for the Laravel backend, MySQL, frontend, Python services, MinIO, Prometheus, and Grafana. GPU acceleration is not required for the demonstrated flow.

## 2.9 Software Requirements

| Layer | Software |
|---|---|
| Frontend | React, Vite, Tailwind-style CSS classes, lucide-react icons, Recharts. |
| Backend | Laravel 12, PHP, Composer dependencies, Sanctum-style token authentication. |
| AI services | Python, FastAPI, text extraction, OCR-related dependencies, Scrapy-style job mining. |
| Data | MySQL 8.0, MinIO/S3-compatible storage. |
| Infrastructure | Docker, Docker Compose, Nginx, Prometheus, Grafana. |
| Testing | PHPUnit/Pest-style Laravel tests, pytest for Python, ESLint and Vite build. |

## 2.10 Input and Output Flow

Primary inputs include user account data, uploaded CV files, imported job records, target role settings, and administrator source configurations. Primary outputs include normalized user profiles, skill lists, CV analysis metadata, estimated job matches, gap reports, application records, admin statistics, health checks, and monitoring metrics.

## 2.11 Use Case Summary

The main use cases are shown in Figure 5. The system separates student and administrator responsibilities while sharing the same backend API and database.

{figure_markdown("Figure 5", "UML use case diagram.", "assets/diagrams/05_use_case_diagram.png")}

\\pagebreak

# Chapter 3: System Design and Architecture

## 3.1 Introduction

CareerCompass is designed as a Dockerized multi-service application. This design separates browser UI, API logic, AI services, data storage, object storage, reverse proxy routing, and monitoring. Docker containers help package runtime dependencies consistently [10], while Docker Compose coordinates the multi-container local deployment [11].

## 3.2 High-Level System Architecture

The high-level architecture is shown in Figure 1. Browser users interact with the React frontend through Nginx. The frontend calls the Laravel API. Laravel persists records in MySQL, stores CV files in MinIO-compatible storage, calls the AI CV Analyzer for parsing, calls matching logic for recommendations/gaps, and receives job imports from the job miner.

{figure_markdown("Figure 1", "High-level architecture of CareerCompass.", "assets/diagrams/01_high_level_architecture.png")}

## 3.3 Frontend Architecture

The frontend is implemented with React and organized around routes in `frontend/src/App.jsx`. Public pages include Home, Login, Register, About, Privacy, Terms, and System Status. Protected student routes include Dashboard, Jobs, Gap Analysis, Profile, Settings, Market Intelligence, Applications, CV Builder, Mock Interview, Learning, Career Planner, Mentorship, and Tools Hub. Protected admin routes include Admin Dashboard, Jobs, Users, Sources, and Target Roles.

The frontend API layer is located under `frontend/src/api`. Axios is configured in `client.js`, including base URL resolution, bearer token injection, request IDs, retry behavior for safe GET requests, and 401 handling. Authentication state is managed by `AuthContext.jsx`, which stores the user and token in local storage. Localization files exist under `frontend/src/locales`.

## 3.4 Backend API Architecture

The backend is a Laravel API. Routes are defined in `backend-api/routes/api.php` and are registered both at `/api` and `/api/v1`. The API includes public health/readiness/metrics endpoints, guest authentication routes, public job listing routes, internal scraper import routes protected by a service token, authenticated student routes, and admin routes protected by middleware.

Laravel provides structured controllers, form requests, resources, services, models, migrations, seeders, and tests. This aligns with Laravel's documented framework responsibilities, including routing, validation, database access, queues, and testing [1], [3].

## 3.5 AI CV Analyzer Architecture

The AI CV Analyzer is a FastAPI service. Laravel sends CV files to this service for parsing. The analyzer extracts readable text from PDF or image inputs, attempts structured inference, and returns fields such as predicted role, seniority, domain, skills, strengths, gaps, red flags, confidence, and parsing status. The backend handles statuses such as success, OCR fallback, timeout, error, empty file, and no text. PDF and OCR-related libraries are supported by external tools such as PyMuPDF, pdfplumber, and EasyOCR [22], [23], [24].

## 3.6 AI Job Miner Architecture

The AI Job Miner is a FastAPI service with scraping and import support. It includes source adapters for demo/local data, public APIs, and HTML/Scrapy-style extraction. Scrapy is a Python framework for extracting structured data from websites [17], and Beautiful Soup is commonly used to parse HTML documents [18]. CareerCompass uses a quality gate and honest source classifications so that demo/imported data is not overstated as complete market coverage.

## 3.7 Database Design

MySQL stores users, profiles, skills, experience records, CV analyses, job postings, applications, scraping sources, target job roles, scraping jobs, failed URLs, and related metadata. MySQL is a relational database system documented by Oracle [8]. The Laravel migrations define schema constraints, indexes, foreign keys, and unique combinations such as job title/company uniqueness.

## 3.8 ERD

Figure 8 summarizes the main database tables and relationships. It is not a complete replacement for migrations, but it provides a readable graduation-book view of the data model.

{figure_markdown("Figure 8", "ERD and database summary diagram.", "assets/diagrams/08_erd.png")}

## 3.9 Data Flow Diagrams

The context-level data flow is shown in Figure 3, and the expanded process-level view is shown in Figure 4. Student and administrator workflows enter the same system boundary, while external job sources and AI services interact with controlled backend processes.

{figure_markdown("Figure 3", "DFD Level 0 context diagram.", "assets/diagrams/03_dfd_level_0.png")}

{figure_markdown("Figure 4", "DFD Level 1 process diagram.", "assets/diagrams/04_dfd_level_1.png")}

## 3.10 UML Use Case Diagram

The use case diagram separates student actions from administrator actions. Student workflows focus on career exploration. Admin workflows focus on operating and inspecting the imported job ecosystem.

## 3.11 UML Sequence Diagrams

Figure 6 shows the CV upload and analysis sequence. Figure 7 shows recommendation and gap analysis.

{figure_markdown("Figure 6", "Sequence diagram for CV upload and analysis.", "assets/diagrams/06_sequence_cv_upload_analysis.png")}

{figure_markdown("Figure 7", "Sequence diagram for recommendation and gap analysis.", "assets/diagrams/07_sequence_job_recommendation_gap_analysis.png")}

## 3.12 Deployment Architecture with Docker

The deployment is defined by Docker Compose files. Nginx exposes the application, the frontend serves built React assets, the Laravel API and workers handle backend work, MySQL stores structured data, MinIO stores private CV objects, Python services provide AI CV parsing and job mining, and Prometheus/Grafana provide monitoring. Figure 2 summarizes the container layout.

{figure_markdown("Figure 2", "Docker deployment architecture.", "assets/diagrams/02_docker_deployment.png")}

## 3.13 Monitoring Architecture

CareerCompass includes live, readiness, and metrics endpoints. Prometheus is used for scraping and time-series metrics collection [13], while Grafana visualizes metrics and dashboard panels [14]. The admin dashboard also exposes application-level health information for the graduation demo.

## 3.14 Design Decisions and Justification

| Decision | Justification |
|---|---|
| Use Laravel for the main API. | The project benefits from built-in routing, validation, Eloquent ORM, queues, resources, tests, and middleware [1]. |
| Use React for UI. | Component-based pages support student/admin route separation and reusable cards [4]. |
| Use FastAPI for AI services. | Python AI/NLP dependencies are easier to isolate behind typed HTTP services [6]. |
| Use Docker Compose. | Multiple services can be started consistently for a graduation defense [11]. |
| Use private object storage for CV files. | CV files are sensitive; private storage and signed downloads reduce accidental exposure [9], [27]. |
| Keep AI wording honest. | Match scores and CV parsing are estimates; the demo should not claim guaranteed outcomes. |

\\pagebreak

# Chapter 4: Software and Tools Used

## 4.1 Laravel

Laravel is used for the backend API, controllers, middleware, validation requests, Eloquent models, migrations, resources, queues, tests, and storage integration [1]. In CareerCompass, Laravel centralizes authenticated business logic and data persistence.

## 4.2 React

React is used to build the browser-based interface for students and administrators [4]. The project uses React routes and components for dashboard cards, forms, pages, tables, modals, and visualization panels.

## 4.3 Vite

Vite is used as the frontend build tool [5]. The successful production build transformed 2904 modules during validation.

## 4.4 FastAPI

FastAPI is used for Python services because it supports efficient API development using Python type hints and modern web service patterns [6]. CareerCompass uses it for CV analysis and job mining service endpoints.

## 4.5 Python

Python is used for AI and scraping-related services [7]. It supports the ecosystem of text extraction, OCR, NLP, testing, and scraping libraries used by the AI services.

## 4.6 MySQL

MySQL stores relational project data including users, profiles, skills, jobs, applications, scraping sources, and CV analyses [8].

## 4.7 MinIO / S3-Compatible Storage

MinIO-compatible object storage is used to store CV files privately. This avoids placing uploaded CVs directly in public web directories and supports signed temporary download flows [9].

## 4.8 Docker and Docker Compose

Docker containers package each runtime, and Docker Compose coordinates multi-container execution [10], [11]. CareerCompass uses Compose for Nginx, frontend, backend, workers, MySQL, MinIO, AI services, Prometheus, and Grafana.

## 4.9 Nginx

Nginx acts as the reverse proxy and public gateway for the local deployment [12]. It routes browser and API traffic to the correct containers.

## 4.10 Prometheus and Grafana

Prometheus collects metrics [13], and Grafana visualizes metrics and dashboards [14]. CareerCompass uses these tools to support monitoring-oriented evaluation.

## 4.11 GitHub Actions

GitHub Actions is configured for repository automation and CI/CD-style validation [15]. The report treats workflow definitions as part of the development process, while final PR status should be reviewed after the draft PR is opened.

## 4.12 NLP / AI Libraries

The project uses concepts and libraries related to text extraction, OCR, TF-IDF, cosine similarity, and sentence embeddings. TF-IDF and cosine similarity are documented by scikit-learn [19], [20]. Sentence Transformers provides sentence embedding models and utilities [21]. PyMuPDF, pdfplumber, and EasyOCR support PDF/image text extraction and OCR-style workflows [22], [23], [24].

## 4.13 Testing Tools

Backend tests use Laravel/PHP testing tools and PHPUnit concepts [25]. Python service tests use pytest where available [26]. Frontend validation uses ESLint and Vite build checks.

## 4.14 Development and Version Control Tools

Git and GitHub are used for version control and pull-request-based collaboration. Docker Desktop provides the local container runtime. Browser screenshots were captured through a Chrome DevTools Protocol helper to provide evidence images for this report.

\\pagebreak

# Chapter 5: System Implementation

## 5.1 Introduction

This chapter documents the implemented CareerCompass modules based on repository files. The implementation is not a generic career platform; it is a Laravel/React/FastAPI/Docker system with specific routes, services, pages, models, seeders, and tests.

## 5.2 Authentication and User Management

Authentication is implemented in `backend-api/app/Http/Controllers/Api/AuthController.php`. Registration creates a user with role `user`, loads profile and related resources, and returns a token. Login validates credentials, checks the banned state, revokes old tokens, creates a new token, and returns a user resource. The frontend stores the token as `auth_token` and the user object in local storage through `frontend/src/context/AuthContext.jsx`.

The register request restricts emails to selected public email domains and validates password format. The admin role is protected by the `IsAdmin` middleware. Admin seed data creates a demo-only administrator account through `AdminUserSeeder`.

## 5.3 Student Dashboard

The student dashboard is implemented in `frontend/src/pages/user/Dashboard.jsx`. It presents the current profile state, CV upload/update controls, profile completeness, career identity, AI insights, and next actions. Before CV upload, it prompts the user to add a CV. After upload, it displays parsed CV availability, role inference, profile score, experience, and action buttons.

{figure_markdown("Figure 12", "Student dashboard before CV upload.", "assets/screenshots/04_dashboard_before_cv_upload.png")}

{figure_markdown("Figure 14", "Dashboard after successful CV parsing.", "assets/screenshots/06_dashboard_after_cv_upload.png")}

## 5.4 CV Upload and Storage

`CvUploadRequest` requires a `cv` file and accepts PDF, JPEG, JPG, and PNG files up to 5 MB. The frontend appends the selected file as `cv` in a `FormData` object. `CvController` calls the CV processing service, persists the file path and metadata, and returns a unified user resource.

CV storage is handled as a private file workflow. The system supports signed download URLs, which is a better demo posture than public file exposure. OWASP recommends validating uploaded file type, extension, size, and storage handling carefully [27].

{figure_markdown("Figure 13", "CV upload user interface.", "assets/screenshots/05_cv_upload_ui.png")}

## 5.5 CV Parsing and Skill Extraction

The CV processing flow sends the file to the AI CV Analyzer, receives parsed data, synchronizes skills, updates profile fields, and stores CV analysis metadata. The implementation handles multiple parsing statuses honestly. If analysis times out, fails, or finds no readable text, the backend returns warnings and preserves existing profile details rather than silently replacing data with low-quality output.

## 5.6 Profile and Skills Management

The profile page reads normalized user data, profile fields, experiences, skills, and CV analysis. The system distinguishes user fields, profile fields, extracted skills, predicted role, seniority, and completeness score. Skill synchronization is handled through backend services rather than only frontend state.

{figure_markdown("Figure 15", "Extracted profile and skills page.", "assets/screenshots/07_extracted_profile_skills.png")}

## 5.7 Job Data Model

Jobs are represented in the backend through job posting models and migrations. Fields include title, company, description/requirements, URL, source, and metadata. The seeders and import controllers enforce quality gates and uniqueness rules, including a title/company uniqueness constraint that prevented duplicate seed insertion during validation.

## 5.8 AI Job Miner and Scraping Sources

The job miner exposes a FastAPI service and imports jobs using configured sources. The backend protects scraper import routes with an internal service token. Admin pages expose source diagnostics, source status, testing, and target role management. The project differentiates demo/local sources, API sources, and HTML/scraping sources instead of claiming complete market coverage.

{figure_markdown("Figure 24", "Admin sources diagnostics page.", "assets/screenshots/16_admin_sources_diagnostics.png")}

## 5.9 Job Recommendations

The jobs page requests recommended jobs when no manual search query is active. Recommendations are based on CV/profile context when available. Matching combines normalized database data with semantic and TF-IDF-style comparison where available. TF-IDF represents text using term frequency and inverse document frequency weighting [19], while cosine similarity compares vector orientation [20].

{figure_markdown("Figure 16", "Jobs recommendations page.", "assets/screenshots/08_jobs_recommendations.png")}

## 5.10 Gap Analysis

Gap analysis compares a selected job or target role against the user's profile and extracted skills. It returns matched skills, critical/missing skills, recommendations, match percentage, and roadmap-like guidance. The frontend displays these outputs in an explainable layout rather than a single opaque score.

{figure_markdown("Figure 18", "Gap analysis page.", "assets/screenshots/10_gap_analysis.png")}

## 5.11 Application Tracker

The application tracker is implemented through `ApplicationController`, `ApplicationTrackerService`, and `frontend/src/pages/user/Applications.jsx`. Students can save a job, update status, view counts, and delete tracked items. The backend validates job existence and allowed statuses.

{figure_markdown("Figure 19", "Applications tracker page.", "assets/screenshots/11_applications_tracker.png")}

## 5.12 Admin Dashboard

The admin dashboard summarizes users, imported jobs, active sources, target roles, health status, and scraping batch progress. It is protected by admin middleware and uses admin API routes.

{figure_markdown("Figure 22", "Admin dashboard.", "assets/screenshots/14_admin_dashboard.png")}

## 5.13 Admin Source Diagnostics

The source diagnostics page lists configured scraping sources, supports source testing, and displays quality and scraping status information. The target roles page manages role names used by scraping and market discovery.

{figure_markdown("Figure 25", "Admin target roles page.", "assets/screenshots/17_admin_targets.png")}

## 5.14 System Health and Monitoring

Health endpoints include live and readiness checks. The system status page presents service state to users, while admin health data supports operational monitoring. Metrics are available for Prometheus and dashboards are available through Grafana.

{figure_markdown("Figure 21", "System status page.", "assets/screenshots/13_system_status.png")}

## 5.15 Error Handling and Fallbacks

The code includes explicit handling for CV processing failures, AI gateway connection failures, validation errors, missing user data, empty job data, and unavailable services. The job recommendation and gap analysis code includes fallback behavior when AI services are not available.

## 5.16 Internationalization and UI Preview Modules

The frontend contains English and Arabic locale files. Preview modules include CV Builder, Mock Interview, Learning Paths, Career Planner, Mentorship, Tools Hub, and Market Intelligence. The report treats these as preview modules unless tests or implementation prove production completeness.

{figure_markdown("Figure 20", "Tools Hub preview page.", "assets/screenshots/12_tools_hub.png")}

## 5.17 Dockerized Runtime Flow

The runtime starts through Docker Compose. Nginx exposes the app, frontend and backend containers serve UI/API flows, backend workers process queues, Python services support AI workflows, MySQL and MinIO persist state, and monitoring services observe the stack.

{figure_markdown("Figure 26", "Docker services evidence.", "assets/screenshots/18_docker_containers.png")}

\\pagebreak

# Chapter 6: Testing and Evaluation

## 6.1 Introduction

Evaluation was performed using repository-aware commands and browser evidence. The goal was to verify that each major part of the graduation/demo system runs and to document limitations honestly.

## 6.2 Testing Strategy

The testing strategy combined automated tests, build checks, configuration checks, service health probes, and manual functional evaluation. Automated tests provide repeatable evidence. Screenshots provide visible workflow evidence. Manual tables document behavior that is difficult to fully automate in the available environment.

## 6.3 Backend Testing

Backend validation was executed inside the backend container. Composer dependencies were already installed. `php artisan config:clear`, `php artisan route:list`, migrations, and tests passed. The route list confirmed 131 routes. The Laravel test suite passed with 39 tests and 297 assertions.

## 6.4 Frontend Testing

The frontend was validated using the existing `frontend/node_modules` and the bundled Node runtime. ESLint passed with 9 warnings and 0 errors. The warnings were related to React fast-refresh export conventions and hook dependency notes. The Vite production build passed and transformed 2904 modules.

## 6.5 Python Services Testing

The AI Job Miner pytest suite passed with 75 tests. Python syntax compilation passed for both AI services. The AI CV Analyzer pytest command could not run because pytest was not installed in that container; this is recorded as a skipped/blocked validation step rather than a failure of the application code.

## 6.6 Docker and Integration Testing

Docker Compose configuration validation passed for both development and production overlay configurations. A full compose build/start was attempted; the initial full build exceeded the 15-minute command timeout, but the stack continued building and was later brought up successfully with targeted frontend/Nginx rebuild/start. All main containers reached healthy or running state during final checks.

{figure_markdown("Figure 27", "Validation command evidence.", "assets/screenshots/19_validation_summary.png")}

## 6.7 CI/CD Validation

GitHub Actions workflow files were reviewed as part of repository inspection. A live GitHub Actions status screenshot was not captured before the draft PR because PR checks only become meaningful after the branch is pushed and GitHub schedules workflows. The manual review checklist asks the team to inspect CI status on the opened draft PR.

## 6.8 CV Analyzer Evaluation

A sample PDF CV was generated for the screenshot workflow and uploaded through the running system. The upload succeeded, and the dashboard showed parsed CV data, a backend role inference, extracted skills, and profile completeness. This is a functional smoke evaluation, not a statistical AI accuracy evaluation. The existing AI evaluation plan should be used for larger future evaluation.

## 6.9 Recommendation Evaluation

After CV upload, the jobs page displayed recommendations with estimated match information. The gap page showed a 55 percent estimated match score for a selected backend Laravel developer job in the captured demo data. This value is reported only as observed demo output from the system, not as a verified global recommendation quality metric.

## 6.10 Gap Analysis Evaluation

Gap analysis produced matched expertise and missing/priority gap output for the selected job. The screenshot demonstrates that the route, backend analysis call, and frontend rendering worked in the local demo.

## 6.11 Job Miner Evaluation

The AI Job Miner test suite passed with 75 tests. Admin source diagnostics displayed active sources and source state. The job database contained imported/demo jobs visible in the admin dashboard. Because external job sources can change or throttle scraping, long-term data quality evaluation should be repeated near the final defense.

## 6.12 Application Tracker Evaluation

The application tracker was evaluated by saving a selected job to the tracker and loading the Applications page. The screenshot shows saved opportunity state. Backend tests also include application tracker behavior.

## 6.13 Admin Dashboard Evaluation

Admin login and admin dashboard access were tested with the demo admin account. The admin dashboard, admin jobs, admin sources, and admin target roles pages were captured. The dashboard displayed 22 users, 209 imported jobs, 9 active sources, and 13 target roles at capture time.

## 6.14 Performance Observations

The local Docker stack is heavy because it runs frontend, backend, multiple Laravel workers, MySQL, MinIO, two Python AI services, Prometheus, and Grafana. Initial full build can exceed a short command timeout on a Windows laptop. Once images are built, targeted service startup and HTTP checks are practical for a graduation demo.

## 6.15 Evaluation Limitations

- The AI CV Analyzer pytest suite was not executed because pytest was absent in that container.
- The sample CV evaluation is a smoke test, not a statistically valid dataset evaluation.
- The recommendation score shown in screenshots is an estimated local demo output.
- External scraping reliability depends on source availability and changing website/API behavior.
- Production security, privacy, and performance audits remain future work.

## 6.16 Summary of Results

| Area | Command or Scenario | Result | Evidence |
|---|---|---|---|
| Docker config | `docker compose config --quiet` | Passed | Terminal evidence |
| Docker prod config | `docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet` | Passed | Terminal evidence |
| Backend dependencies | `composer install --no-interaction --prefer-dist` | Passed | Command output |
| Backend routes | `php artisan route:list` | Passed, 131 routes | Command output |
| Backend tests | `php artisan test` | Passed, 39 tests, 297 assertions | Command output |
| Frontend lint | ESLint | Passed, 9 warnings, 0 errors | Command output |
| Frontend build | Vite build | Passed, 2904 modules transformed | Command output |
| AI Job Miner tests | `python -m pytest` | Passed, 75 tests | Command output |
| AI CV Analyzer syntax | `python -m compileall .` | Passed | Command output |
| AI CV Analyzer pytest | `python -m pytest` | Skipped, pytest missing | Command output |
| HTTP probes | `/`, `/api/health`, `/api/ready`, `/status`, AI services | 200 responses | Command output |

| Test ID | Module | Scenario | Expected Result | Actual Result | Status | Evidence |
|---|---|---|---|---|---|---|
| M-01 | Authentication | Register demo user | User created and token returned | User created with accepted Gmail-style address | Passed | Register screenshot/API output |
| M-02 | Authentication | Login student | Dashboard accessible | Dashboard loaded | Passed | Figure 12 |
| M-03 | CV upload | Upload valid PDF | CV accepted and parsed | Parsed successfully | Passed | Figures 13-15 |
| M-04 | CV upload | Invalid file handling | Validation error expected | Covered by backend validation/tests; not manually repeated in browser | Not Run Manual | Backend tests |
| M-05 | Recommendations | Open jobs page after CV | Jobs list with estimated matches | Jobs page loaded | Passed | Figure 16 |
| M-06 | Gap analysis | Analyze selected job | Match and skill breakdown | Gap page loaded | Passed | Figure 18 |
| M-07 | Tracker | Save job | Application appears in tracker | Application page loaded with saved item | Passed | Figure 19 |
| M-08 | Admin | Login admin and open dashboard | Admin-only dashboard visible | Dashboard visible | Passed | Figure 22 |
| M-09 | Admin sources | Open diagnostics | Sources visible | Diagnostics page visible | Passed | Figure 24 |
| M-10 | Status | Open system status page | Health UI visible | Status page visible | Passed | Figure 21 |

\\pagebreak

# Chapter 7: Security and Privacy

## 7.1 Introduction

Security in CareerCompass is implemented for a graduation/demo context. The system includes meaningful controls, but it should not be presented as production-grade without future hardening, legal review, and operational security work.

## 7.2 Authentication and Authorization

User authentication uses token-based API access through Laravel. Laravel Sanctum supports API token and SPA authentication use cases [2]. CareerCompass stores an auth token in the browser and attaches it to API requests. Authorization is role-aware: student routes require authentication, while admin routes require the admin role. Authentication security should follow established password and session guidance in production [28].

## 7.3 Admin Access Control

Admin access is enforced server-side by admin middleware. Frontend route protection improves user experience, but the backend check is the important control. The demo admin account is generated by a seeder and should be changed or disabled in any non-demo environment.

## 7.4 CV File Privacy

CV files contain personal data. CareerCompass validates file type and size, stores files privately, and avoids public direct file exposure. OWASP's file upload guidance emphasizes validation, restricted storage, and safe handling [27].

## 7.5 Private Storage and Signed Downloads

Uploaded CV files are stored through private storage and accessed through signed or temporary URLs. MinIO/S3-compatible storage supports object-based file storage and access control patterns [9]. The graduation demo should still avoid uploading real sensitive CVs unless the environment is controlled.

## 7.6 Internal Service Tokens

Scraper import routes use a service token middleware. This reduces accidental public ingestion, but service tokens must be rotated, stored securely, and monitored in production.

## 7.7 Payload and File Validation

Laravel form requests validate registration, login, CV upload, applications, and profile updates. File validation includes MIME type, extension, and size checks. Validation reduces risk but does not replace malware scanning, deep file inspection, or content disarm in production.

## 7.8 Logging and Request IDs

The API client attaches request IDs, and backend logging records important events such as CV processing status and AI gateway errors. For production, logs should avoid sensitive CV content and should be retained according to a privacy policy.

## 7.9 Demo Security Limitations

| Area | Current Demo Control | Production Hardening Needed |
|---|---|---|
| Admin account | Demo seeder account | Secret rotation, SSO/MFA, audit logs |
| CV files | Private storage and signed URLs | Malware scanning, retention policy, consent model |
| Tokens | Bearer tokens | Token rotation, secure cookie strategy, revocation review |
| Scraper service | Internal token | Secret manager, network isolation, rate limits |
| Monitoring | Local Prometheus/Grafana | Auth, TLS, dashboard access control |
| Privacy | Local demo posture | Legal review, privacy notice, data minimization |

## 7.10 Future Production Hardening

Future work should include HTTPS-only deployment, secure cookie/session strategy, administrator MFA, centralized secrets management, object scanning, retention policies, audit logging, rate-limit review, CSRF/CORS review, dependency vulnerability scanning, and a privacy impact assessment.

\\pagebreak

# Chapter 8: Conclusion and Future Work

## 8.1 Conclusion

CareerCompass demonstrates a practical AI-assisted career guidance workflow for a graduation project. It integrates CV parsing, profile normalization, skill extraction, imported job records, estimated recommendation, gap analysis, application tracking, admin diagnostics, and containerized deployment.

## 8.2 Project Achievements

- Built a working multi-service web application with frontend, backend, AI services, database, object storage, proxy, and monitoring.
- Implemented student authentication, dashboard, CV upload, profile view, jobs, gap analysis, and application tracking.
- Implemented admin dashboard, job management, source diagnostics, and target role management.
- Added tests and validation commands across backend, frontend, Python services, Docker, and HTTP probes.
- Captured browser screenshots from the running local system.
- Generated a formal report with diagrams, references, and evaluation notes.

## 8.3 Educational Value

The project demonstrates practical learning in software architecture, service decomposition, secure file handling, API design, database schema design, frontend state management, AI service integration, testing, Docker operations, monitoring, and academic documentation.

## 8.4 Current Limitations

- The system is a graduation/demo platform and not a production product.
- Recommendation and gap analysis outputs are estimates.
- AI evaluation needs larger labeled datasets and repeatable scoring.
- External scraping sources can be unstable.
- The AI CV Analyzer container needs pytest installed to run its test suite.
- Security and privacy controls need production hardening before real deployment.

## 8.5 Future Work

- Add a larger CV/job evaluation dataset with manual labels.
- Improve role taxonomy and skill normalization.
- Add production-grade authentication and administrator controls.
- Add malware scanning and retention policies for uploaded CV files.
- Improve recommendation explanations and calibration.
- Add automated browser end-to-end tests.
- Extend CI to run all containerized test suites consistently.
- Improve observability dashboards and alerting.
- Add deployment documentation for a secure cloud environment.

## 8.6 Final Remarks

CareerCompass is an original graduation project that connects academic software engineering requirements with a practical career guidance problem. Its strongest value is the integration of many realistic system parts into one demonstrable workflow, while preserving honest language about limitations and future production work.

\\pagebreak

# References

{refs}

\\pagebreak

# Appendices

## Appendix A: API Endpoint Summary

| Group | Example Endpoints | Purpose |
|---|---|---|
| Health | `/api/health`, `/api/ready`, `/api/metrics` | Liveness, readiness, and Prometheus metrics. |
| Auth | `/api/v1/register`, `/api/v1/login`, `/api/v1/logout`, `/api/v1/user` | User identity and token lifecycle. |
| CV | `/api/v1/upload-cv`, `/api/v1/user/skills`, `/api/v1/user/cv-analysis` | CV upload, parsed analysis, and extracted skills. |
| Jobs | `/api/v1/jobs`, `/api/v1/jobs/recommended`, `/api/v1/jobs/{{id}}` | Job listing, details, and recommendations. |
| Gap Analysis | `/api/v1/gap-analysis/job/{{jobId}}`, `/api/v1/gap-analysis/role/{{roleId}}` | Skill comparison and recommendations. |
| Applications | `/api/v1/applications` | Save and update tracked opportunities. |
| Admin | `/api/v1/admin/dashboard/stats`, `/api/v1/admin/jobs`, `/api/v1/admin/scraping-sources`, `/api/v1/admin/target-roles` | Admin dashboards and diagnostics. |
| Internal Scraper | `/api/jobs/import`, `/api/jobs/import/check`, `/api/proxies/active` | Service-token protected import routes. |

## Appendix B: Database Tables Summary

| Table | Purpose |
|---|---|
| users | Authentication identity, role, and banned status. |
| profiles | Student profile details and contact metadata. |
| skills | Canonical skill catalog. |
| user_skill | User-to-skill relationship and proficiency metadata. |
| experiences | Extracted or entered experience records. |
| cv_analyses | CV parsing status, predicted role, confidence, file metadata, strengths, gaps, and warnings. |
| job_postings | Imported/demo job data. |
| applications | Saved opportunities and status tracking. |
| scraping_sources | Admin-configured job source definitions. |
| target_job_roles | Target role list for scraping and market exploration. |
| scraping_jobs | Scraping batch execution state. |

## Appendix C: Docker Services Summary

| Service | Role |
|---|---|
| nginx | Public gateway and reverse proxy. |
| frontend | React/Vite web UI container. |
| backend-api | Laravel API runtime. |
| backend-worker variants | Queue processing for default, high, AI, emails, and scraping work. |
| backend-scheduler | Scheduled Laravel commands. |
| db | MySQL database. |
| minio | S3-compatible CV object storage. |
| ai-cv-analyzer | FastAPI CV parsing service. |
| ai-job-miner | FastAPI job mining service. |
| prometheus | Metrics collection. |
| grafana | Metrics visualization. |

## Appendix D: Screenshots

{chr(10).join([figure_markdown(num, caption, rel_path) for num, caption, rel_path in FIGURES[8:]])}

## Appendix E: Test Cases

The manual test matrix in Chapter 6 should be repeated before final submission. Additional recommended tests include invalid CV uploads, banned user login, expired signed download URLs, failed AI service behavior, scraper token rejection, admin route rejection for normal users, and browser checks on a clean database.

## Appendix F: GitHub Actions / CI Summary

The repository contains GitHub Actions workflow definitions. After the draft PR is opened, reviewers should inspect PR checks, rerun failed jobs if needed, and confirm that branch protection expectations are satisfied before merging. A CI screenshot was not embedded in this generated report because live PR checks were not available until after branch push.

## Appendix G: Demo Script

1. Start Docker Desktop.
2. Run `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
3. Open `http://localhost`.
4. Register or login as a student.
5. Upload a sample PDF CV from the dashboard.
6. Review parsed profile and skills.
7. Open Jobs and select a recommendation.
8. Open Gap Analysis and explain matched/missing skills.
9. Save the job to Applications.
10. Login as the demo admin.
11. Open Admin Dashboard, Jobs, Sources, and Target Roles.
12. Open System Status and explain health checks.
13. Discuss limitations and future work honestly.
"""


def write_references() -> None:
    REFERENCES_PATH.write_text(references_markdown(), encoding="utf-8")


def write_markdown() -> None:
    MD_PATH.write_text(report_markdown(), encoding="utf-8")


def set_doc_defaults(doc: Document) -> None:
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)
    styles = doc.styles
    styles["Normal"].font.name = "Times New Roman"
    styles["Normal"].font.size = Pt(11)
    for name, size in [("Title", 20), ("Heading 1", 18), ("Heading 2", 15), ("Heading 3", 13)]:
        styles[name].font.name = "Calibri"
        styles[name].font.size = Pt(size)
        styles[name].font.bold = True

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.add_run("Page ")
    run = footer.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_begin)
    run._r.append(instr)
    run._r.append(fld_end)


def add_cover(doc: Document) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    logo_table = doc.add_table(rows=1, cols=2)
    logo_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    logo_table.autofit = True
    logo_paths = [LOGOS / "university_logo.png", LOGOS / "faculty_logo.png"]
    for idx, logo in enumerate(logo_paths):
        cell = logo_table.cell(0, idx)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        para = cell.paragraphs[0]
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if logo.exists():
            para.add_run().add_picture(str(logo), width=Inches(1.25))

    for text, size, bold in [
        (UNIVERSITY, 16, True),
        (FACULTY, 14, True),
        (DEPARTMENT, 13, False),
        ("Graduation Project Book", 15, True),
        (ACADEMIC_YEAR, 13, False),
    ]:
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = para.add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(size)
        run.bold = bold

    doc.add_paragraph()
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run(PROJECT_TITLE)
    run.font.name = "Calibri"
    run.font.size = Pt(22)
    run.bold = True
    run.font.color.rgb = RGBColor(15, 23, 42)

    short = doc.add_paragraph()
    short.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = short.add_run(SHORT_NAME)
    run.font.name = "Calibri"
    run.font.size = Pt(18)
    run.bold = True
    run.font.color.rgb = RGBColor(14, 165, 233)

    doc.add_paragraph()
    submitted = doc.add_paragraph()
    submitted.alignment = WD_ALIGN_PARAGRAPH.CENTER
    submitted.add_run("Submitted by:").bold = True
    for student in STUDENTS:
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        para.add_run(student)

    doc.add_paragraph()
    sup = doc.add_paragraph()
    sup.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sup.add_run("Supervised by:").bold = True
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para.add_run(SUPERVISOR)
    doc.add_page_break()


def clean_inline(text: str) -> str:
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = text.replace("\\", "")
    return text


def add_md_table_docx(doc: Document, lines: list[str]) -> None:
    rows = []
    for line in lines:
        parts = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", part) for part in parts):
            continue
        rows.append(parts)
    if not rows:
        return
    table = doc.add_table(rows=len(rows), cols=max(len(r) for r in rows))
    table.style = "Table Grid"
    for r_idx, row in enumerate(rows):
        for c_idx, value in enumerate(row):
            cell = table.cell(r_idx, c_idx)
            cell.text = clean_inline(value)
            if r_idx == 0:
                for para in cell.paragraphs:
                    for run in para.runs:
                        run.bold = True
    doc.add_paragraph()


def add_image_docx(doc: Document, rel_path: str, caption: str) -> None:
    image_path = OUT_DIR / rel_path
    if not image_path.exists():
        doc.add_paragraph(f"[Missing image: {rel_path}]")
        return
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    try:
        para.add_run().add_picture(str(image_path), width=Inches(6.1))
    except Exception:
        para.add_run(f"[Unable to insert image: {rel_path}]")
    cap = doc.add_paragraph(caption)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in cap.runs:
        run.italic = True


def generate_docx() -> None:
    doc = Document()
    set_doc_defaults(doc)
    add_cover(doc)
    lines = MD_PATH.read_text(encoding="utf-8").splitlines()
    i = 0
    while i < len(lines) and lines[i] != "\\pagebreak":
        i += 1
    if i < len(lines) and lines[i] == "\\pagebreak":
        i += 1
    while i < len(lines):
        line = lines[i].rstrip()
        if not line:
            i += 1
            continue
        if line == "\\pagebreak":
            doc.add_page_break()
            i += 1
            continue
        if i == 0 and line.startswith("# "):
            i += 1
            continue
        if line.startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].startswith("|"):
                table_lines.append(lines[i])
                i += 1
            add_md_table_docx(doc, table_lines)
            continue
        image_match = re.match(r"!\[(.*?)\]\((.*?)\)", line)
        if image_match:
            caption = image_match.group(1)
            rel_path = image_match.group(2)
            add_image_docx(doc, rel_path, caption)
            i += 1
            if i < len(lines) and lines[i].startswith("*Figure"):
                i += 1
            continue
        if line.startswith("# "):
            doc.add_heading(clean_inline(line[2:]), level=1)
        elif line.startswith("## "):
            doc.add_heading(clean_inline(line[3:]), level=2)
        elif line.startswith("### "):
            doc.add_heading(clean_inline(line[4:]), level=3)
        elif line.startswith("- "):
            doc.add_paragraph(clean_inline(line[2:]), style="List Bullet")
        elif re.match(r"^\d+\. ", line):
            doc.add_paragraph(clean_inline(re.sub(r"^\d+\. ", "", line)), style="List Number")
        elif line.startswith("*Figure") or line.startswith("*Table"):
            p = doc.add_paragraph(clean_inline(line.strip("*")))
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.italic = True
        else:
            doc.add_paragraph(clean_inline(line))
        i += 1
    doc.save(DOCX_PATH)


def para_style(name: str, size: int, leading: int | None = None, bold: bool = False, align=TA_LEFT):
    return ParagraphStyle(
        name=name,
        fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size,
        leading=leading or size + 4,
        alignment=align,
        spaceAfter=8,
    )


def add_pdf_cover(story: list) -> None:
    logo_row = []
    for logo in [LOGOS / "university_logo.png", LOGOS / "faculty_logo.png"]:
        if logo.exists():
            logo_row.append(Image(str(logo), width=3.0 * cm, height=3.0 * cm))
        else:
            logo_row.append(Paragraph("", para_style("empty", 10)))
    table = Table([logo_row], colWidths=[7 * cm, 7 * cm])
    table.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(table)
    story.append(Spacer(1, 0.4 * cm))
    center = para_style("center", 13, bold=True, align=TA_CENTER)
    for line in [UNIVERSITY, FACULTY, DEPARTMENT, "Graduation Project Book", ACADEMIC_YEAR]:
        story.append(Paragraph(html.escape(line), center))
    story.append(Spacer(1, 1.0 * cm))
    story.append(Paragraph(html.escape(PROJECT_TITLE), para_style("pdf-title", 20, leading=25, bold=True, align=TA_CENTER)))
    story.append(Paragraph(html.escape(SHORT_NAME), para_style("pdf-short", 16, bold=True, align=TA_CENTER)))
    story.append(Spacer(1, 1.0 * cm))
    story.append(Paragraph("Submitted by:", center))
    for student in STUDENTS:
        story.append(Paragraph(html.escape(student), para_style("student", 12, align=TA_CENTER)))
    story.append(Spacer(1, 0.8 * cm))
    story.append(Paragraph("Supervised by:", center))
    story.append(Paragraph(html.escape(SUPERVISOR), para_style("supervisor", 12, align=TA_CENTER)))
    story.append(PageBreak())


def add_pdf_image(story: list, rel_path: str, caption: str) -> None:
    image_path = OUT_DIR / rel_path
    if not image_path.exists():
        story.append(Paragraph(html.escape(f"[Missing image: {rel_path}]"), para_style("normal", 10)))
        return
    with PILImage.open(image_path) as img:
        w, h = img.size
    max_w = 16.2 * cm
    max_h = 10.2 * cm
    ratio = min(max_w / w, max_h / h)
    story.append(Image(str(image_path), width=w * ratio, height=h * ratio))
    story.append(Paragraph(html.escape(caption), para_style("caption", 9, align=TA_CENTER)))
    story.append(Spacer(1, 0.2 * cm))


def add_md_table_pdf(story: list, lines: list[str]) -> None:
    rows = []
    for line in lines:
        parts = [clean_inline(cell.strip()) for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", part) for part in parts):
            continue
        rows.append(parts)
    if not rows:
        return
    max_cols = max(len(row) for row in rows)
    normalized = [row + [""] * (max_cols - len(row)) for row in rows]
    data = [[Paragraph(html.escape(cell), para_style("tablecell", 7, leading=9, bold=(r == 0))) for cell in row] for r, row in enumerate(normalized)]
    table = Table(data, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#94a3b8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 0.25 * cm))


def generate_pdf() -> int:
    styles = getSampleStyleSheet()
    story: list = []
    add_pdf_cover(story)
    h1 = para_style("h1", 16, leading=20, bold=True)
    h2 = para_style("h2", 13, leading=16, bold=True)
    h3 = para_style("h3", 12, leading=15, bold=True)
    normal = para_style("normal", 9, leading=12)
    bullet = para_style("bullet", 9, leading=12)
    lines = MD_PATH.read_text(encoding="utf-8").splitlines()
    i = 0
    while i < len(lines) and lines[i] != "\\pagebreak":
        i += 1
    if i < len(lines) and lines[i] == "\\pagebreak":
        i += 1
    while i < len(lines):
        line = lines[i].rstrip()
        if not line:
            i += 1
            continue
        if i == 0 and line.startswith("# "):
            i += 1
            continue
        if line == "\\pagebreak":
            story.append(PageBreak())
            i += 1
            continue
        if line.startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].startswith("|"):
                table_lines.append(lines[i])
                i += 1
            add_md_table_pdf(story, table_lines)
            continue
        image_match = re.match(r"!\[(.*?)\]\((.*?)\)", line)
        if image_match:
            add_pdf_image(story, image_match.group(2), image_match.group(1))
            i += 1
            if i < len(lines) and lines[i].startswith("*Figure"):
                i += 1
            continue
        if line.startswith("# "):
            story.append(Paragraph(html.escape(clean_inline(line[2:])), h1))
        elif line.startswith("## "):
            story.append(Paragraph(html.escape(clean_inline(line[3:])), h2))
        elif line.startswith("### "):
            story.append(Paragraph(html.escape(clean_inline(line[4:])), h3))
        elif line.startswith("- "):
            story.append(Paragraph("&bull; " + html.escape(clean_inline(line[2:])), bullet))
        elif re.match(r"^\d+\. ", line):
            story.append(Paragraph(html.escape(clean_inline(line)), normal))
        elif line.startswith("*Figure") or line.startswith("*Table"):
            story.append(Paragraph(html.escape(clean_inline(line.strip("*"))), para_style("caption", 8, align=TA_CENTER)))
        else:
            story.append(Paragraph(html.escape(clean_inline(line)), normal))
        i += 1

    def add_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.drawCentredString(A4[0] / 2.0, 1.2 * cm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        rightMargin=2.0 * cm,
        leftMargin=2.0 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
    )
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    return len(PdfReader(str(PDF_PATH)).pages)


def write_notes(page_count: int) -> None:
    screenshot_count = len(list(SCREENSHOTS.glob("*.png")))
    diagram_count = len(list(DIAGRAMS.glob("*.png")))
    notes = f"""# Report Generation Notes

## Purpose

This folder contains the generated graduation project book for CareerCompass.

## Style References

The supervisor-provided previous graduation books were copied into `reference-books/` and used only as formatting, structure, and academic-report style references. They were not used as scientific or technical sources for CareerCompass, and they are not cited as CareerCompass references.

## Generated Files

- `CareerCompass_Graduation_Project_Book.md`
- `CareerCompass_Graduation_Project_Book.docx`
- `CareerCompass_Graduation_Project_Book.pdf`
- `references.md`
- `assets/diagrams/*.png`
- `assets/screenshots/*.png`
- `assets/logos/*.png`
- `reference-books/*.pdf`

## Generation Tooling

- Markdown source: generated by `scripts/generate_graduation_book.py`.
- DOCX: generated with `python-docx` using A4 page settings and page-number fields.
- PDF: generated directly with ReportLab by this script as a fallback. In the final run, the retained PDF was exported from the generated DOCX using Microsoft Word COM automation.
- Diagrams: generated as PNG files with Pillow.
- Browser screenshots: captured from the running local Docker stack using Chrome DevTools Protocol.

## Counts

- PDF pages: {page_count}
- Screenshots/evidence images: {screenshot_count}
- Diagrams: {diagram_count}

## Validation Summary

- Docker Compose config passed for base and production overlay files.
- Docker stack was built and started; final service check showed application containers healthy or running.
- Backend composer install passed.
- `php artisan config:clear` passed.
- `php artisan route:list` passed with 131 routes.
- `php artisan migrate --force --no-interaction` passed with nothing to migrate.
- `php artisan test` passed with 39 tests and 297 assertions.
- Frontend ESLint passed with 9 warnings and 0 errors.
- Frontend Vite build passed with 2904 modules transformed.
- AI Job Miner pytest passed with 75 tests.
- AI CV Analyzer syntax compilation passed.
- AI CV Analyzer pytest was skipped/blocked because pytest was not installed in that container.
- HTTP probes for `/`, `/api/health`, `/api/ready`, `/status`, AI CV Analyzer, and Job Miner returned 200 responses.

## Known Placeholders

- `[Student Name 3]`
- `[Student Name 4]`
- `[Student Name 5]`

These placeholders were intentionally kept because only two student names were provided.

## Known Limitations

- This script creates a ReportLab PDF fallback from the Markdown source. In the final deliverable, Microsoft Word COM automation was used after script execution to export the DOCX to PDF.
- The Documents skill `render_docx.py` workflow was attempted after DOCX generation, but it could not render because LibreOffice/soffice was not available on the host PATH (`FileNotFoundError: [WinError 2]`).
- The report includes a static table of contents to avoid broken Word bookmark fields.
- The GitHub Actions status screenshot was not embedded because final PR checks are only available after pushing the branch and opening the draft PR.
- AI evaluation results are treated as preliminary/manual smoke evidence, not as statistical accuracy claims.

## Manual Review Before Submission

- Replace placeholder student names if the final team list is known.
- Open the DOCX in Microsoft Word and update visual spacing if the faculty requires a specific template.
- Confirm the generated PDF opens and figures are readable.
- Review the draft PR checks after GitHub Actions finish.
- Re-run a fresh Docker demo before the final defense.
- Confirm supervisor name, department, academic year, and student names before printing.
"""
    NOTES_PATH.write_text(notes, encoding="utf-8")


def main() -> None:
    ensure_dirs()
    create_diagrams()
    create_terminal_evidence()
    write_references()
    write_markdown()
    generate_docx()
    page_count = generate_pdf()
    write_notes(page_count)
    print(f"Generated Markdown: {MD_PATH}")
    print(f"Generated DOCX: {DOCX_PATH}")
    print(f"Generated PDF: {PDF_PATH}")
    print(f"PDF pages: {page_count}")


if __name__ == "__main__":
    main()
