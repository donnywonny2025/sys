#!/usr/bin/env python3
# Imagen 4 Fast — Native 16:9 image generation with dashboard auto-push
# Usage: python3 generate_nano_banana.py '<prompt>' '<output_file_path>'
import os
import sys
import json
import urllib.request
import base64

if len(sys.argv) < 3:
    print("Usage: python3 generate_nano_banana.py '<prompt>' '<output_file_path>'")
    sys.exit(1)

prompt = sys.argv[1]
output = sys.argv[2]
api_key = ""

try:
    with open(os.path.expanduser('~/.hermes/.env')) as f:
        for line in f:
            if line.startswith('GOOGLE_API_KEY='):
                api_key = line.strip().split('=', 1)[1]
                break
except IOError:
    pass

if not api_key:
    api_key = os.environ.get("GOOGLE_API_KEY")

if not api_key:
    print("ERROR|No GOOGLE_API_KEY found")
    sys.exit(1)

# Imagen 4 Fast — native aspect ratio support, fast generation
url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key={api_key}"

payload = {
    "instances": [{"prompt": prompt}],
    "parameters": {
        "sampleCount": 1,
        "aspectRatio": "16:9",
        "outputOptions": {"mimeType": "image/png"}
    }
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                             headers={"Content-Type": "application/json"})

def run_prediction():
    try:
        response = urllib.request.urlopen(req, timeout=30)
        resp_data = json.loads(response.read().decode('utf-8'))

        # Imagen API response format
        try:
            img_b64 = resp_data['predictions'][0]['bytesBase64Encoded']
        except (KeyError, IndexError):
            print(f"ERROR|Failed to extract image. Response keys: {list(resp_data.keys())}")
            return

        os.makedirs(os.path.dirname(os.path.abspath(output)), exist_ok=True)
        with open(output, 'wb') as f:
            f.write(base64.b64decode(img_b64))

        print(f"SUCCESS|{output}")

        # Auto-push to Dashboard
        try:
            ws_payload = {
                "type": "studio",
                "hero": {
                    "src": f"/data/gallery/{os.path.basename(output)}",
                    "size": "1408x768",
                    "aspect": "16:9",
                    "prompt": prompt,
                    "model": "Imagen 4 Fast"
                }
            }
            push_req = urllib.request.Request("http://localhost:3111/api/push",
                                              data=json.dumps(ws_payload).encode('utf-8'),
                                              headers={"Content-Type": "application/json"})
            urllib.request.urlopen(push_req, timeout=2)
        except Exception as ws_err:
            print(f"WS_ERROR|Failed to broadcast to dashboard: {ws_err}")

    except urllib.error.HTTPError as e:
        print(f"HTTP_ERROR|{e.code}|{e.read().decode('utf-8')}")
    except Exception as e:
        print(f"ERROR|{str(e)}")

run_prediction()
