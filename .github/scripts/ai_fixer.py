import os
import subprocess
import google.genai as genai
from github import Github

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GITHUB_TOKEN   = os.environ["GITHUB_TOKEN"]
REPO_NAME      = os.environ["REPO_NAME"]
BRANCH_NAME    = os.environ["BRANCH_NAME"]
COMMIT_SHA     = os.environ["COMMIT_SHA"]

TARGET_EXTENSIONS = [".py", ".js", ".ts", ".dart", ".json"]
MAX_FILE_KB = 50


client = genai.Client(api_key=GEMINI_API_KEY)

def get_changed_files():
    all_files = []
    for root, dirs, files in os.walk("."):
        dirs[:] = [
            d for d in dirs
            if d not in [".git", "node_modules", "__pycache__", ".dart_tool", "build", ".flutter-plugins"]
        ]
        for file in files:
            filepath = os.path.join(root, file).lstrip("./")
            if (
                any(filepath.endswith(ext) for ext in TARGET_EXTENSIONS)
                and os.path.exists(filepath)
                and os.path.getsize(filepath) < MAX_FILE_KB * 1024
            ):
                all_files.append(filepath)
    return all_files

def fix_file_with_ai(filepath: str):
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    if not content.strip():
        return None
    prompt = f"""
أنت Senior Software Engineer. مهمتك:
1. افحص الكود التالي من الملف: `{filepath}`
2. صلح أي مشاكل: syntax errors, logical bugs, security issues, deprecated APIs
3. حسّن الكود لو في best practices واضحة مفقودة
4. ارجع الكود المصحح فقط، بدون شرح، بدون markdown backticks
5. لو الكود صح ومفيش أي تغيير مطلوب، ارجع النص: NO_CHANGES_NEEDED

الكود:
{content}
"""
    try:
        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        result = response.text.strip()
        if "NO_CHANGES_NEEDED" in result:
            return None
        if result.startswith("```"):
            lines = result.split("\n")
            result = "\n".join(lines[1:-1])
        return result
    except Exception as e:
        print(f"⚠️ Gemini error for {filepath}: {e}")
        return None

def apply_fixes(files: list) -> list:
    fixed = []
    for filepath in files:
        print(f"🔍 فحص: {filepath}")
        fixed_content = fix_file_with_ai(filepath)
        if fixed_content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(fixed_content)
            print(f"✅ تم تصحيح: {filepath}")
            fixed.append(filepath)
        else:
            print(f"⏭️ مفيش تغييرات: {filepath}")
    return fixed

if __name__ == "__main__":
    print("🚀 AI Auto-Fix Agent بدأ...")
    changed = get_changed_files()
    if not changed:
        print("✅ مفيش ملفات.")
        exit(0)
    print(f"\n📁 الملفات: {changed}\n")
    fixed = apply_fixes(changed)
    if fixed:
        print(f"\n🎯 تم تصحيح {len(fixed)} ملف: {fixed}")
    else:
        print("\n✅ الكود سليم.")
