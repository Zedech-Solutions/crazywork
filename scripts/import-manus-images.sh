#!/bin/bash
# Pulls the original CRAZYWORK imagery (Manus storage + CloudFront) into the new app.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/images/manus

SITE="https://crazywear-jioq6vwp.manus.space"
CDN="https://d2xsxph8kpxj0f.cloudfront.net/310519663457490713/Jioq6VWPwBV27XmzrK4UUB"

curl -fsSL "$SITE/manus-storage/ChatGPTImageJun1,2026,10_23_09PM_9ec35a17.png" -o public/images/manus/hero.png
curl -fsSL "$SITE/manus-storage/CWWebsiteImage3_d1e7bbb9.JPG" -o public/images/manus/cw-3.jpg
curl -fsSL "$CDN/mindset-bg-UyhSf4F5V5nvC6v5pH6hcn.webp" -o public/images/manus/mindset-bg.webp
curl -fsSL "$CDN/lifestyle-1-BwxnRYPSHdq6RYAaLEqYZK.webp" -o public/images/manus/lifestyle-1.webp
curl -fsSL "$CDN/hero-main-oP6vk3ZGHTGhQQTR3hegnK.webp" -o public/images/manus/hero-main.webp
curl -fsSL "$CDN/hero-product-CTdDoU9he6p5awRMwqJ4ng.webp" -o public/images/manus/hero-product.webp

echo "--- imported: ---"
ls -la public/images/manus
