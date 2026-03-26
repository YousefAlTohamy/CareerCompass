from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)


try:
    from transformers import pipeline

    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False


@dataclass(frozen=True, slots=True)
class NameCandidate:
    full_name: str
    confidence_score: float
    source_line: str


class AdvancedNEREngine:
    """
    V2 entity extraction engine.

    SRP: run NER and apply context-window filtering for skills.
    """

    _instance: Optional["AdvancedNEREngine"] = None

    def __new__(cls) -> "AdvancedNEREngine":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init_pipeline()
        return cls._instance

    def _init_pipeline(self) -> None:
        self._ner = None
        if not TRANSFORMERS_AVAILABLE:
            logger.error("HuggingFace Transformers not installed; AdvancedNEREngine disabled.")
            return

        model_name = self._resolve_model_name()
        try:
            # NOTE: no aggregation_strategy -> keep raw token offsets for robust context windows.
            self._ner = pipeline("ner", model=model_name, tokenizer=model_name)
            logger.info("AdvancedNEREngine loaded NER model: %s", model_name)
        except Exception as e:
            logger.exception("Failed to initialize NER pipeline (%s): %s", model_name, e)
            self._ner = None

    def _resolve_model_name(self) -> str:
        """
        Prefer a local fine-tuned CV model if present, otherwise fall back.
        """
        current_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
        custom = os.path.join(base_dir, "models", "ner_weights", "career_compass_ner_final")
        if os.path.exists(custom):
            return custom
        return "dslim/bert-base-NER"

    # Labels that must NEVER appear in the skills list.
    _NON_SKILL_BASES: frozenset = frozenset({"PER", "PERSON", "LOC", "LOCATION", "GPE"})

    # High-confidence technology taxonomy.
    # Entities whose lower-case form is in this set bypass the context-window
    # filter and are always accepted as skills.
    _TECH_TAXONOMY: frozenset = frozenset({
        # --- Languages ---
        "python", "java", "javascript", "typescript", "c", "c++", "c#", "go",
        "golang", "kotlin", "swift", "php", "ruby", "scala", "rust", "dart",
        "r", "matlab", "perl", "bash", "shell", "powershell", "groovy",
        "html", "css", "sass", "scss", "xml", "json", "yaml", "sql",
        # --- Web frameworks ---
        "laravel", "symfony", "codeigniter", "yii", "lumen", "slim",
        "django", "flask", "fastapi", "tornado", "aiohttp",
        "spring", "springboot", "spring boot", "quarkus", "micronaut",
        "rails", "sinatra",
        "react", "reactjs", "react.js", "next.js", "nextjs",
        "angular", "angularjs", "vue", "vuejs", "vue.js", "svelte", "nuxt",
        "express", "expressjs", "koa", "hapi", "nestjs", "nest.js",
        "asp.net", "asp", ".net", "dotnet", "blazor",
        "flutter", "ionic", "xamarin", "react native", "reactnative",
        # --- Testing ---
        "playwright", "selenium", "cypress", "jest", "mocha", "pytest",
        "junit", "testng", "phpunit", "karma", "jasmine",
        # --- Databases ---
        "mysql", "postgresql", "postgres", "sqlite", "mssql", "oracle",
        "mongodb", "mongoose", "couchdb", "firestore", "dynamodb",
        "redis", "memcached", "cassandra", "elasticsearch", "neo4j",
        "mariadb", "supabase",
        # --- Cloud / DevOps ---
        "aws", "azure", "gcp", "google cloud", "heroku", "vercel", "netlify",
        "docker", "kubernetes", "k8s", "terraform", "ansible", "puppet",
        "jenkins", "github actions", "gitlab ci", "circleci", "travis ci",
        "nginx", "apache", "caddy",
        "linux", "ubuntu", "debian", "centos", "macos", "windows server",
        # --- ML / Data ---
        "pytorch", "tensorflow", "keras", "scikit-learn", "sklearn",
        "pandas", "numpy", "scipy", "matplotlib", "seaborn", "plotly",
        "spark", "hadoop", "kafka", "airflow", "dbt", "dask",
        "huggingface", "transformers", "openai", "langchain",
        # --- Tools & misc ---
        "git", "github", "gitlab", "bitbucket", "jira", "confluence",
        "figma", "sketch", "adobe xd", "photoshop", "illustrator",
        "graphql", "rest", "grpc", "soap", "websocket",
        "firebase", "twilio", "stripe", "sendgrid",
        "webpack", "vite", "rollup", "babel", "eslint",
        "postman", "swagger", "openapi",
        "rabbitmq", "celery", "socket.io",
        "unity", "unreal", "godot",
    })

    def extract_entities(
        self,
        text: str,
        *,
        context_window_words: int = 3,
    ) -> Dict[str, List[str]]:
        """
        Returns normalized entities grouped into logical categories.

        Expected label set for the fine-tuned model:
        - SKILL, ROLE, EDU, CERT

        Fallback model (dslim/bert-base-NER) yields PER/ORG/LOC/MISC; in that case
        we only populate `people/orgs/locations/misc` without skill filtering.

        Strict rule: entities with a LOC, GPE, or PER label are NEVER added to the
        skills list, regardless of confidence score.
        """
        _empty: Dict[str, List[str]] = {
            "skills": [],
            "roles": [],
            "education": [],
            "certifications": [],
            "people": [],
            "orgs": [],
            "locations": [],
            "misc": [],
        }
        if not text or self._ner is None:
            return _empty

        try:
            tokens = self._ner(text)
        except Exception as e:
            logger.exception("NER inference failed: %s", e)
            return _empty

        # Word spans for context-window filtering (character-aligned).
        word_spans = _build_word_spans(text)

        grouped: Dict[str, List[str]] = {
            "skills": [],
            "roles": [],
            "education": [],
            "certifications": [],
            "people": [],
            "orgs": [],
            "locations": [],
            "misc": [],
        }

        # Determine which label family we are dealing with.
        has_custom_labels = any(str(t.get("entity", "")).endswith(("SKILL", "ROLE", "EDU", "CERT")) for t in tokens)

        merged = _merge_ner_tokens(tokens)

        if has_custom_labels:
            for ent_text, ent_label, (start, end) in merged:
                if not ent_text:
                    continue

                base = ent_label.split("-")[-1] if "-" in ent_label else ent_label

                # Hard exclusion: never add geo/person labels as skills.
                if base in self._NON_SKILL_BASES:
                    logger.debug(
                        "Strict filter: skipping '%s' (label=%s) from skills.",
                        ent_text, ent_label,
                    )
                    continue

                if base == "SKILL":
                    if _should_keep_skill(
                        ent_text,
                        start,
                        end,
                        word_spans,
                        window=context_window_words,
                        taxonomy=self._TECH_TAXONOMY,
                    ):
                        grouped["skills"].append(ent_text)
                elif base == "ROLE":
                    grouped["roles"].append(ent_text)
                elif base == "EDU":
                    grouped["education"].append(ent_text)
                elif base == "CERT":
                    grouped["certifications"].append(ent_text)

        else:
            for ent_text, ent_label, _span in merged:
                if not ent_text:
                    continue
                base = ent_label.split("-")[-1] if "-" in ent_label else ent_label
                if base in ("PER", "PERSON"):
                    grouped["people"].append(ent_text)
                elif base in ("ORG", "ORGANIZATION"):
                    grouped["orgs"].append(ent_text)
                elif base in ("LOC", "LOCATION", "GPE"):
                    grouped["locations"].append(ent_text)
                else:
                    # MISC tokens from fallback model can sometimes be tech terms;
                    # still apply the non-skill exclusion just in case.
                    if base not in self._NON_SKILL_BASES:
                        grouped["misc"].append(ent_text)

        # De-duplicate while keeping order.
        for k, vals in grouped.items():
            grouped[k] = _dedupe_preserve_order(vals)

        return grouped

    def extract_candidate_name(
        self,
        profile_lines: Sequence[str] | str,
    ) -> Optional[NameCandidate]:
        """
        Name extraction:
        1. Primary: Run BERT NER on the first 500 characters of the document.
           If a PER/PERSON entity is detected with confidence > 0.85, use it.
        2. Fallback: iterate over lines and apply heuristic name detection.
        """
        if isinstance(profile_lines, str):
            full_text = profile_lines
            lines = [ln.strip() for ln in profile_lines.splitlines()]
        else:
            lines = [str(ln).strip() for ln in profile_lines]
            full_text = "\n".join(lines)

        # ── Primary: NER-driven extraction ───────────────────────────────────
        if self._ner is not None:
            snippet = full_text[:500]
            try:
                ner_tokens = self._ner(snippet)
                ner_merged = _merge_ner_tokens(ner_tokens)
                for ent_text, ent_label, _span in ner_merged:
                    base = ent_label.split("-")[-1] if "-" in ent_label else ent_label
                    if base not in ("PER", "PERSON"):
                        continue
                    # Gather confidence: use the max score among constituent tokens.
                    score = max(
                        (float(t.get("score", 0)) for t in ner_tokens
                         if str(t.get("entity", "")).split("-")[-1] in ("PER", "PERSON")),
                        default=0.0,
                    )
                    if score < 0.85:
                        continue
                    candidate = _normalize_name_candidate(ent_text)
                    if candidate is None:
                        # Try raw ent_text without strict normalization.
                        candidate = ent_text.strip() or None
                    if candidate:
                        logger.info(
                            "Name extracted via NER PER entity: '%s' (score=%.2f)",
                            candidate, score,
                        )
                        return NameCandidate(
                            full_name=candidate,
                            confidence_score=round(score, 4),
                            source_line=ent_text,
                        )
            except Exception as exc:
                logger.warning("NER-based name extraction failed: %s", exc)

        # ── Fallback: line-based heuristic ───────────────────────────────────
        for line in lines:
            if not line:
                continue
            if _looks_like_contact_line(line):
                continue
            if _is_mostly_numeric_or_symbols(line):
                continue

            candidate = _normalize_name_candidate(line)
            if candidate is None:
                continue

            conf = 0.88
            if 1 <= len(candidate.split()) <= 4:
                conf = 0.93
            return NameCandidate(full_name=candidate, confidence_score=conf, source_line=line)

        logger.info("Name extraction: no suitable name found (NER + heuristic both failed).")
        return None


_WORD_RE = re.compile(r"\S+")
_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_URL_RE = re.compile(r"\b(?:https?://|www\.)\S+\b", re.IGNORECASE)
_PHONE_RE = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")


def _build_word_spans(text: str) -> List[Tuple[str, int, int]]:
    spans: List[Tuple[str, int, int]] = []
    for m in _WORD_RE.finditer(text):
        spans.append((m.group(0), m.start(), m.end()))
    return spans


def _merge_ner_tokens(tokens: Iterable[dict]) -> List[Tuple[str, str, Tuple[int, int]]]:
    """
    Merges subword tokens while preserving original character spans.
    Returns: [(entity_text, entity_label, (start, end)), ...]
    """
    merged: List[Tuple[str, str, Tuple[int, int]]] = []

    cur_text = ""
    cur_label: Optional[str] = None
    cur_start: Optional[int] = None
    cur_end: Optional[int] = None

    def flush() -> None:
        nonlocal cur_text, cur_label, cur_start, cur_end
        if cur_text and cur_label and cur_start is not None and cur_end is not None:
            merged.append((_clean_entity_text(cur_text), cur_label, (cur_start, cur_end)))
        cur_text = ""
        cur_label = None
        cur_start = None
        cur_end = None

    last_end = -1
    for t in tokens:
        word = str(t.get("word", "") or "")
        label = str(t.get("entity", "") or "")
        start = int(t.get("start", -1) or -1)
        end = int(t.get("end", -1) or -1)
        if not word or start < 0 or end < 0:
            continue

        base = label.split("-")[-1] if "-" in label else label
        is_inside = label.startswith("I-")

        # A WordPiece subword token starts with "##".  We strip the marker
        # and append the suffix directly to the running buffer (no space),
        # using the character-level span to detect adjacency as a second
        # signal.  Both signals must agree before we split into a new entity.
        is_subword = word.startswith("##")
        clean_token = word[2:] if is_subword else word

        if cur_label is None:
            cur_label = base
            cur_text = clean_token
            cur_start = start
            cur_end = end
            last_end = end
            continue

        # ── Merge decision ────────────────────────────────────────────────
        # Rule 1: WordPiece subword → always concatenate without space.
        #         The char span should also be adjacent (start == last_end);
        #         we trust the ## marker even if tokenizer offsets are off by 1.
        if is_subword:
            cur_text += clean_token
            cur_end = end
        # Rule 2: Adjacent char offsets with the same label → same surface word.
        elif start == last_end and cur_label == base:
            cur_text += clean_token
            cur_end = end
        # Rule 3: Inside-tag with same base label → multi-word entity.
        elif is_inside and cur_label == base:
            cur_text += " " + clean_token
            cur_end = end
        else:
            flush()
            cur_label = base
            cur_text = clean_token
            cur_start = start
            cur_end = end

        last_end = end

    flush()
    # Drop empties after cleaning.
    return [(t, l, s) for (t, l, s) in merged if t]


# Punctuation that is safe to strip from entity text boundaries.
# Characters meaningful in tech names (# + . *) are intentionally excluded.
_STRIP_PUNCT_RE = re.compile(
    r"^[\s,;:|/\-–—]+|[\s,;:|/\-–—]+$"
)


def _clean_entity_text(s: str) -> str:
    """Normalize whitespace and strip boundary punctuation.

    Deliberately preserves characters that appear in technical identifiers:
    '#' (C#), '+' (C++), '.' (.NET), '*' (wildcards).
    """
    s = re.sub(r"\s+", " ", s).strip()
    # Strip boundary noise but keep technical symbols intact.
    s = _STRIP_PUNCT_RE.sub("", s)
    return s


_GENERIC_NOUNS = {
    "system",
    "platform",
    "development",
    "application",
    "applications",
    "service",
    "services",
    "solution",
    "solutions",
    "software",
    "website",
    "web",
    "data",
    "database",
    "architecture",
    "design",
    "testing",
    "automation",
    "tool",
    "tools",
    "framework",
    "frameworks",
    "library",
    "libraries",
    "api",
    "apis",
}

_TECH_MODIFIERS = {
    # languages
    "python",
    "java",
    "javascript",
    "typescript",
    "c",
    "c++",
    "c#",
    "go",
    "golang",
    "kotlin",
    "swift",
    "php",
    "ruby",
    "scala",
    "rust",
    "sql",
    # clouds / infra
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "terraform",
    "jenkins",
    "linux",
    "ci",
    "cd",
    "cicd",
    # frameworks / tools
    "react",
    "angular",
    "vue",
    "node",
    "nodejs",
    "spring",
    "django",
    "flask",
    "fastapi",
    "pytorch",
    "tensorflow",
    "scikit",
    "sklearn",
    "pandas",
    "numpy",
    "spark",
    "hadoop",
}


def _should_keep_skill(
    skill: str,
    start: int,
    end: int,
    word_spans: Sequence[Tuple[str, int, int]],
    *,
    window: int,
    taxonomy: Optional[frozenset] = None,
) -> bool:
    """
    Decide whether a detected skill entity should be kept.

    Priority:
    1. If the normalised skill name is in *taxonomy* (the engine's _TECH_TAXONOMY),
       accept immediately with high confidence — no context-window check needed.
    2. If the skill is a generic noun, require a technical modifier within ±window
       words (context-window filter).
    3. Everything else passes by default.
    """
    clean = skill.strip()
    if not clean:
        return False

    # Micro-token filter: drop single-char non-acronym tokens.
    if len(clean) <= 2 and clean.upper() not in {"C", "R"}:
        if not (clean.isupper() or any(ch in clean for ch in {"#", "+", "."})):
            return False

    normalized = clean.lower().strip(" ,;:()[]{}")

    # ── Fast-path: known technology taxonomy ────────────────────────────────
    if taxonomy and normalized in taxonomy:
        return True

    # ── Generic-noun guard ──────────────────────────────────────────────────
    if normalized not in _GENERIC_NOUNS:
        return True

    # Locate entity word-index span in the original word list.
    idxs = [i for i, (_w, s, e) in enumerate(word_spans) if not (e <= start or s >= end)]
    if not idxs:
        # Cannot align span → keep conservatively (avoid false negatives).
        return True

    left = max(0, min(idxs) - window)
    right = min(len(word_spans) - 1, max(idxs) + window)
    ctx_words = [word_spans[i][0].lower().strip(" ,;:()[]{}") for i in range(left, right + 1)]

    return any(w in _TECH_MODIFIERS for w in ctx_words)


def _dedupe_preserve_order(items: Sequence[str]) -> List[str]:
    seen: set[str] = set()
    out: List[str] = []
    for x in items:
        k = x.strip().lower()
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(x.strip())
    return out


def _looks_like_contact_line(line: str) -> bool:
    if _EMAIL_RE.search(line) or _URL_RE.search(line) or _PHONE_RE.search(line):
        return True
    # Lines with many separators are usually contact blocks.
    sep_count = sum(line.count(ch) for ch in ("@", "|", "/", "\\"))
    return sep_count >= 2


def _is_mostly_numeric_or_symbols(line: str) -> bool:
    letters = sum(ch.isalpha() for ch in line)
    digits = sum(ch.isdigit() for ch in line)
    if digits >= 6 and letters == 0:
        return True
    # If very few letters overall, treat as non-name.
    return letters <= 1 and digits >= 2


_NAME_BAD_TOKENS = {
    # Document section headers
    "resume",
    "curriculum",
    "vitae",
    "cv",
    "profile",
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    # Job-title / discipline words that look like names but are not
    "engineering",
    "software",
    "developer",
    "engineer",
    "manager",
    "analyst",
    "architect",
    "consultant",
    "specialist",
    "coordinator",
    "administrator",
    "technician",
    "intern",
    "senior",
    "junior",
    "lead",
    "head",
    "director",
    "executive",
    "officer",
    "president",
    "vice",
    "assistant",
    "associate",
    "principal",
    "staff",
    "contractor",
    "freelance",
}


def _normalize_name_candidate(line: str) -> Optional[str]:
    s = re.sub(r"\s+", " ", line).strip()
    s = s.strip("-–—|:•·*")
    if not s:
        return None
    if len(s) > 60:
        return None

    parts = [p for p in re.split(r"\s+", s) if p]
    if not (1 <= len(parts) <= 5):
        return None

    # Reject if it looks like a section header rather than a name.
    lowered = " ".join(parts).lower()
    if lowered in _NAME_BAD_TOKENS:
        return None
    if any(tok in _NAME_BAD_TOKENS for tok in lowered.split()):
        # Allow "John Doe - Software Engineer" to pass by trimming trailing title.
        if "-" in s or "|" in s:
            head = re.split(r"[-|]", s, maxsplit=1)[0].strip()
            return _normalize_name_candidate(head)
        return None

    # Heuristic: at least one alphabetic character per token.
    if any(not any(ch.isalpha() for ch in p) for p in parts):
        return None

    # Title-case-ish check (works for most Latin names).
    alpha_tokens = [p for p in parts if any(ch.isalpha() for ch in p)]
    capital_like = sum(1 for p in alpha_tokens if p[:1].isupper())
    if capital_like >= max(1, len(alpha_tokens) - 1):
        return " ".join(parts)

    # If not capitalized, still allow 2-3 word names without digits.
    if 2 <= len(parts) <= 3 and not any(any(ch.isdigit() for ch in p) for p in parts):
        return " ".join(parts)

    return None

