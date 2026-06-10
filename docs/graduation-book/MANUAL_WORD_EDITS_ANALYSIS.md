# Manual Word Edits Analysis

**Manual edited DOCX analyzed:** `docs/graduation-book/CareerCompass_Graduation_Project_Book.docx`  
**Generated baseline compared:** `docs/graduation-book/CareerCompass_Graduation_Project_Book.pre_manual_edits.docx` (extracted from commit `1251c32`, immediately before commit `0f11010` manual asset update)  
**Backup copy:** `docs/graduation-book/CareerCompass_Graduation_Project_Book.manual_word_edits_backup.docx`  
**Checkpoint:** branch `checkpoint/before-syncing-manual-word-edits`, tag `checkpoint-before-syncing-manual-word-edits`

## Summary

The manual Word session changed layout and presentation only. Technical wording, ERD fields, recommendation/gap-analysis claims, and chapter content were not intentionally edited. The main reproducible changes are:

1. Tighter page margins
2. Cover-page project logo and title/subtitle split
3. Centered data tables
4. Additional page breaks before selected sections and between dense figure/table/API-example blocks

## Detected Changes

| # | What changed | Where | Confidence | Preserve in generator? | Generator target |
|---|--------------|-------|------------|------------------------|------------------|
| 1 | Top margin `2.2 cm` -> `1.0 cm` | Document section | High | Yes | `set_doc_defaults()` |
| 2 | Bottom margin `2.2 cm` -> `0.75 cm` | Document section | High | Yes | `set_doc_defaults()` |
| 3 | Footer distance `1.27 cm` -> `0.51 cm` | Document section | High | Yes | `set_doc_defaults()` |
| 4 | Left/right margins unchanged at `~2.2 cm` | Document section | High | Yes | No change needed |
| 5 | Project logo added on cover (`CC_Logo.png`, ~1.38 in) | Cover, after academic year | High | Yes | `add_cover()`, `add_pdf_cover()` |
| 6 | Cover title split: `CareerCompass` + subtitle line; removed duplicate short-name line | Cover | High | Yes | `add_cover()`, `add_pdf_cover()` |
| 7 | All 124 data tables centered (`w:jc center`) | Body tables | High | Yes | `add_md_table_docx()`, `add_code_block_docx()` |
| 8 | Cover layout tables remain centered | Cover only | High | Already centered | `add_cover()` |
| 9 | 42 additional explicit page breaks | Front matter, chapters, appendices | High | Yes | `PAGE_BREAK_BEFORE_HEADINGS`, markdown `\pagebreak`, `generate_docx()` continuation rules |
| 10 | Page breaks before selected `##` / `###` sections | 1.6, 2.7, 2.8, 3.7, 5.5.5, 5.17, 6.4, 8.21, appendices, evaluation subsections | High | Yes | `PAGE_BREAK_BEFORE_HEADINGS` |
| 11 | Page breaks after figures when followed by tables | Ch. 3, 5, 6, 7 | High | Yes | `generate_docx()` `last_block == "image"` rule |
| 12 | Page breaks between adjacent tables in a few dense sections | Ch. 8 manual matrix, appendix API examples | Medium | Yes | `generate_docx()` table-after-table / appendix continuation rules |
| 13 | Page breaks after selected figures/paragraphs before next section | Figures 16, 64; Table 6; Table 44; LLM comparison paragraph; semantic-matching paragraph | Medium-High | Yes | explicit `\pagebreak` in `report_markdown()` |
| 14 | `lastRenderedPageBreak` noise from Word save | Throughout | Low | No | Ignore; not part of authored layout |
| 15 | Footnotes/endnotes XML parts added by Word | Package | Low | No | Ignore |

## Page Break Detail

Baseline explicit page breaks: **21** (matches existing markdown `\pagebreak` markers).  
Manual explicit page breaks: **62**.  
Net manual additions encoded by generator rules: **42**.

Key manual-only break patterns:

- Before major subsection headings listed in `PAGE_BREAK_BEFORE_HEADINGS`
- After a figure when the next block is a markdown table
- After one table when the next block is another table or appendix continuation text (`Method and URL`, `Response example`, etc.)
- After selected captions/paragraphs called out in markdown

Chapter-level breaks (`Chapter 1` through `Chapter 10`) were already present in the generator and were not changed.

## Figures and Styles

- Figure image sizes and caption placement were not materially changed in the manual edit pass; spacing improvements came mainly from page breaks and margins.
- Heading style definitions were unchanged; manual spacing tweaks were achieved with page breaks rather than style edits.
- Normal style direct formatting differed only because Word re-saved the document; generator style defaults remain the source of truth.

## Implementation Plan

1. Update margin/footer constants in `set_doc_defaults()`
2. Update cover layout and PDF cover to insert `assets/logos/CC_Logo.png`
3. Center all generated data/code tables
4. Add `PAGE_BREAK_BEFORE_HEADINGS`
5. Add `generate_docx()` block-transition rules for figure->table, table->table, and appendix continuation lines
6. Add targeted `\pagebreak` markers in `report_markdown()` where block-transition rules are insufficient
7. Regenerate MD/DOCX/PDF and compare against the manual backup DOCX

## Risks

- Word may still insert `lastRenderedPageBreak` markers on open/save; comparison should use explicit `w:br type="page"` only.
- Exact page counts may differ slightly between Word versions after regeneration.
- Visual spacing around very long tables may still need a final human pass in Word before printing.
