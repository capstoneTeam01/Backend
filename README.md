# FixBee Backend

The FixBee backend is a Node.js and Express API using MongoDB, Redis, cloud or local AI, Python, OpenCV, and YOLO segmentation.

## Requirements

Install:

- Node.js 20 and npm
- MongoDB or a MongoDB Atlas connection
- Redis or a hosted Redis connection
- Python 3 with `venv` and `pip`
- Ollama for Local AI and cloud-AI fallback

Confirm the tools are available:

```bash
node --version
npm --version
python3 --version
python3 -m pip --version
```

## Install Node Packages

From this `Backend` directory:

```bash
npm install
```

## Install Python, YOLO, OpenCV, and NumPy

macOS or Linux:

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cd ..
```

Windows PowerShell:

```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cd ..
```

The requirements install:

- `ultralytics` for YOLOv8 segmentation
- `opencv-python-headless` for image processing and edge fallback
- `numpy` for masks and contours

Verify macOS or Linux installation:

```bash
./ml/.venv/bin/python3 -c "import cv2, numpy, ultralytics; print('Python ML setup is ready')"
```

Verify Windows installation:

```powershell
.\ml\.venv\Scripts\python.exe -c "import cv2, numpy, ultralytics; print('Python ML setup is ready')"
```

Place trained YOLO segmentation weights at:

```text
ml/weights/pipe-seg.pt
```

Use `YOLO_SEGMENTATION_MODE=auto` to use trained weights when available and OpenCV edge detection when weights are absent. Use `yolo` only when trained weights must be required without fallback.

## Environment Configuration

Create `.env` in this directory. Never commit it.

```dotenv
PORT=5000

MONGO_URL=mongodb://127.0.0.1:27017/fixbee
REDIS_URL=redis://127.0.0.1:6379
SECRET=replace-with-a-long-random-jwt-secret
DB_NAME=fixbee
COL_NAME=serviceprovidersTest

BLOB_READ_WRITE_TOKEN=

# Configure only one cloud provider.
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-4o-mini
OPENAI_TEXT_MODEL=gpt-4o-mini
OPENAI_COST_MODEL=gpt-4o-mini
OPENAI_REPORT_MODEL=gpt-4o-mini

# Leave empty when OpenAI is configured.
GROQ_API_KEY=
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_REPORT_MODEL=

OLLAMA_ENABLED=true
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_TEXT_MODEL=llama3.2
OLLAMA_VISION_MODEL=qwen3-vl:8b

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_IDS=
APPLE_CLIENT_ID=

FIXBEE_MAIL_USER=
FIXBEE_MAIL_APP_PASSWORD=
FIXBEE_MAIL_FROM_NAME=FixBee

YOLO_SEGMENTATION_ENABLED=true
YOLO_PYTHON=./ml/.venv/bin/python3
YOLO_MODEL_PATH=./ml/weights/pipe-seg.pt
YOLO_SEGMENTATION_MODE=auto
```

Windows users should set:

```dotenv
YOLO_PYTHON=./ml/.venv/Scripts/python.exe
```

Important:

- MongoDB, Redis, and `SECRET` are required for authentication and data access.
- Configure only one of `OPENAI_API_KEY` and `GROQ_API_KEY`.
- Ollama is required for the Local AI profile option and local fallback.
- `BLOB_READ_WRITE_TOKEN` is required for issue-photo and profile-image uploads.
- OAuth and mail variables are required only when those features are used.

## Ollama Setup

Install Ollama, then pull the configured text and vision models:

```bash
ollama pull llama3.2
ollama pull qwen3-vl:8b
```

Start and verify Ollama:

```bash
ollama serve
```

In another terminal:

```bash
ollama ls
```

Ollama normally runs at `http://127.0.0.1:11434`.

The FixBee plumbing dataset is stored at:

```text
training/fixbee-plumbing-knowledge.json
```

This is a grounding and training resource. It does not fine-tune model weights merely by existing in the repository; it must be loaded into a prompt/retrieval workflow or converted for a fine-tuning pipeline.

## Run the Backend

Start MongoDB, Redis, and Ollama first.

Development mode:

```bash
npm run dev
```

Normal mode:

```bash
npm start
```

The API runs at `http://localhost:5000` by default.

Verify the service:

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "server": "Running",
  "mongo": "MongoDB connected",
  "redis": "Redis connected"
}
```

## Startup Order

1. Start MongoDB.
2. Start Redis.
3. Start Ollama.
4. Verify the Python ML environment.
5. Run `npm run dev`.
6. Start the Expo frontend from the separate `Front-End` repository.

## Common Problems

### MongoDB or Redis is disconnected

- Verify `MONGO_URL` and `REDIS_URL`.
- Confirm local services are running.
- Check hosted-service credentials and network allowlists.
- Restart the backend after changing `.env`.

### AI analysis is unavailable

- Configure one cloud AI key or enable Ollama.
- Confirm `ollama ls` contains the configured text and vision models.
- Confirm `OLLAMA_ENABLED=true` and `OLLAMA_URL=http://127.0.0.1:11434`.

### Python segmentation fails

- Run the Python verification command above.
- Confirm `YOLO_PYTHON` points to the virtual-environment interpreter.
- Confirm `ml/weights/pipe-seg.pt` exists when using `YOLO_SEGMENTATION_MODE=yolo`.
- Use `YOLO_SEGMENTATION_MODE=auto` to permit OpenCV fallback.

### Photo upload fails

- Confirm `BLOB_READ_WRITE_TOKEN` is set.
- Confirm the backend can reach the internet.

## Security

- Never commit `.env`, database passwords, API keys, mail passwords, OAuth secrets, JWT secrets, or blob tokens.
- Use separate development and production credentials.
- Do not expose MongoDB, Redis, or Ollama directly to the public internet without appropriate authentication and network controls.
