from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Literal, Optional

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, confloat

ConfidenceScore = confloat(ge=0.0, le=1.0)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ConfidenceItem(StrictModel):
    confidence_score: ConfidenceScore = Field(
        ...,
        description="Model confidence in the extracted/derived value (0.0-1.0).",
    )


class ContactInfo(StrictModel):
    # NOTE: Avoid `EmailStr` here to prevent requiring the optional `email-validator` dependency.
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[HttpUrl] = None
    github_url: Optional[HttpUrl] = None
    portfolio_url: Optional[HttpUrl] = None


class Profile(StrictModel):
    full_name: Optional[str] = None
    current_title: Optional[str] = None
    alternative_titles: List[str] = Field(default_factory=list)
    headline: Optional[str] = None
    contact: ContactInfo = Field(default_factory=ContactInfo)
    summary: Optional[str] = None
    confidence_score: ConfidenceScore = 0.0


class DocumentStats(StrictModel):
    page_count: int = Field(ge=0)
    char_count: int = Field(ge=0)
    word_count: int = Field(ge=0)
    language_hint: Optional[str] = None


class SkillItem(ConfidenceItem):
    name: str = Field(min_length=1)
    category: Optional[
        Literal["hard", "soft", "tool", "language", "framework", "platform", "other"]
    ] = None
    evidence: Optional[str] = Field(
        default=None, description="Short snippet indicating where it was found."
    )


class SkillsSection(StrictModel):
    items: List[SkillItem] = Field(default_factory=list)
    confidence_score: ConfidenceScore = 0.0


class ExperienceItem(ConfidenceItem):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None
    description: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)


class ExperienceSection(StrictModel):
    items: List[ExperienceItem] = Field(default_factory=list)
    confidence_score: ConfidenceScore = 0.0


class AnalysisSection(StrictModel):
    summary: Optional[str] = None
    predicted_role: Optional[str] = None
    seniority: Optional[Literal["intern", "junior", "mid", "senior", "lead", "principal", "manager"]] = None
    primary_domain: Optional[str] = None
    strengths: List[str] = Field(default_factory=list)
    gaps: List[str] = Field(default_factory=list)
    red_flags: List[str] = Field(default_factory=list)
    confidence_score: ConfidenceScore = 0.0
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Reserved for model-specific analysis metadata (kept strict at top-level).",
    )


class CVParseResult(StrictModel):
    """
    Strict production contract for the CV Parser JSON output.
    """

    parsing_status: Literal["success", "ocr_fallback", "empty_file", "no_text", "error"] = "success"
    profile: Profile
    stats: DocumentStats
    skills: SkillsSection
    experience: ExperienceSection
    analysis: AnalysisSection

