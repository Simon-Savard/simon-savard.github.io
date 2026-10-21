#!/usr/bin/env bash
# Génère les vidéos légères (sans audio, 30 fps) et les posters des tuiles de projets.
# Usage : ./scripts/optimize-card-videos.sh <nom> <largeur> <hauteur>
#   ex. : ./scripts/optimize-card-videos.sh memoria 960 540
# Source : src/assets/video/<nom>.mp4 (l'original n'est jamais modifié)
set -euo pipefail
n=$1; w=${2:-960}; h=${3:-540}
mkdir -p src/assets/video/cards src/assets/images/cards
ffmpeg -y -i "src/assets/video/$n.mp4" -an \
  -vf "scale=$w:$h:flags=lanczos,fps=30" \
  -c:v libx264 -profile:v main -preset slow -crf 28 -pix_fmt yuv420p -movflags +faststart \
  "src/assets/video/cards/$n.mp4"
ffmpeg -y -ss 0.5 -i "src/assets/video/$n.mp4" -frames:v 1 \
  -vf "scale=$w:$h:flags=lanczos" -c:v libwebp -quality 75 \
  "src/assets/images/cards/$n.webp"
