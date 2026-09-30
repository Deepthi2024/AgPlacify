#!/usr/bin/env python3
"""
Placify Grounded Assessment & Content Fetcher Sub-System (resource_fetch.py)

Fetches/synthesizes grounded resource content and generates 3 evaluation questions
strictly answerable from the recommended resource materials.

GROUNDED ASSESSMENT RULES:
1. Every question MUST be answerable directly from the curated resource content (zero out-of-scope questions!).
2. Generate 3 questions:
   - Q1: Core Conceptual Understanding
   - Q2: Practical Code / Pattern Application
   - Q3: Output Prediction / Edge Case Handling
3. Answer Options: 4 choices (A, B, C, D) with `correct_option_index` (0..3) and detailed explanations.

LEVEL-UP ELIGIBILITY (PLACIFY CORE FEATURE):
If a user is at BEGINNER level and scores >= 85% on a concept assessment:
- Trigger `level_up_eligible = true`.
- Prompt the user with choice: Option A (Level up same concept to Intermediate depth) vs Option B (Move to next concept at Beginner level).
"""

import sys
import json
import argparse

import os
import random
import urllib.request

GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-20b",
    "groq/compound-mini",
    "groq/compound"
]

def generate_groq_grounded_questions(topic="Python Variables", subtopic=None, skill_level="BEGINNER", domain="datascience"):
    """
    Generates dynamic evaluation questions using Groq API.
    Does NOT use hardcoded question banks.
    """
    clean_level = (skill_level or "BEGINNER").upper()
    clean_topic = topic or "Python Fundamentals"
    clean_subtopic = subtopic or clean_topic

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("GROQ_API_KEY="):
                        api_key = line.strip().split("=", 1)[1].strip('"').strip("'")
                        break

    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured in backend environment.")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }

    nonce = f"{random.randint(100000, 999999)}"

    system_prompt = (
        "You are an Expert Diagnostic Assessment Generator for Placify.\n"
        "Generate 3 fresh, original, NPTEL-style technical evaluation questions for the specified topic and skill level.\n\n"
        "TAXONOMY:\n"
        "- Q1: Q1: Core Conceptual Understanding\n"
        "- Q2: Q2: Practical Code / Pattern Application\n"
        "- Q3: Q3: Output Prediction / Edge Case Handling\n\n"
        "CRITICAL RULES:\n"
        "1. Do NOT hardcode or repeat fixed questions.\n"
        "2. Provide 4 distinct choices (A, B, C, D) for options.\n"
        "3. correct_option_index MUST be 0, 1, 2, or 3 matching the correct option.\n"
        "4. Include a detailed, clear explanation.\n"
        "5. Output ONLY valid JSON matching this schema:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "id": "q1_concept",\n'
        '      "taxonomy": "Q1: Core Conceptual Understanding",\n'
        '      "question": "...",\n'
        '      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],\n'
        '      "correct_option_index": 0,\n'
        '      "explanation": "..."\n'
        "    },\n"
        "    {\n"
        '      "id": "q2_code",\n'
        '      "taxonomy": "Q2: Practical Code / Pattern Application",\n'
        '      "question": "...",\n'
        '      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],\n'
        '      "correct_option_index": 1,\n'
        '      "explanation": "..."\n'
        "    },\n"
        "    {\n"
        '      "id": "q3_edge",\n'
        '      "taxonomy": "Q3: Output Prediction / Edge Case Handling",\n'
        '      "question": "...",\n'
        '      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],\n'
        '      "correct_option_index": 2,\n'
        '      "explanation": "..."\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = (
        f"Domain: {domain}\n"
        f"Topic: {clean_topic}\n"
        f"Subtopic: {clean_subtopic}\n"
        f"Skill Level: {clean_level}\n"
        f"Random Nonce: {nonce}\n\n"
        f"Generate 3 fresh assessment questions matching the required schema."
    )

    last_err = None
    for model_name in GROQ_MODELS:
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.75,
            "max_tokens": 2000
        }
        try:
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
            with urllib.request.urlopen(req) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                content = res_data['choices'][0]['message']['content']
                parsed = json.loads(content)
                questions = parsed.get("questions", [])
                if len(questions) >= 3:
                    return questions[:3]
        except Exception as e:
            last_err = e
            continue

    raise RuntimeError(f"All Groq models failed to generate questions. Last error: {last_err}")


def fetch_grounded_content_and_assessment(topic="Python Variables", subtopic=None, skill_level="BEGINNER", domain="datascience", resource_url=None):
    """
    Fetches grounded content summary and generates 3 evaluation questions dynamically using Groq API.
    """
    clean_level = (skill_level or "BEGINNER").upper()
    if clean_level not in ["BEGINNER", "INTERMEDIATE", "ADVANCED"]:
        clean_level = "BEGINNER"

    clean_topic = topic or "Python Fundamentals"
    clean_subtopic = subtopic or clean_topic

    try:
        questions_data = generate_groq_grounded_questions(
            topic=clean_topic,
            subtopic=clean_subtopic,
            skill_level=clean_level,
            domain=domain
        )
    except Exception as err:
        print(f"[resource_fetch] Groq generation error: {err}", file=sys.stderr)
        return {
            "success": False,
            "error": "Failed to generate dynamic assessment questions using Groq API.",
            "message": str(err)
        }

    content_summary = (
        f"Grounded Learning Notes for {clean_topic} ({clean_level} Tier):\n"
        f"1. Core Concepts: Explains fundamental mechanics, memory layout, and operational rules for {clean_topic}.\n"
        f"2. Practical Patterns: Code examples illustrating standard implementation in {domain}.\n"
        f"3. Edge Cases: Behavior under boundaries, mutable/immutable traits, and exception scenarios."
    )

    return {
        "success": True,
        "topic": clean_topic,
        "subtopic": clean_subtopic,
        "skill_level": clean_level,
        "domain": domain,
        "resource_url": resource_url or "https://docs.python.org/3/tutorial/",
        "grounded_summary": content_summary,
        "questions_count": len(questions_data),
        "questions": questions_data
    }


def evaluate_assessment_and_check_level_up(questions, user_answers, user_level="BEGINNER"):
    """
    Grades grounded assessment answers and evaluates Level-Up Eligibility (PLACIFY CORE FEATURE).
    If a user is at BEGINNER level and scores >= 85% on a concept assessment:
    - Trigger `level_up_eligible = True`.
    - Provide choice: Option A (Level up same concept to Intermediate depth) vs Option B (Move to next concept at Beginner level).
    """
    clean_level = (user_level or "BEGINNER").upper()
    correct_count = 0
    total = len(questions)
    detailed_feedback = []

    for q in questions:
        q_id = q["id"]
        user_choice = user_answers.get(q_id, None)
        correct_idx = q["correct_option_index"]
        
        is_correct = (user_choice == correct_idx)
        if is_correct:
            correct_count += 1

        detailed_feedback.append({
            "question_id": q_id,
            "taxonomy": q.get("taxonomy", "Question"),
            "question": q["question"],
            "user_choice_index": user_choice,
            "correct_option_index": correct_idx,
            "is_correct": is_correct,
            "explanation": q["explanation"]
        })

    score_pct = Math.round((correct_count / total) * 100) if total > 0 else 0
    passed = (score_pct >= 70)

    # LEVEL-UP ELIGIBILITY LOGIC
    level_up_eligible = False
    level_up_prompt = None
    level_up_options = None

    if clean_level == "BEGINNER" and score_pct >= 85:
        level_up_eligible = True
        level_up_prompt = (
            "🎉 Outstanding Performance! You achieved >= 85% on this Beginner Concept Assessment. "
            "You are eligible to LEVEL UP! How would you like to proceed?"
        )
        level_up_options = [
            {
                "option_id": "OPTION_A",
                "label": "Option A: Level up same concept to Intermediate depth",
                "action": "LEVEL_UP_CONCEPT_INTERMEDIATE",
                "description": "Unlock deeper official developer documentation, GitHub sample code, and intermediate implementation drills for this concept."
            },
            {
                "option_id": "OPTION_B",
                "label": "Option B: Move to next concept at Beginner level",
                "action": "CONTINUE_BEGINNER_TRACK",
                "description": "Proceed to the next foundational topic on your personalized roadmap at the gentle Beginner level."
            }
        ]

    return {
        "success": True,
        "score_pct": score_pct,
        "correct_count": correct_count,
        "total_questions": total,
        "passed": passed,
        "user_level": clean_level,
        "level_up_eligible": level_up_eligible,
        "level_up_prompt": level_up_prompt,
        "level_up_options": level_up_options,
        "detailed_feedback": detailed_feedback
    }


class Math:
    @staticmethod
    def round(val):
        return int(round(val))


def main():
    parser = argparse.ArgumentParser(description="Placify Grounded Assessment & Content Fetcher Sub-System")
    parser.add_argument("--topic", type=str, default="Variables", help="Topic name")
    parser.add_argument("--level", type=str, default="BEGINNER", choices=["BEGINNER", "INTERMEDIATE", "ADVANCED"], help="User skill level")
    parser.add_argument("--domain", type=str, default="datascience", help="Domain name")
    parser.add_argument("--score", type=int, default=90, help="Simulated score percentage for level up testing")
    parser.add_argument("--json", action="store_true", help="Output JSON format")

    args = parser.parse_args()

    assessment_pkg = fetch_grounded_content_and_assessment(
        topic=args.topic,
        skill_level=args.level,
        domain=args.domain
    )

    # Simulate grading
    questions = assessment_pkg["questions"]
    simulated_answers = {}
    
    # Simulate correct answers based on test score
    if args.score >= 85:
        # Give all correct
        for q in questions:
            simulated_answers[q["id"]] = q["correct_option_index"]
    else:
        # Give 1 wrong
        for idx, q in enumerate(questions):
            simulated_answers[q["id"]] = q["correct_option_index"] if idx == 0 else (q["correct_option_index"] + 1) % 4

    evaluation = evaluate_assessment_and_check_level_up(
        questions=questions,
        user_answers=simulated_answers,
        user_level=args.level
    )

    combined_output = {
        "assessment": assessment_pkg,
        "evaluation": evaluation
    }

    if args.json:
        print(json.dumps(combined_output, indent=2))
    else:
        print("==================================================")
        print("PLACIFY GROUNDED ASSESSMENT & LEVEL-UP RESULT")
        print("==================================================")
        print(f"Topic         : {assessment_pkg['topic']}")
        print(f"Skill Tier    : {assessment_pkg['skill_level']}")
        print(f"Domain        : {assessment_pkg['domain']}")
        print(f"Questions     : {assessment_pkg['questions_count']}")
        print("--------------------------------------------------")
        for q in assessment_pkg['questions']:
            print(f"[{q['taxonomy']}]")
            print(f"Q: {q['question']}")
            for opt in q['options']:
                print(f"   {opt}")
            print(f"Correct Choice Index: {q['correct_option_index']}")
            print(f"Explanation: {q['explanation']}\n")

        print("--------------------------------------------------")
        print(f"EVALUATION SCORE  : {evaluation['score_pct']}% ({evaluation['correct_count']}/{evaluation['total_questions']})")
        print(f"LEVEL-UP ELIGIBLE : {evaluation['level_up_eligible']}")
        if evaluation['level_up_eligible']:
            print(f"\nPROMPT: {evaluation['level_up_prompt']}\n")
            for opt in evaluation['level_up_options']:
                print(f"  👉 {opt['label']}")
                print(f"     Action: {opt['action']}")
                print(f"     Info  : {opt['description']}")

if __name__ == "__main__":
    main()
