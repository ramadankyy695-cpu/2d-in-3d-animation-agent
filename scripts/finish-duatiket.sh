#!/usr/bin/env bash
# Concatenate rendered picture chunks, burn the transparent subtitle layer over them and mux the final mix.
# Output: out/duatiket/Dia_Selalu_Membeli_Dua_Tiket.mp4 (1080x1920, 30 fps, H.264 + AAC 48 kHz) and a no-subtitle version.
set -euo pipefail
cd "$(dirname "$0")/.."
D=out/duatiket
ls $D/chunks/c_*.mp4 | sort | sed "s|^$D/chunks/|file '|; s|$|'|" > $D/chunks/list.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i $D/chunks/list.txt -c copy $D/picture.mp4
ffmpeg -loglevel error -y -i $D/picture.mp4 -i public/duatiket_mix.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart $D/Dia_Selalu_Membeli_Dua_Tiket_tanpa_subtitle.mp4
ffmpeg -loglevel error -y -i $D/picture.mp4 -i $D/subs_alpha.mov -i public/duatiket_mix.wav \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]" -map "[v]" -map 2:a:0 \
  -c:v libx264 -preset slow -crf 17 -profile:v high -pix_fmt yuv420p -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart \
  $D/Dia_Selalu_Membeli_Dua_Tiket.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,sample_rate:format=duration,size -of compact $D/Dia_Selalu_Membeli_Dua_Tiket.mp4
