#!/usr/bin/env python3
"""
Unified Image Studio CLI
Usage:
  python3 execution/studio.py generate '<prompt>' '<output>'
  python3 execution/studio.py edit '<source>' '<instruction>' '<output>'
"""
import os, sys, json, urllib.request, base64

# --- Shared Helpers ---

def load_api_key():
    key = ""
    try:
        with open(os.path.expanduser('~/.hermes/.env')) as f:
            for line in f:
                if line.startswith('GOOGLE_API_KEY='):
                    key = line.strip().split('=', 1)[1]
                    break
    except IOError:
        pass
    if not key:
        key = os.environ.get("GOOGLE_API_KEY", "")
    if not key:
        print("ERROR|No GOOGLE_API_KEY found")
        sys.exit(1)
    return key

def push_to_dashboard(output_path, prompt, model):
    try:
        payload = {
            "type": "studio",
            "hero": {
                "src": f"/data/gallery/{os.path.basename(output_path)}",
                "size": "1408x768" if model == "Imagen 4 Fast" else "edited",
                "aspect": "16:9",
                "prompt": prompt,
                "model": model
            }
        }
        req = urllib.request.Request("http://localhost:3111/api/push",
                                     data=json.dumps(payload).encode('utf-8'),
                                     headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass

def save_image(data_b64, output_path):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(base64.b64decode(data_b64))

# --- Generate (Text-to-Image via Imagen 4 Fast) ---

def generate(prompt, output):
    api_key = load_api_key()
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
    try:
        response = urllib.request.urlopen(req, timeout=30)
        resp_data = json.loads(response.read().decode('utf-8'))
        img_b64 = resp_data['predictions'][0]['bytesBase64Encoded']
        save_image(img_b64, output)
        push_to_dashboard(output, prompt, "Imagen 4 Fast")
        print(f"SUCCESS|{output}")
    except urllib.error.HTTPError as e:
        print(f"HTTP_ERROR|{e.code}|{e.read().decode('utf-8')}")
    except Exception as e:
        print(f"ERROR|{str(e)}")

# --- Edit (Image-to-Image via Gemini 2.5 Flash Image) ---

def edit(source, instruction, output):
    api_key = load_api_key()
    
    with open(source, 'rb') as f:
        img_b64 = base64.b64encode(f.read()).decode('utf-8')
    
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
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}
    }
    
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                                 headers={"Content-Type": "application/json"})
    try:
        response = urllib.request.urlopen(req, timeout=60)
        resp_data = json.loads(response.read().decode('utf-8'))
        
        edited_b64 = None
        for part in resp_data.get('candidates', [{}])[0].get('content', {}).get('parts', []):
            if 'inlineData' in part:
                edited_b64 = part['inlineData']['data']
                break
        
        if not edited_b64:
            print("ERROR|No image in response")
            sys.exit(1)
        
        save_image(edited_b64, output)
        push_to_dashboard(output, f"[EDIT] {instruction}", "Gemini 2.5 Flash (Edit)")
        print(f"SUCCESS|{output}")
    except urllib.error.HTTPError as e:
        print(f"HTTP_ERROR|{e.code}|{e.read().decode('utf-8')}")
    except Exception as e:
        print(f"ERROR|{str(e)}")

# --- CLI ---

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 studio.py generate '<prompt>' '<output>'")
        print("  python3 studio.py edit '<source>' '<instruction>' '<output>'")
        sys.exit(1)
    
    mode = sys.argv[1]
    
    if mode == 'generate' and len(sys.argv) >= 4:
        generate(sys.argv[2], sys.argv[3])
    elif mode == 'edit' and len(sys.argv) >= 5:
        edit(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        print(f"ERROR|Unknown mode or missing args: {mode}")
        sys.exit(1)
