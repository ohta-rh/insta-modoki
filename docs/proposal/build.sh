#!/bin/bash
# Renders proposal.html -> insta-modoki-proposal.pdf and page PNGs for QA
D="$(cd "$(dirname "$0")" && pwd)"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$D/insta-modoki-proposal.pdf" "file://$D/proposal.html" > "$D/build.log" 2>&1; echo "pdf rc=$?"
"$CH" --headless=new --disable-gpu --window-size=794,1123 --dump-dom "file://$D/proposal.html" 2>>"$D/build.log" | grep -o 'data-qa="[^"]*"'
mkdir -p "$D/png"; pdftoppm -r 80 -png "$D/insta-modoki-proposal.pdf" "$D/png/p"; echo "png rc=$?"
pdfinfo "$D/insta-modoki-proposal.pdf" | grep -E 'Pages|Page size|File size'
