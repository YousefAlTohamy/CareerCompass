import logging
from typing import Dict, List
import numpy as np
import torch

try:
    from transformers import pipeline
    import warnings
    warnings.filterwarnings("ignore")
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

logger = logging.getLogger(__name__)

from ..layer3_matching.embedder import SemanticEmbedder

class CVDomainClassifier:
    """
    Layer 2: Domain Classification
    Uses Zero-Shot Classification to determine the professional domain of the CV
    without needing a massive labeled dataset initially.
    """
    _instance = None
    _classifier = None
    
    # Enriched Knowledge Bank for Domain Centroids
    # This provides deep context for each domain to improve semantic matching accuracy.
    DOMAIN_KNOWLEDGE_BANK = {
        "Technology & Software": "Software engineering, computer science, programming, system architecture, algorithms, data structures, software development life cycle, git, cloud computing, devops.",
        "Healthcare & Medicine": "Medical treatment, clinical care, nursing, diagnosis, pharmacology, patient health, surgery, biology, anatomy, healthcare administration.",
        "Finance & Accounting": "Financial analysis, accounting principles, taxation, auditing, investment management, banking, risk assessment, budget planning, financial reporting.",
        "Education & Training": "Teaching, curriculum development, pedagogy, classroom management, academic research, e-learning, training coordination, educational leadership.",
        "Legal & Law": "Legal research, litigation, corporate law, contract negotiation, judicial proceedings, legal documentation, compliance, intellectual property, criminal justice.",
        "Marketing & Sales": "Digital marketing, brand management, market research, sales strategy, advertising, consumer behavior, SEO, content marketing, public relations.",
        "Creative Arts & Design": "Graphic design, visual arts, creative direction, illustration, multimedia, UX/UI, fine arts, photography, digital content creation.",
        "Manufacturing & Engineering": "Mechanical engineering, electrical systems, industrial production, civil engineering, supply chain, quality control, CAD design, manufacturing processes.",
        "Human Resources": "Recruitment, talent management, employee relations, organizational development, payroll, HR policy, benefits administration, onboarding.",
        "Customer Service & Support": "Client relations, technical support, problem solving, communication skills, help desk, satisfaction management, call center operations.",
        "Science & Research": "Scientific method, laboratory analysis, physics, chemistry, biotechnology, data interpretation, peer review, experimental design, academic publishing.",
        "Construction & Trades": "Building, plumbing, electrical work, carpentry, project management, safety regulations, blueprints, heavy equipment, site inspection."
    }

    TECH_DOMAINS_KNOWLEDGE = {
        "Backend Development": "Server-side, databases, SQL, NoSQL, API development, Node.js, Python, Java, Ruby, Golang, Microservices, system scalability.",
        "Frontend Development": "Client-side, React, Vue, Angular, JavaScript, HTML5, CSS3, Responsive Web Design, browser performance, accessibility.",
        "Full Stack Development": "Both frontend and backend, database management, full web application lifecycle, integration, DevOps basics.",
        "Mobile App Development": "iOS, Android, Flutter, React Native, Swift, Kotlin, mobile performance, app store deployment, mobile UI/UX.",
        "Data Science & AI": "Machine learning, data analysis, statistics, Python, R, TensorFlow, PyTorch, deep learning, data visualization, predictive modeling.",
        "DevOps & Cloud": "CI/CD, Docker, Kubernetes, AWS, Azure, GCP, infrastructure as code, Terraform, Linux, monitoring, site reliability engineering.",
        "UI/UX Design": "User interface design, user experience research, Figma, Adobe XD, wireframing, prototyping, user-centered design, interaction design.",
        "Quality Assurance & Testing": "Software testing, automation testing, Selenium, Jest, unit testing, integration testing, bug tracking, QA methodologies.",
        "Cybersecurity": "Network security, ethical hacking, penetration testing, cryptography, threat detection, security compliance, SOC, incident response."
    }

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CVDomainClassifier, cls).__new__(cls)
            cls._instance._initialize_resources()
        return cls._instance

    def _initialize_resources(self):
        """
        Initializes Semantic Centroids and Zero-Shot Fallback.
        """
        # Layer 3 Embedder for Centroid Calculation
        self._embedder = SemanticEmbedder()
        
        # Pre-compute centroids (Enriched Industry Knowledge)
        self._industry_centroids = self._precompute_centroids(self.DOMAIN_KNOWLEDGE_BANK)
        self._tech_centroids = self._precompute_centroids(self.TECH_DOMAINS_KNOWLEDGE)

        if not TRANSFORMERS_AVAILABLE:
            self._classifier = None
            return

        logger.info("Loading Layer 2 Classifier Fallback (DistilBART)...")
        try:
            from transformers import pipeline
            import torch
            # Using a much lighter distilled model for faster fallback
            MODEL_NAME = "valhalla/distilbart-mnli-12-1"
            self._classifier = pipeline(
                "zero-shot-classification", 
                model=MODEL_NAME,
                device=0 if torch.cuda.is_available() else -1
            )
        except Exception as e:
            logger.error(f"Failed to load Classifier fallback: {e}")
            self._classifier = None

    def _precompute_centroids(self, knowledge_bank: Dict[str, str]) -> Dict[str, np.ndarray]:
        """Convert enriched descriptions into high-dimensional centroid vectors."""
        centroids = {}
        for domain, description in knowledge_bank.items():
            try:
                vec = self._embedder.get_embedding(description)
                if vec is not None:
                    centroids[domain] = vec
            except Exception:
                continue
        return centroids

    def _cosine_similarity(self, vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return np.dot(vec_a, vec_b) / (norm_a * norm_b)

    def predict_domain_from_cv_data(self, cv_data: Dict) -> Dict[str, float]:
        """
        Builds classification input from structured data for better accuracy.
        """
        parts = []

        # 1. Skills
        skills_items = cv_data.get("skills", {}).get("items", [])
        skills = [s.get("name", "") for s in skills_items if s.get("name")]
        if skills:
            parts.append("Technical Skills: " + ", ".join(skills[:25]))

        # 2. Job Titles
        experience_items = cv_data.get("experience", {}).get("items", [])
        titles = [exp.get("title", "") for exp in experience_items if exp.get("title")]
        if titles:
            parts.append("Job Roles: " + ", ".join(titles[:5]))

        # 3. Technologies per job
        all_techs = []
        for exp in experience_items[:3]:
            all_techs.extend(exp.get("technologies", []) or [])
        if all_techs:
            parts.append("Technologies Used: " + ", ".join(list(set(all_techs))[:20]))

        classification_text = " | ".join(parts)
        
        # Fallback to raw_text if structured data is too thin
        if len(classification_text) < 50:
            raw_text = cv_data.get("analysis", {}).get("metadata", {}).get("extraction", {}).get("raw_text", "")
            if not raw_text and "raw_text" in cv_data: # Direct access if passed differently
                raw_text = cv_data["raw_text"]
                
            if raw_text:
                classification_text = raw_text[300:1800] # Skip header
        
        # Stage 1: Industry Centroid Matching (Primary & Fast)
        cv_vec = self._embedder.get_embedding(classification_text)
        if cv_vec is None:
            return {"Unknown": 1.0}

        industry_probs = {}
        for domain, centroid in self._industry_centroids.items():
            sim = self._cosine_similarity(cv_vec, centroid)
            # Apply soft-max like normalization for scoring
            industry_probs[domain] = float(sim)
            
        primary_industry = max(industry_probs, key=industry_probs.get)
        
        # Stage 2: Tech Specialization if applicable
        if primary_industry == "Technology & Software":
            tech_probs = {}
            for tech, centroid in self._tech_centroids.items():
                sim = self._cosine_similarity(cv_vec, centroid)
                tech_probs[tech] = float(sim)
            
            # Filter results with threshold
            filtered_tech = {k: v for k, v in tech_probs.items() if v > 0.3}
            return filtered_tech if filtered_tech else tech_probs

        return industry_probs

    def predict_domain(self, parsed_text: str, labels: list = None) -> Dict[str, float]:
        """
        Fallback method using Zero-shot for non-standard labels.
        """
        if self._classifier is None or not parsed_text:
            return {"Unknown": 1.0}
        
        # Use lighter zero-shot only if specifically requested with custom labels
        candidate_labels = labels if labels else list(self.DOMAIN_KNOWLEDGE_BANK.keys())
        
        try:
            result = self._classifier(
                parsed_text[:1500],
                candidate_labels=candidate_labels,
                multi_label=True
            )
            
            # Extract probabilities above a threshold
            domain_probs = {}
            for label, score in zip(result['labels'], result['scores']):
                if score >= 0.15: # Filter out low-confidence noise
                    domain_probs[label] = round(score, 4)
            
            # Sort and keep top 3
            sorted_probs = dict(sorted(domain_probs.items(), key=lambda item: item[1], reverse=True)[:3])
            
            # Fallback if nothing passed the threshold
            if not sorted_probs and result['labels']:
                sorted_probs[result['labels'][0]] = round(result['scores'][0], 4)
                
            return sorted_probs

        except Exception as e:
            logger.error(f"Zero-shot fallback failed: {e}")
            return {"Error": 1.0}
