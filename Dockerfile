FROM node:22-slim

# Python + OpenCV runtime for ml/segment.py (edges fallback only — no
# ultralytics/torch, since YOLO weights are not deployed yet).
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages \
        "opencv-python-headless>=4.10.0" \
        "numpy>=1.26.0"

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# Must be absolute: relative paths are resolved against the app root.
ENV YOLO_PYTHON=/usr/bin/python3
# No trained weights in the image, so use the OpenCV edges fallback.
ENV YOLO_SEGMENTATION_MODE=edges

EXPOSE 5000

CMD ["node", "app.js"]
