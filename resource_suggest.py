#!/usr/bin/env python3
"""
Placify Level-Specific Resource Suggester (resource_suggest.py)

Curates learning resources strictly matching the user's skill level (BEGINNER, INTERMEDIATE, or ADVANCED)
across Placify's 8 tech domains.

LEVEL-BASED CURATION RULES:
1. BEGINNER Tier:
   - Visual sandboxes, "Explain Like I'm 5" guides, interactive video tutorials (Scrimba, FreeCodeCamp visualizers).
   - High hand-holding, gentle learning curve.
2. INTERMEDIATE Tier:
   - Official developer documentation, practical GitHub sample repositories, real-world project walkthroughs.
   - Practical implementation focus.
3. ADVANCED Tier:
   - System architecture blueprints, internal RFC specs, low-level source code breakdowns, performance profiling guides.
   - High density, production trade-offs.
"""

import sys
import json
import argparse

# Comprehensive Curated Resource Database mapped by Domain, Topic Keyword, and Skill Level Tier
RESOURCE_DATABASE = {
    "datascience": {
        "variables": {
            "BEGINNER": [
                {
                    "resource_id": "ds_var_beg_1",
                    "category_label": "INTERACTIVE_SANDBOX",
                    "title": "Explain Like I'm 5: Python Variables & Primitive Data Types Visualizer",
                    "platform": "FreeCodeCamp Visualizer",
                    "url": "https://pythontutor.com/visualize.html#mode=edit",
                    "resource_type": "VISUAL_SANDBOX",
                    "description": "Step-by-step visual sandbox illustrating memory allocation, variable assignment, and primitive data types with high hand-holding.",
                    "recommended_section": "Visualizing Variable Assignment & Memory Pointer Sandbox",
                    "relevance_reason": "Ideal gentle learning curve with step-by-step visual execution for Python beginners.",
                    "is_official": False,
                    "difficulty": "BEGINNER",
                    "hand_holding_level": "HIGH"
                },
                {
                    "resource_id": "ds_var_beg_2",
                    "category_label": "VISUAL_GUIDE",
                    "title": "Interactive Scrimba Tutorial: Python Data Types ELI5 Guide",
                    "platform": "Scrimba",
                    "url": "https://scrimba.com/learn/python",
                    "resource_type": "INTERACTIVE_VIDEO",
                    "description": "Interactive video screencast where you can pause, edit code, and inspect variables live in the browser.",
                    "recommended_section": "Module 1: Variables, Strings, Integers & Floats Explained Simply",
                    "relevance_reason": "Interactive video format providing immediate feedback and ELI5 clarity.",
                    "is_official": False,
                    "difficulty": "BEGINNER",
                    "hand_holding_level": "HIGH"
                }
            ],
            "INTERMEDIATE": [
                {
                    "resource_id": "ds_var_int_1",
                    "category_label": "OFFICIAL_DOCS",
                    "title": "Python Official Documentation: Built-in Data Types & Data Structures Spec",
                    "platform": "Python.org",
                    "url": "https://docs.python.org/3/library/stdtypes.html",
                    "resource_type": "DOCUMENTATION",
                    "description": "Official reference manual detailing immutable vs mutable types, memory overhead, and type conversion mechanics.",
                    "recommended_section": "Section 4.4: Numeric Types & Sequence Types Methods",
                    "relevance_reason": "Authoritative Python developer documentation for practical implementation.",
                    "is_official": True,
                    "difficulty": "INTERMEDIATE",
                    "hand_holding_level": "PRACTICAL"
                },
                {
                    "resource_id": "ds_var_int_2",
                    "category_label": "SAMPLE_REPO",
                    "title": "Practical GitHub Walkthrough: Pythonic Type Annotations & Data Structures Patterns",
                    "platform": "GitHub Sample Repositories",
                    "url": "https://github.com/realpython/python-guide",
                    "resource_type": "GITHUB_REPO",
                    "description": "Real-world repository showcasing type hints, dataclasses, memory layout optimization, and production patterns.",
                    "recommended_section": "samples/data_structures_best_practices.py",
                    "relevance_reason": "Concrete code samples for building clean, maintainable Python backend modules.",
                    "is_official": False,
                    "difficulty": "INTERMEDIATE",
                    "hand_holding_level": "PRACTICAL"
                }
            ],
            "ADVANCED": [
                {
                    "resource_id": "ds_var_adv_1",
                    "category_label": "SOURCE_BREAKDOWN",
                    "title": "CPython Internal Source Breakdown: PyObject Structure & Memory Layout (cpython/Objects)",
                    "platform": "CPython Internal GitHub",
                    "url": "https://github.com/python/cpython/blob/main/Objects/object.c",
                    "resource_type": "SOURCE_CODE_BREAKDOWN",
                    "description": "Low-level C breakdown of reference counting (ob_refcnt), type objects (ob_type), integer caching (-5 to 256), and memory allocation.",
                    "recommended_section": "CPython PyObject Header Definition & Small Integer Cache Mechanics",
                    "relevance_reason": "Deep low-level breakdown of Python internals and memory management trade-offs.",
                    "is_official": True,
                    "difficulty": "ADVANCED",
                    "hand_holding_level": "LOW_LEVEL"
                },
                {
                    "resource_id": "ds_var_adv_2",
                    "category_label": "PERFORMANCE_PROFILING",
                    "title": "Python Performance Profiling Guide: Memory Overhead & Garbage Collection Tracing",
                    "platform": "Python Architecture Specs",
                    "url": "https://docs.python.org/3/library/tracemalloc.html",
                    "resource_type": "PROFILING_GUIDE",
                    "description": "High-density guide to tracing heap allocations using tracemalloc, sys.getsizeof, and optimizing CPyObject overhead in production.",
                    "recommended_section": "Analyzing Memory Leaks and Heap Footprint in High-Throughput Services",
                    "relevance_reason": "Production trade-off analysis and low-level profiling techniques.",
                    "is_official": True,
                    "difficulty": "ADVANCED",
                    "hand_holding_level": "LOW_LEVEL"
                }
            ]
        },
        "default": {
            "BEGINNER": [
                {
                    "resource_id": "ds_def_beg_1",
                    "category_label": "INTERACTIVE_SANDBOX",
                    "title": "Data Science ELI5 Visual Guide & FreeCodeCamp Interactive Sandbox",
                    "platform": "FreeCodeCamp Visualizers",
                    "url": "https://www.freecodecamp.org/learn/data-analysis-with-python/",
                    "resource_type": "VISUAL_SANDBOX",
                    "description": "Step-by-step visual sandbox with high hand-holding covering core Data Science concepts.",
                    "recommended_section": "Interactive Data Analysis Fundamentals",
                    "relevance_reason": "Beginner-friendly visual learning curve.",
                    "is_official": False,
                    "difficulty": "BEGINNER",
                    "hand_holding_level": "HIGH"
                }
            ],
            "INTERMEDIATE": [
                {
                    "resource_id": "ds_def_int_1",
                    "category_label": "OFFICIAL_DOCS",
                    "title": "Pandas & Scikit-Learn Official Developer Documentation & Walkthroughs",
                    "platform": "Official Developer Documentation",
                    "url": "https://pandas.pydata.org/docs/user_guide/index.html",
                    "resource_type": "DOCUMENTATION",
                    "description": "Practical implementation documentation and real-world project repository walkthroughs.",
                    "recommended_section": "Core User Guide & DataFrame API Overview",
                    "relevance_reason": "Applied developer documentation for real-world project building.",
                    "is_official": True,
                    "difficulty": "INTERMEDIATE",
                    "hand_holding_level": "PRACTICAL"
                }
            ],
            "ADVANCED": [
                {
                    "resource_id": "ds_def_adv_1",
                    "category_label": "ARCHITECTURE_BLUEPRINT",
                    "title": "Distributed ML Pipeline Architecture Blueprint & Low-Level Source Breakdown",
                    "platform": "System Architecture RFC Specs",
                    "url": "https://github.com/scikit-learn/scikit-learn",
                    "resource_type": "SYSTEM_BLUEPRINT",
                    "description": "System architecture blueprints, C-extensions breakdown, and performance profiling guide.",
                    "recommended_section": "Internal C-Extensions & Matrix Computation Profiling",
                    "relevance_reason": "High-density technical specs and production trade-offs.",
                    "is_official": True,
                    "difficulty": "ADVANCED",
                    "hand_holding_level": "LOW_LEVEL"
                }
            ]
        }
    },
    "fullstack": {
        "default": {
            "BEGINNER": [
                {
                    "resource_id": "fs_beg_1",
                    "category_label": "INTERACTIVE_SANDBOX",
                    "title": "Web Development ELI5: Scrimba Visual Sandbox & FreeCodeCamp Visualizer",
                    "platform": "Scrimba / FreeCodeCamp",
                    "url": "https://scrimba.com/learn/frontend",
                    "resource_type": "VISUAL_SANDBOX",
                    "description": "Interactive visual sandbox with high hand-holding for web fundamentals.",
                    "recommended_section": "Interactive HTML/CSS & JS Live Sandbox",
                    "relevance_reason": "Gentle learning curve for web development beginners.",
                    "is_official": False,
                    "difficulty": "BEGINNER",
                    "hand_holding_level": "HIGH"
                }
            ],
            "INTERMEDIATE": [
                {
                    "resource_id": "fs_int_1",
                    "category_label": "OFFICIAL_DOCS",
                    "title": "MDN Web Docs & React.dev Official Developer Documentation",
                    "platform": "MDN Web Docs",
                    "url": "https://developer.mozilla.org/en-US/docs/Learn",
                    "resource_type": "DOCUMENTATION",
                    "description": "Official documentation, practical GitHub sample repositories, and real-world project walkthroughs.",
                    "recommended_section": "Developer Guide & Practical Implementation Patterns",
                    "relevance_reason": "Comprehensive developer reference for practical implementation.",
                    "is_official": True,
                    "difficulty": "INTERMEDIATE",
                    "hand_holding_level": "PRACTICAL"
                }
            ],
            "ADVANCED": [
                {
                    "resource_id": "fs_adv_1",
                    "category_label": "ARCHITECTURE_BLUEPRINT",
                    "title": "V8 Engine Internal Architecture Blueprint & React Fiber RFC Spec",
                    "platform": "V8 / React Architecture RFCs",
                    "url": "https://v8.dev/blog",
                    "resource_type": "SYSTEM_BLUEPRINT",
                    "description": "Low-level source code breakdowns, V8 JIT compiler specs, and performance profiling guides.",
                    "recommended_section": "V8 TurboFan JIT Optimizer & Garbage Collector Breakdown",
                    "relevance_reason": "Low-level architecture analysis and production trade-offs.",
                    "is_official": True,
                    "difficulty": "ADVANCED",
                    "hand_holding_level": "LOW_LEVEL"
                }
            ]
        }
    }
}


def canonicalize_domain(domain_str):
    """Normalize input domain string into standard domain keys."""
    if not domain_str:
        return "fullstack"
    d = str(domain_str).lower()
    if "data" in d or "ds" in d or "ml" in d or "machine" in d:
        return "datascience"
    if "cyber" in d or "sec" in d:
        return "cybersecurity"
    if "dsa" in d or "algo" in d or "struct" in d:
        return "dsa"
    if "devops" in d or "cloud" in d:
        return "devops"
    if "mobile" in d or "flutter" in d:
        return "mobile"
    if "ai" in d or "llm" in d:
        return "ai_llm"
    if "system" in d or "design" in d:
        return "system_design"
    return "fullstack"


def canonicalize_level(level_str):
    """Normalize skill level string into BEGINNER, INTERMEDIATE, or ADVANCED."""
    if not level_str:
        return "BEGINNER"
    lvl = str(level_str).upper()
    if "ADV" in lvl or "HIGH" in lvl or "EXP" in lvl:
        return "ADVANCED"
    if "INT" in lvl or "MID" in lvl or "MED" in lvl:
        return "INTERMEDIATE"
    return "BEGINNER"


def suggest_resources(topic, subtopic=None, skill_level="BEGINNER", domain="fullstack", task_type="LEARN"):
    """
    Curates learning resources strictly matching the user's skill level (BEGINNER, INTERMEDIATE, or ADVANCED)
    and level-based curation rules.
    """
    domain_key = canonicalize_domain(domain)
    clean_level = canonicalize_level(skill_level)
    clean_topic = topic or "Core Fundamentals"
    clean_subtopic = subtopic or clean_topic

    # Lookup in catalog or generate level-specific fallback
    domain_dict = RESOURCE_DATABASE.get(domain_key, RESOURCE_DATABASE["fullstack"])
    
    topic_key = "default"
    t_lower = (clean_topic + " " + clean_subtopic).lower()
    if "variable" in t_lower or "data type" in t_lower or "primitive" in t_lower:
        topic_key = "variables"

    topic_entry = domain_dict.get(topic_key, domain_dict.get("default", RESOURCE_DATABASE["fullstack"]["default"]))
    resources = topic_entry.get(clean_level, None)

    if not resources:
        # Generate dynamic level-specific resources matching Level Rules
        if clean_level == "BEGINNER":
            resources = [
                {
                    "resource_id": f"gen_{domain_key}_beg_1",
                    "category_label": "INTERACTIVE_SANDBOX",
                    "title": f"Visual Sandbox & ELI5 Guide: {clean_topic} Explained Simply",
                    "platform": "FreeCodeCamp Visualizers / Scrimba",
                    "url": "https://pythontutor.com/visualize.html",
                    "resource_type": "VISUAL_SANDBOX",
                    "description": f"Interactive visual sandbox for {clean_topic} featuring high hand-holding, ELI5 breakdowns, and step-by-step visualization.",
                    "recommended_section": f"Visual Learning Sandbox: {clean_topic}",
                    "relevance_reason": f"High hand-holding and gentle learning curve tailored for BEGINNER level in {domain_key.upper()}.",
                    "is_official": False,
                    "difficulty": "BEGINNER",
                    "hand_holding_level": "HIGH"
                },
                {
                    "resource_id": f"gen_{domain_key}_beg_2",
                    "category_label": "VISUAL_GUIDE",
                    "title": f"Interactive Video Tutorial: {clean_topic} Live Code Walkthrough",
                    "platform": "Scrimba",
                    "url": "https://scrimba.com",
                    "resource_type": "INTERACTIVE_VIDEO",
                    "description": f"Interactive screencast for {clean_topic} allowing live code editing in the browser window.",
                    "recommended_section": f"Interactive Drills: {clean_topic}",
                    "relevance_reason": "Interactive video tutorial with step-by-step guidance.",
                    "is_official": False,
                    "difficulty": "BEGINNER",
                    "hand_holding_level": "HIGH"
                }
            ]
        elif clean_level == "INTERMEDIATE":
            resources = [
                {
                    "resource_id": f"gen_{domain_key}_int_1",
                    "category_label": "OFFICIAL_DOCS",
                    "title": f"Official Developer Documentation: {clean_topic} Reference",
                    "platform": "Official Developer Docs",
                    "url": "https://docs.python.org/3/tutorial/",
                    "resource_type": "DOCUMENTATION",
                    "description": f"Official documentation and practical guide detailing API mechanics and standard implementation for {clean_topic}.",
                    "recommended_section": f"Section: {clean_topic} Implementation Details",
                    "relevance_reason": f"Practical developer documentation focusing on real-world implementation for INTERMEDIATE level.",
                    "is_official": True,
                    "difficulty": "INTERMEDIATE",
                    "hand_holding_level": "PRACTICAL"
                },
                {
                    "resource_id": f"gen_{domain_key}_int_2",
                    "category_label": "SAMPLE_REPO",
                    "title": f"Practical GitHub Repository Walkthrough: {clean_topic} Production Patterns",
                    "platform": "GitHub Sample Repositories",
                    "url": "https://github.com",
                    "resource_type": "GITHUB_REPO",
                    "description": f"Real-world sample repository with runnable code and modular project architecture for {clean_topic}.",
                    "recommended_section": f"samples/{clean_topic.lower().replace(' ', '_')}_demo.py",
                    "relevance_reason": "Practical code patterns and real-world project walkthrough.",
                    "is_official": False,
                    "difficulty": "INTERMEDIATE",
                    "hand_holding_level": "PRACTICAL"
                }
            ]
        else: # ADVANCED
            resources = [
                {
                    "resource_id": f"gen_{domain_key}_adv_1",
                    "category_label": "ARCHITECTURE_BLUEPRINT",
                    "title": f"System Architecture Blueprint & RFC Spec: Low-Level {clean_topic}",
                    "platform": "Architecture Specs & RFCs",
                    "url": "https://github.com",
                    "resource_type": "SYSTEM_BLUEPRINT",
                    "description": f"High-density system blueprint, internal RFC specifications, and low-level source code breakdown for {clean_topic}.",
                    "recommended_section": f"Internal Engine Architecture & Trade-Off Analysis: {clean_topic}",
                    "relevance_reason": f"High density technical breakdown and production trade-offs tailored for ADVANCED tier.",
                    "is_official": True,
                    "difficulty": "ADVANCED",
                    "hand_holding_level": "LOW_LEVEL"
                },
                {
                    "resource_id": f"gen_{domain_key}_adv_2",
                    "category_label": "PERFORMANCE_PROFILING",
                    "title": f"Low-Level Performance Profiling & Source Code Breakdown: {clean_topic}",
                    "platform": "Internal Source Breakdown",
                    "url": "https://github.com",
                    "resource_type": "PROFILING_GUIDE",
                    "description": f"Low-level C/C++ source code analysis, memory footprint profiling, and bottleneck analysis for {clean_topic}.",
                    "recommended_section": f"Profiling Heap Allocations & Execution Hotspots",
                    "relevance_reason": "Deep low-level source breakdown and profiling guide.",
                    "is_official": True,
                    "difficulty": "ADVANCED",
                    "hand_holding_level": "LOW_LEVEL"
                }
            ]

    return {
        "success": True,
        "topic": clean_topic,
        "subtopic": clean_subtopic,
        "domain": domain_key,
        "requested_level": clean_level,
        "task_type": task_type,
        "resources_count": len(resources),
        "resources": resources
    }


def main():
    parser = argparse.ArgumentParser(description="Placify Level-Specific Resource Suggester Sub-System")
    parser.add_argument("--topic", type=str, default="Python Variables & Primitive Data Types", help="Topic name")
    parser.add_argument("--subtopic", type=str, default="Variables", help="Subtopic name")
    parser.add_argument("--level", type=str, default="BEGINNER", choices=["BEGINNER", "INTERMEDIATE", "ADVANCED"], help="User skill level")
    parser.add_argument("--domain", type=str, default="datascience", help="Domain name (e.g. datascience, fullstack)")
    parser.add_argument("--task-type", type=str, default="LEARN", help="Task type")
    parser.add_argument("--json", action="store_true", help="Format output as JSON")

    args = parser.parse_args()

    result = suggest_resources(
        topic=args.topic,
        subtopic=args.subtopic,
        skill_level=args.level,
        domain=args.domain,
        task_type=args.task_type
    )

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("==================================================")
        print("PLACIFY LEVEL-SPECIFIC RESOURCE SUGGESTER RESULT")
        print("==================================================")
        print(f"Domain         : {result['domain']}")
        print(f"Topic          : {result['topic']}")
        print(f"Skill Tier     : {result['requested_level']}")
        print(f"Resources Count: {result['resources_count']}")
        print("--------------------------------------------------")
        for idx, res in enumerate(result['resources'], 1):
            print(f"[{idx}] {res['category_label']}: {res['title']}")
            print(f"    Platform    : {res['platform']}")
            print(f"    URL         : {res['url']}")
            print(f"    Type        : {res['resource_type']}")
            print(f"    Hand-Holding: {res['hand_holding_level']}")
            print(f"    Section     : {res['recommended_section']}")
            print(f"    Reason      : {res['relevance_reason']}")
            print()

if __name__ == "__main__":
    main()
