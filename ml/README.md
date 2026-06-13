# Pipe edge detection (YOLOv8-seg + OpenCV)

This folder runs **instance segmentation** and extracts a **polygon outline** along the pipe edges.

## Quick setup (Mac)

```bash
cd Backend/ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Option A — Use a pipe-trained YOLO model (best accuracy)

1. Train or download a **YOLOv8-seg** model with a `pipe` class (Roboflow Universe has pipe datasets).
2. Export weights as `.pt` and save to:

```
Backend/ml/weights/pipe-seg.pt
```

3. In `Backend/.env`:

```
YOLO_SEGMENTATION_ENABLED=true
YOLO_PYTHON=./ml/.venv/bin/python3
YOLO_MODEL_PATH=./ml/weights/pipe-seg.pt
YOLO_SEGMENTATION_MODE=yolo
```

## Option B — Edge detection fallback (no model file)

If `pipe-seg.pt` is missing, `segment.py` uses **OpenCV Canny edges** to trace visible object borders (`mode=auto`).

```
YOLO_SEGMENTATION_MODE=auto
```

## Test locally

```bash
python segment.py /path/to/plumbing-photo.jpg --mode auto
```

You should see JSON with `issueOutline` (array of x,y points 0–1).

## Roboflow (optional)

You can train on [Roboflow pipe datasets](https://universe.roboflow.com/search?q=class%3Apipe), export **YOLOv8-seg**, and place the `.pt` file in `weights/pipe-seg.pt`.
