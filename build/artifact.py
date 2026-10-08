#!/usr/bin/env python3
"""claude.ai 아티팩트용 묶음 만들기.

    python3 build/artifact.py OUT_DIR

index.html 을 아티팩트 규격에 맞게 바꾼다 — <!doctype>·<html>·<head>·<body> 태그를 없애고(게시할 때 도구가 감싼다),
CSS·JS 는 한 파일에 합친다(외부 CSS·JS 는 CSP 로 막히므로 inline). 위험분석표·허가서·포스터 페이지와 표본 사진은 그대로 복사한다.
카메라 페이지(camera.html)와 서버리스 함수(api/)는 아티팩트에서 쓸 수 없어 넣지 않는다.

OUT_DIR/index.html          → Artifact 도구의 file_path
OUT_DIR/ra.html 외 나머지   → Artifact 도구의 files (게시 경로 = OUT_DIR 기준 상대 경로)

아티팩트에서는 window.claude.use('mcp') 가 열려 assets/app.js 가 자동으로 Gmail 커넥터 모드(connInit)로 바뀐다.
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TITLE = "e-safety 안전문서 생성"
PAGES = ["ra.html", "ptw-c49.html", "ptw-gen.html", "poster.html"]


def inline_js(src: str) -> str:
    return src.replace("</script", "<\\/script")


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1)

    # 본문 끝의 <script src="assets/…"></script> 는 파일 내용으로 바꿔 넣는다
    def swap(m):
        return "<script>" + inline_js((ROOT / m.group(1)).read_text(encoding="utf-8")) + "</script>"
    body = re.sub(r'<script src="(assets/[^"]+\.js)"></script>', swap, body)

    fonts = re.search(r'<link href="(https://fonts\.googleapis\.com/[^"]+)" rel="stylesheet">', head)
    css = (ROOT / "assets/app.css").read_text(encoding="utf-8")
    page = (
        f"<title>{TITLE}</title>\n"
        + (f'<link href="{fonts.group(1)}" rel="stylesheet">\n' if fonts else "")
        + f"<style>\n{css}\n</style>\n"
        + body.strip() + "\n"
    )
    # 상대 경로 이미지(assets/…, samples/…)는 게시한 파일을 가리키므로 그대로 둔다
    (out / "index.html").write_text(page, encoding="utf-8")

    for name in PAGES:
        shutil.copy2(ROOT / name, out / name)
    for d in ("assets", "samples"):
        (out / d).mkdir(exist_ok=True)
        for f in sorted((ROOT / d).iterdir()):
            if f.is_file() and f.suffix not in (".js", ".css"):  # js·css 는 index.html 에 합쳤다
                shutil.copy2(f, out / d / f.name)
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print(f"{out} — index.html {len(page) // 1024}KB, 전체 {size // 1024}KB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
