# AI CV Analyzer Function Inventory

## `main.py`

| Class or Function | Purpose |
|---|---|
| `HybridMatchRequest` | Request schema for hybrid matching. |
| `_get_orchestrator` | Lazy-loads the CV orchestrator singleton. |
| `startup_event` | Initializes runtime state on FastAPI startup. |
| `health_check` | Health endpoint. |
| `metrics` | Metrics endpoint. |
| `_get_intelligent_matcher` | Lazy-loads Layer 3 matcher. |
| `hybrid_match` | Combines semantic/adaptive matching and TF-IDF fallback. |
| `analyze_cv` | Parse-CV endpoint wrapper. |
| `_process_with_timeout` | Runs file processing with timeout behavior. |
| `_is_image_filename` | Detects image uploads. |
| `process_file` | Chooses image/PDF handling and calls the orchestrator. |
| `_timeout_result` | Returns explicit timeout status payload. |
| `_error_result` | Returns explicit error status payload. |

## Layer 1

| File | Classes and Functions |
|---|---|
| `advanced_ner.py` | `NameCandidate`; `AdvancedNEREngine.__new__`, `_init_pipeline`, `is_available`, `_resolve_model_name`, `extract_entities`, `extract_candidate_name`; `_build_word_spans`, `_merge_ner_tokens`, `_clean_entity_text`, `_should_keep_skill`, `_dedupe_preserve_order`, `_looks_like_contact_line`, `_is_mostly_numeric_or_symbols`, `_normalize_name_candidate`. |
| `canonicalizer.py` | `CanonicalSkill`; `DataCanonicalizer.__init__`, `_precompute_canonical_embeddings`, `canonicalize_skills`, `canonicalize_skills_multi_source`, `dedupe_skills`, `_map_skill`, `_semantic_skill_match`; `_cosine_similarity_batch`, `_norm`. |
| `contact_extractor.py` | `_clean_phone`, `_clean_location`, `extract_contacts`. |
| `experience_engine.py` | `DateRange`; `ExperienceEngine.extract_date_ranges`, `calculate_total_experience_years`, `calculate_skill_durations`, `analyze_career_health`, `calculate_action_verb_score`, `_normalize_present`, `_parse_date_safe`; `_merge_date_ranges`. |
| `ocr_pipeline.py` | `extract_text_from_image`, `extract_images_from_pdf_bytes`. |
| `orchestrator.py` | `OrchestratorConfig`; `CVOrchestrator.__init__`, `process_cv`, `process_image_cv`, `_process_cv_unlocked`, `_should_trigger_ocr`, `_ocr_reason`, `_attempt_ocr_fallback`, `_run_nlp_pipeline`, `_empty_result`, `_normalize_seniority`, `_build_experience_items`, `_extract_block_technologies`, `_rank_current_title`; `_log_memory`, `_count_words`, `_aggregate_confidence`, `_filter_noise_skills`, `_infer_seniority`, `_looks_like_date_line`, `_clean_title_line`, `_extract_bullets`, `_fix_glued_text`, `_merge_best_ranges`. |
| `schema.py` | `StrictModel`, `ConfidenceItem`, `ContactInfo`, `Profile`, `DocumentStats`, `SkillItem`, `SkillsSection`, `ExperienceItem`, `ExperienceSection`, `AnalysisSection`, `CVParseResult`. |
| `section_segmenter.py` | `SectionBlock.text`, `SegmentationAnalysis`, `SegmentationResult`, `SemanticSegmenter.__init__`, `_precompute_reference_embeddings`, `segment`, `_detect_header`, `_semantic_header_match`; `_cosine_similarity_batch`, `_HeaderPatterns.__init__`, `compile`, `_normalize_to_lines`, `_normalize_header_candidate`, `_looks_like_bullet`, `_merge_blocks`. |
| `spatial_parser.py` | `SpatialTextExtraction.iter_lines`, `_Word.height`, `_Segment.center_y`, `_adaptive_column_cluster_ratio`, `extract_spatial_text_from_pdf`, `extract_ordered_text_from_pdf`, `_safe_plain_extract`, `_extract_words`, `_auto_row_tolerance`, `_group_words_into_rows`, `_split_rows_into_segments`, `_segment_from_words`, `_order_segments_by_columns_then_rows`, `_build_row_text`, `_dehyphenate_lines`. |
| `utils.py` | `load_layer1_config`. |

## Layer 2

| File | Classes and Functions |
|---|---|
| `classifier.py` | `CVDomainClassifier.__new__`, `__init__`, `classify`. |
| `domain_engine.py` | `DomainEngine.predict_domain`, `identify_tech_specialty`. |
| `orchestrator.py` | `ClassificationOrchestrator.enrich_cv_analysis`. |
| `seniority_engine.py` | `SeniorityEngine.analyze_seniority`, `_calculate_verb_strength`, `_predict_level_semantically`, `_resolve_level`. |
| `skill_engine.py` | `SkillEngine.categorize_skills`. |
| `utils.py` | `load_taxonomy`. |

## Layer 3

| File | Classes and Functions |
|---|---|
| `constraint_validator.py` | `ConstraintValidator.validate_constraints`, `_check_mandatory_skills`. |
| `embedder.py` | `SemanticEmbedder.__new__`, `_load_model`, `is_available`, `get_embedding`, `get_embeddings_batch`, `compute_similarity`. |
| `fit_analysis_generator.py` | `FitAnalysisGenerator.generate_report`, `_generate_summary`, `_identify_strengths`, `_identify_gaps`, `_identify_red_flags`, `_calculate_bonus_highlights`. |
| `job_description_engine.py` | `JobDescriptionEngine.parse_jd`, `_extract_seniority_and_years`, `_extract_skills`, `_heuristic_skill_extraction_single_line`, `_heuristic_skill_extraction`. |
| `ranking_orchestrator.py` | `RankingOrchestrator.rank_candidates`. |
| `similarity.py` | `IntelligentMatcher._load_config`, `calculate_match`, `_calculate_bonus_boost`. |
| `tfidf.py` | `tokenize`, `_term_frequency`, `_inverse_document_frequency`, `_vectorize`, `_cosine_similarity`, `match_score`. |

## Training, Scripts, and Tests

| Area | Functions or Entry Points |
|---|---|
| Training notebook | Loads cleaned dataset, defines labels, tokenizes with offsets, aligns BIO labels, builds `AutoModelForTokenClassification`, trains with `Trainer`, evaluates with seqeval metrics, exports `career_compass_ner_final`. |
| `generate_tech_dataset.py` | Synthetic generation loop, API-key/model rotation, validation of labeled examples, negative decoy generation. |
| `clean_dataset.py` | Text normalization, duplicate removal, span validation, long-skill filtering, cleaned dataset writing. |
| `scripts/verify_phase*.py` | Phase-specific diagnostic helpers for extraction, NER, classification, matching, and integration checks. |
| `tests/test_service_api.py` | Test cases for parse-CV status handling and hybrid-match behavior with fake components. |
| `tests/trace_cv.py` | `deep_trace_cv` helper for manual trace/debug output. |

## Function Inventory Conclusion

The function inventory shows that the analyzer is not a single black-box prediction call. It is a pipeline of API wrappers, parsing utilities, model inference, deterministic rules, taxonomy enrichment, constraint validation, and explanation generation.
