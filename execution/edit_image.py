#!/usr/bin/env python3
# Simple image editing via Gemini 2.5 Flash Image
# Usage: python3 edit_image.py '<source_image>' '<edit_instruction>' '<output_file>'
import os, sys, json, urllib.request, base64

if len(sys.argv) < 4:
    print("Usage: python3 edit_image.py '<source>' '<instruction>' '<output>'")
    sys.exit(1)

source, instruction, output = sys.argv[1], sys.argv[2], sys.argv[3]

# Read API key
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
    api_key = os.environ.get("GOOGLE_API_KEY", "")
if not api_key:
    print("ERROR|No GOOGLE_API_KEY found")
    sys.exit(1)

# Read source image
with open(source, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('utf-8')

# Detect mime type
ext = source.lower().rsplit('.', 1)[-1]
mime = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg'}.get(ext, 'image/png')

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={api_key}"

payload = {
    "contents": [{
        "parts": [
            {"inlineData": {"mimeType": mime, "data": img_b64}},
            {"text": instruction}
        ]
    }],
    "generationConfig": {
        "responseModalities": ["TEXT", "IMAGE"]
    }
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                             headers={"Content-Type": "application/json"})

try:
    response = urllib.request.urlopen(req, timeout=60)
    resp_data = json.loads(response.read().decode('utf-8'))

    # Extract edited image from response
    edited_b64 = None
    for part in resp_data.get('candidates', [{}])[0].get('content', {}).get('parts', []):
        if 'inlineData' in part:
            edited_b64 = part['inlineData']['data']
            break

    if not edited_b64:
        print("ERROR|No image in response. Model may have returned text only.")
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(output)), exist_ok=True)
    with open(output, 'wb') as f:
        f.write(base64.b64decode(edited_b64))

    print(f"SUCCESS|{output}")

    # Auto-push to dashboard
    try:
        ws_payload = {
            "type": "studio",
            "hero": {
                "src": f"/data/gallery/{os.path.basename(output)}",
                "size": "edited",
                "aspect": "16:9",
                "prompt": f"[EDIT] {instruction}",
                "model": "Gemini 2.5 Flash (Edit)"
            }
        }
        push_req = urllib.request.Request("http://localhost:3111/api/push",
                                          data=json.dumps(ws_payload).encode('utf-8'),
                                          headers={"Content-Type": "application/json"})
        urllib.request.urlopen(push_req, timeout=2)
    except Exception:
        pass

except urllib.error.HTTPError as e:
    print(f"HTTP_ERROR|{e.code}|{e.read().decode('utf-8')}")
except Exception as e:
    print(f"ERROR|{str(e)}")
