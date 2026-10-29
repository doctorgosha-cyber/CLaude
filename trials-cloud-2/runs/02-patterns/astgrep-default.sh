#!/usr/bin/env bash
# ast-grep "defaults": ad-hoc one-line patterns a developer would type (no config, no constraints).
# Usage: astgrep-default.sh <dir>  -> merged JSON on stdout
DIR="${1:-.}"
SG="${SG:-ast-grep}"
{
for p in 'eval($X)' '$EL.innerHTML = $X' 'new Function($$$)' 'document.write($X)' 'setTimeout($A, $B)'; do
  "$SG" run -p "$p" -l js --json=compact "$DIR"
done
for p in 'echo $_GET[$K]' '$wpdb->query($S)' '$wpdb->get_results($S)'; do
  "$SG" run -p "$p" -l php --json=compact "$DIR"
done
} | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const all=[];for(const chunk of s.split(/\n(?=\[)/))if(chunk.trim())all.push(...JSON.parse(chunk));console.log(JSON.stringify(all))})'
