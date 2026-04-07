#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import base64

if len(sys.argv) < 3:
    print("Usage: python3 generate_image.py '<prompt>' '<output_file>'")
    sys.exit(1)

prompt = sys.argv[1]
output_file = sys.argv[2]
api_key = ""

with open(os.path.expanduser('~/.hermes/.env')) as f:
    for line in f:
        if line.startswith('GOOGLE_API_KEY='):
            api_key = line.strip().split('=', 1)[1]
            break

# Test with Nano Banana model API endpoint
url = f"https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateImages?key={api_key}"

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
    response = urllib.request.urlopen(req)
    resp_data = json.loads(response.read().decode('utf-8'))
    
    img_b64 = resp_data['predictions'][0]['bytesBase64Encoded']
    
    # Write to final folder
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    with open(output_file, 'wb') as f:
        f.write(base64.b64decode(img_b64))
        
    print(f"SUCCESS|{output_file}")
except urllib.error.HTTPError as e:
    err_body = e.read().decode('utf-8')
    # If 404, maybe the nano banana model is differently named.
    print(f"HTTP_ERROR|{e.code}|{err_body}")
except Exception as e:
    print(f"ERROR|{str(e)}")
