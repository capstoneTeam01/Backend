#!/usr/bin/env python3
"""
YOLOv8 instance segmentation → pipe outline polygon (normalized 0–1).

Usage:
  python segment.py /path/to/image.jpg [--model /path/to/pipe-seg.pt] [--mode auto|yolo|edges]

Output: JSON on stdout
  { "issueOutline": [...], "issueRegion": {...}, "detectedObject": "pipe", "source": "yolo"|"edges" }
"""

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

PIPE_CLASS_KEYWORDS = ("pipe", "plumb", "faucet", "drain", "toilet", "sink", "coupler", "lpipe", "tpipe")


def clamp01(value):
    return max(0.0, min(1.0, float(value)))


def contour_to_outline(contour, img_w, img_h, max_points=48):
    if contour is None or len(contour) < 4:
        return None

    epsilon = 0.0025 * cv2.arcLength(contour, True)
    simplified = cv2.approxPolyDP(contour, epsilon, True)

    if len(simplified) < 4:
        simplified = contour

    step = max(1, len(simplified) // max_points)
    points = simplified[::step]

    outline = [
        {"x": clamp01(p[0][0] / img_w), "y": clamp01(p[0][1] / img_h)}
        for p in points
    ]

    return outline if len(outline) >= 4 else None


def outline_to_region(outline):
    xs = [p["x"] for p in outline]
    ys = [p["y"] for p in outline]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    return {
        "x": min_x,
        "y": min_y,
        "width": max(0.01, max_x - min_x),
        "height": max(0.01, max_y - min_y),
    }


def estimate_brightness(image_path):
    image = cv2.imread(str(image_path))
    if image is None:
        return None

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return round(float(gray.mean()) / 255.0, 3)


def detect_with_yolo(image_path, model_path):
    from ultralytics import YOLO

    model = YOLO(str(model_path))
    results = model.predict(str(image_path), conf=0.2, verbose=False)
    result = results[0]

    if result.masks is None or len(result.masks.data) == 0:
        return None

    img_h, img_w = result.orig_shape

    best_idx = None
    best_score = -1.0

    for i in range(len(result.masks.data)):
        cls_id = int(result.boxes.cls[i])
        name = result.names[cls_id].lower()
        conf = float(result.boxes.conf[i])
        mask = result.masks.data[i].cpu().numpy()
        area = float(mask.sum())

        keyword_match = any(key in name for key in PIPE_CLASS_KEYWORDS)
        score = area * conf * (3.0 if keyword_match else 1.0)

        if score > best_score:
            best_score = score
            best_idx = i

    if best_idx is None:
        best_idx = 0

    mask_small = result.masks.data[best_idx].cpu().numpy()
    mask_resized = cv2.resize(mask_small, (img_w, img_h), interpolation=cv2.INTER_LINEAR)
    binary = (mask_resized > 0.5).astype(np.uint8) * 255

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    largest = max(contours, key=cv2.contourArea)
    outline = contour_to_outline(largest, img_w, img_h)

    if not outline:
        return None

    cls_id = int(result.boxes.cls[best_idx])
    label = result.names[cls_id]

    return {
        "issueOutline": outline,
        "issueRegion": outline_to_region(outline),
        "detectedObject": label,
        "source": "yolo",
    }


def detect_with_edges(image_path):
    image = cv2.imread(str(image_path))
    if image is None:
        return None

    img_h, img_w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 35, 110)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    img_area = img_w * img_h
    candidates = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < img_area * 0.02 or area > img_area * 0.75:
            continue

        x, y, w, h = cv2.boundingRect(contour)
        aspect = max(w, h) / max(min(w, h), 1)
        center_dist = abs((x + w / 2) - img_w / 2) / img_w + abs((y + h / 2) - img_h / 2) / img_h

        score = area * (1.2 if aspect > 1.8 else 1.0) * (1.0 - center_dist * 0.5)
        candidates.append((score, contour))

    if not candidates:
        largest = max(contours, key=cv2.contourArea)
        candidates = [(1.0, largest)]

    _, best_contour = max(candidates, key=lambda item: item[0])
    outline = contour_to_outline(best_contour, img_w, img_h)

    if not outline:
        return None

    return {
        "issueOutline": outline,
        "issueRegion": outline_to_region(outline),
        "detectedObject": "issue",
        "source": "issue",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=str)
    parser.add_argument(
        "--model",
        type=str,
        default=str(Path(__file__).parent / "weights" / "pipe-seg.pt"),
    )
    parser.add_argument("--mode", choices=["auto", "yolo", "edges"], default="auto")
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(json.dumps({"error": "image not found"}))
        sys.exit(1)

    result = None
    model_path = Path(args.model)
    brightness = estimate_brightness(image_path)

    if args.mode in ("auto", "yolo") and model_path.exists():
        try:
            result = detect_with_yolo(image_path, model_path)
        except Exception as error:
            if args.mode == "yolo":
                print(json.dumps({"error": str(error)}))
                sys.exit(1)

    if result is None and args.mode in ("auto", "edges"):
        result = detect_with_edges(image_path)

    if result is None:
        print(json.dumps({"error": "no outline detected", "brightness": brightness}))
        sys.exit(1)

    result["brightness"] = brightness
    print(json.dumps(result))


if __name__ == "__main__":
    main()
