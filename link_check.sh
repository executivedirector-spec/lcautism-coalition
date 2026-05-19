#!/bin/bash

# Check internal links
echo "=== CHECKING INTERNAL LINKS ==="

# Check from index.html (root links)
echo -e "\n=== LINKS FROM index.html (root-level) ==="
grep -o 'href=["\x27][^"'\'']*["\x27]' index.html | sort -u | while read href; do
  path=$(echo "$href" | sed 's/href=["\x27]\(.*\)["\x27]/\1/')
  if [[ "$path" =~ ^(http|https|mailto|tel|#|\s*$) ]]; then
    continue
  fi
  if [ ! -f "$path" ]; then
    echo "BROKEN: $path"
  fi
done

# Check from pages/*.html
echo -e "\n=== LINKS FROM pages/*.html ==="
for page in pages/*.html; do
  grep -o 'href=["\x27][^"'\'']*["\x27]' "$page" | sort -u | while read href; do
    path=$(echo "$href" | sed 's/href=["\x27]\(.*\)["\x27]/\1/')
    if [[ "$path" =~ ^(http|https|mailto|tel|#|\s*$) ]]; then
      continue
    fi
    # Resolve path relative to pages/ directory
    if [[ "$path" == ../* ]]; then
      resolved="${path#../}"
    else
      resolved="pages/$path"
    fi
    
    if [ ! -f "$resolved" ]; then
      echo "BROKEN in $page: $path -> $resolved"
    fi
  done
done

# Check img/src tags
echo -e "\n=== IMAGE SRC PATHS ==="
grep -oh 'src=["\x27][^"'\'']*["\x27]' pages/*.html index.html 2>/dev/null | sort -u | while read src; do
  path=$(echo "$src" | sed 's/src=["\x27]\(.*\)["\x27]/\1/')
  if [[ "$path" =~ ^(http|https|data:|\s*$) ]]; then
    continue
  fi
  # Check from index.html
  if [ ! -f "$path" ] && [ ! -f "pages/$path" ]; then
    echo "MISSING: $path"
  fi
done
